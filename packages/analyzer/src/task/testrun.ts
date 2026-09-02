/**
 * 测试运行识别与结果解析（算法 §2.6 的 P2-pre 精简版）。
 *
 * 与算法方案的差异：本阶段只需支撑**阶段标注**与 Task 指标，故只实现
 * 主流框架的正则 + exitCode 兜底，不做完整解析器表。P2 需要"自动测试通过率"
 * 指标时再按算法 §2.6 补全（届时本文件的输出结构可直接复用）。
 *
 * **Actor 判定**：`terminal.exec` → dev；`agent.tool`(ExecCommand) → ai。
 * 同一命令的 start/end 两条事件按时间邻近合并为一次运行。
 */
import type { Behavior } from "@credit/protocol";
import { isTestCommand, mergeTaskConfig, type TaskConfig } from "./config.js";

export interface TestRun {
  id: string;
  /** 代表该次运行的 Behavior id（取窗口内最后一条，优先带 exitCode） */
  behaviorId: string;
  cmd: string;
  ts: number;
  actor: "dev" | "ai";
  passed: number | null;
  failed: number | null;
  total: number | null;
  exitCode: number | null;
  /** 是否成功解析出用例计数（false 表示仅靠 exitCode 粗判） */
  parseOk: boolean;
}

/** start/end 两条事件的合并窗口 */
const DEDUP_MS = 5_000;

/** cargo: `test result: ok. 5 passed; 0 failed` */
const RE_CARGO = /test result:\s*(ok|FAILED)\.\s*(\d+)\s*passed;\s*(\d+)\s*failed/i;
/** jest/vitest: `Tests: 2 failed, 8 passed, 10 total` */
const RE_JEST_FAIL = /Tests:\s*(\d+)\s*failed[\s\S]{0,80}?(\d+)\s*passed[\s\S]{0,80}?(\d+)\s*total/i;
/** jest/vitest: `Tests: 8 passed, 8 total` */
const RE_JEST_PASS = /Tests:\s*(\d+)\s*passed[\s\S]{0,80}?(\d+)\s*total/i;
/** pytest: `5 passed, 2 failed` / `5 passed` */
const RE_PYTEST = /(\d+)\s*passed(?:[,\s]+(\d+)\s*failed)?/i;
/** go test: `ok  pkg  0.3s` / `FAIL` */
const RE_GO_OK = /^ok\s+\S+/m;
const RE_GO_FAIL = /^---\s*FAIL:/m;

function parseOutput(
  output: string | null | undefined,
  exitCode: number | null,
): { passed: number | null; failed: number | null; total: number | null; parseOk: boolean } {
  const text = typeof output === "string" ? output : "";

  if (text) {
    let m = text.match(RE_CARGO);
    if (m) {
      const passed = Number(m[2]);
      const failed = Number(m[3]);
      return { passed, failed, total: passed + failed, parseOk: true };
    }
    m = text.match(RE_JEST_FAIL);
    if (m) {
      return {
        failed: Number(m[1]),
        passed: Number(m[2]),
        total: Number(m[3]),
        parseOk: true,
      };
    }
    m = text.match(RE_JEST_PASS);
    if (m) return { passed: Number(m[1]), failed: 0, total: Number(m[2]), parseOk: true };
    m = text.match(RE_PYTEST);
    if (m) {
      const passed = Number(m[1]);
      const failed = m[2] ? Number(m[2]) : 0;
      return { passed, failed, total: passed + failed, parseOk: true };
    }
    if (RE_GO_OK.test(text) || RE_GO_FAIL.test(text)) {
      const failed = (text.match(/^---\s*FAIL:/gm) ?? []).length;
      const okCount = (text.match(/^ok\s+\S+/gm) ?? []).length;
      return { passed: okCount, failed, total: okCount + failed, parseOk: true };
    }
  }

  // 兜底：仅靠 exitCode 粗判
  if (exitCode !== null && exitCode !== undefined) {
    return exitCode === 0
      ? { passed: null, failed: 0, total: null, parseOk: false }
      : { passed: null, failed: 1, total: null, parseOk: false };
  }
  return { passed: null, failed: null, total: null, parseOk: false };
}

/** 从 Behavior 中取命令文本（terminal.exec 用 context.cmd；ExecCommand 用 toolInput.cmd） */
function cmdOf(b: Behavior): string | null {
  if (b.action === "terminal.exec") {
    const c = b.context?.cmd;
    return typeof c === "string" && c.trim() ? c : null;
  }
  if (b.action === "agent.tool") {
    const tool = String(b.context?.toolName ?? "");
    if (!/exec|bash|shell|command/i.test(tool)) return null;
    const inp = b.context?.toolInput as { cmd?: unknown; command?: unknown } | null;
    const c = inp?.cmd ?? inp?.command;
    return typeof c === "string" && c.trim() ? c : null;
  }
  return null;
}

/**
 * 识别测试运行。
 * @param behaviors 按 ts 升序
 */
export function detectTestRuns(
  behaviors: Behavior[],
  cfgOverride?: Partial<TaskConfig>,
): TestRun[] {
  const cfg = mergeTaskConfig(cfgOverride);

  const candidates: Array<{ b: Behavior; cmd: string; actor: "dev" | "ai" }> = [];
  for (const b of behaviors) {
    const cmd = cmdOf(b);
    if (!cmd) continue;
    if (!isTestCommand(cmd, cfg.testCmdPatterns)) continue;
    candidates.push({ b, cmd, actor: b.actor === "ai" ? "ai" : "dev" });
  }
  if (candidates.length === 0) return [];

  const runs: TestRun[] = [];
  let i = 0;
  while (i < candidates.length) {
    const c0 = candidates[i]!;
    // 合并同命令且时间邻近的事件（start/end 对）
    let j = i + 1;
    let last = c0;
    while (
      j < candidates.length &&
      candidates[j]!.cmd === c0.cmd &&
      candidates[j]!.b.ts - last.b.ts < DEDUP_MS
    ) {
      last = candidates[j]!;
      j++;
    }
    const group = candidates.slice(i, j);
    // 优先取带 exitCode 的最后一条（phase=end）
    const withCode = group.filter(
      (g) => g.b.context?.exitCode !== null && g.b.context?.exitCode !== undefined,
    );
    const pick = withCode[withCode.length - 1] ?? group[group.length - 1]!;
    const exitCode =
      pick.b.context?.exitCode === undefined ? null : (pick.b.context.exitCode ?? null);
    const parsed = parseOutput(
      typeof pick.b.context?.output === "string" ? pick.b.context.output : null,
      exitCode,
    );
    runs.push({
      id: `run-${runs.length + 1}`,
      behaviorId: pick.b.id,
      cmd: c0.cmd,
      ts: c0.b.ts,
      actor: c0.actor,
      passed: parsed.passed,
      failed: parsed.failed,
      total: parsed.total,
      exitCode,
      parseOk: parsed.parseOk,
    });
    i = j;
  }

  return runs;
}

/** 是否存在失败运行（供阶段标注的"修复环节"判定） */
export function hasFailedRun(runs: TestRun[]): boolean {
  return runs.some((r) => (r.failed ?? 0) > 0);
}
