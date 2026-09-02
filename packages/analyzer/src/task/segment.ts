/**
 * Task 切分 C2（P2-pre T3，需规 §3.2 / SPEC §4）。
 *
 * **核心原则（决策 D-023）：切分边界一律走规则，不让 LLM 决定在哪里切。**
 * 理由：规则可解释（"这里切是因为有一条 prompt"）、可重现（golden fixture 稳定）、
 * 零成本、便于用户目视核对。LLM 只处理边界之上的语义（见 desc.ts）。
 *
 * **实测修正（R-009）**：算法方案原以"新会话 sessionId / Git Commit / 边界 Prompt"
 * 为三大强信号。P1 样例数据中 git commit = 0 条、sessionId 长期不变，
 * 故**主信号改为 `promptSubmitted`**（S1），时间空档（S2）退居辅助。
 */
import type { Behavior } from "@credit/protocol";
import { isTestCommand, mergeTaskConfig, type TaskConfig } from "./config.js";

export interface SegmentResult {
  /** 切分后的簇（按时间序，簇内保持原序） */
  clusters: Behavior[][];
  /** 各信号命中次数（写入 diagnostics.cutSignals） */
  cutSignals: Record<string, number>;
}

/** 取行为关联的文件 uri（仅 file 类；其余返回 null） */
function fileUriOf(b: Behavior): string | null {
  return b.object?.kind === "file" && b.object.uri ? b.object.uri : null;
}

/** 是否 Review 会话（供 S4 用：跨会话切换才切） */
function sessionIdOf(b: Behavior): string | null {
  return b.context?.sessionId ?? null;
}

/**
 * 切分 Behavior 流为 Task 簇。
 *
 * 信号优先级：S1 prompt > S2 空档 > S3 测试命令 > S4 Review 会话切换 > S5 文件聚簇切换。
 * 同一点被多信号命中只切一次，计数记在**优先级最高**的那个信号上。
 */
export function segmentBehaviors(
  behaviors: Behavior[],
  cfgOverride?: Partial<TaskConfig>,
): SegmentResult {
  const cfg = mergeTaskConfig(cfgOverride);
  const cutSignals: Record<string, number> = {
    prompt: 0,
    idleGap: 0,
    testCmd: 0,
    reviewSwitch: 0,
    fileSwitch: 0,
  };

  if (behaviors.length === 0) return { clusters: [], cutSignals };

  /** 在下标 i 之前切一刀（i > 0） */
  const cuts = new Set<number>();

  let activeFile: string | null = null;
  const lastTouched = new Map<string, number>();

  for (let i = 1; i < behaviors.length; i++) {
    const b = behaviors[i]!;
    const prev = behaviors[i - 1]!;

    // ── S1：Dev prompt（主信号，每一次发言 = 一次意图切换）──
    if (b.action === "prompt.submit") {
      cuts.add(i);
      cutSignals.prompt = (cutSignals.prompt ?? 0) + 1;
      // 仍然更新文件状态，避免后续 S5 误判
      const f = fileUriOf(b);
      if (f) {
        activeFile = f;
        lastTouched.set(f, b.ts);
      }
      continue;
    }

    // ── S2：时间空档 ──
    if (b.ts - prev.ts > cfg.idleGapMs) {
      cuts.add(i);
      cutSignals.idleGap = (cutSignals.idleGap ?? 0) + 1;
      const f = fileUriOf(b);
      if (f) {
        activeFile = f;
        lastTouched.set(f, b.ts);
      }
      continue;
    }

    // ── S3：Dev 执行测试/构建命令 ──
    // 只算 Dev 触发的：Agent 跑命令属"正在进行的 Task 内部"行为，
    // 若计入会产生大量无意义切点（样例中 AI 的 ExecCommand 有 67 次）。
    if (
      b.action === "terminal.exec" &&
      b.actor === "dev" &&
      isTestCommand(b.context?.cmd, cfg.testCmdPatterns)
    ) {
      cuts.add(i);
      cutSignals.testCmd = (cutSignals.testCmd ?? 0) + 1;
      continue;
    }

    // ── S4：Review 会话切换（进入/离开 review 子会话）──
    const curSid = sessionIdOf(b);
    const prevSid = sessionIdOf(prev);
    if (curSid && prevSid && curSid !== prevSid) {
      cuts.add(i);
      cutSignals.reviewSwitch = (cutSignals.reviewSwitch ?? 0) + 1;
      continue;
    }

    // ── S5：活跃文件聚簇切换（默认关闭，见 TaskConfig.enableFileSwitch）──
    const f = fileUriOf(b);
    if (f) {
      if (cfg.enableFileSwitch && f !== activeFile) {
        const prevTouch = lastTouched.get(f);
        if (prevTouch === undefined || b.ts - prevTouch > cfg.fileIdleMs) {
          cuts.add(i);
          cutSignals.fileSwitch = (cutSignals.fileSwitch ?? 0) + 1;
        }
        activeFile = f;
      }
      lastTouched.set(f, b.ts);
    }
  }

  // ── 按切点切片 ──
  const raw: Behavior[][] = [];
  let start = 0;
  for (const c of [...cuts].sort((a, b) => a - b)) {
    if (c > start) raw.push(behaviors.slice(start, c));
    start = c;
  }
  if (start < behaviors.length) raw.push(behaviors.slice(start));

  // ── 噪声抑制：< minClusterSize 的碎片并入相邻簇 ──
  const merged: Behavior[][] = [];
  for (const cl of raw) {
    if (merged.length > 0 && cl.length < cfg.minClusterSize) {
      const last = merged[merged.length - 1]!;
      merged[merged.length - 1] = last.concat(cl);
    } else {
      merged.push(cl);
    }
  }
  // 末尾簇太小 → 并入前一个（否则会留下一个孤立的噪声 Task）
  if (merged.length > 1) {
    const last = merged[merged.length - 1]!;
    if (last.length < cfg.minClusterSize) {
      merged.pop();
      const prevLast = merged[merged.length - 1]!;
      merged[merged.length - 1] = prevLast.concat(last);
    }
  }

  return { clusters: merged, cutSignals };
}
