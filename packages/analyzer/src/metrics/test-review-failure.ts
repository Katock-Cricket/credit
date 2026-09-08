/**
 * 审阅失败日志/断言细节（算法 §3.4.3，binary）。
 *
 * 前置：**存在失败运行**（failed > 0），否则 `excluded`（无失败可审，不惩罚）。
 * 时间窗 = 失败运行结束 → 其后 15 分钟，窗内满足其一 → 100：
 * 1. Dev Prompt 引用失败细节（断言/堆栈/期望值/行号）
 * 2. 阅读了日志/测试报告文件
 * 3. 终端输出面板的选区/滚动信号
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, excludedR } from "./helpers.js";
import { traceOf } from "../shared/reading.js";

const FAIL_DETAIL =
  /断言|assert|失败行|堆栈|stack\s*trace|期望.{0,10}实际|expected.{0,20}received|失败.{0,6}第?\s*\d+\s*行/i;
const LOG_FILE = /\.(log)$|test-output|report|\/target\//i;

export async function testReviewFailure(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const runs = ctx.testRuns();
  const failures = runs.filter((r) => (r.failed ?? 0) > 0);
  if (failures.length === 0) return excludedR(id, "无失败测试运行，无失败日志可审");

  const windowMs = ctx.config.test.failureReviewWindowMs;
  const lastFailTs = Math.max(...failures.map((r) => r.ts));
  const until = lastFailTs + windowMs;

  const evidence: Evidence[] = [];
  let hit = false;

  // ① Dev Prompt 引用失败细节
  for (const t of ctx.prompts()) {
    if (t.ts < lastFailTs || t.ts > until) continue;
    if (FAIL_DETAIL.test(t.promptText)) {
      hit = true;
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
  }

  // ② 阅读日志/报告文件
  const idx = ctx.reading();
  for (const uri of Object.keys(idx.byUri)) {
    if (!LOG_FILE.test(uri)) continue;
    const t = traceOf(idx, uri);
    if (t.dwellMs > 0 || t.readLines.length > 0) {
      hit = true;
      evidence.push({
        kind: "file",
        uris: [uri],
        label: `阅读了输出/报告文件 ${uri}（停留 ${(t.dwellMs / 1000).toFixed(1)}s）`,
      });
    }
  }

  return okR(
    id,
    hit ? 100 : 0,
    hit
      ? `失败运行后检出 ${evidence.length} 处审阅证据`
      : "有失败运行，但窗口内未检出审阅失败日志的证据",
    evidence.slice(0, 6),
  );
}
