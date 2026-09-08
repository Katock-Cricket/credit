/**
 * 自动测试最终通过率（算法 §3.4.2）：取 **ts 最大的一次完整运行**。
 *
 * - 解析成功 → `passed / total × 100`
 * - 解析失败但 exitCode 可得 → `exitCode===0 ? 100 : 0`，标 **degraded**（粗粒度）
 * - `total = 0`（无有效用例计数）→ degraded 保守分
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR, pct } from "./helpers.js";

export async function testPassRate(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const runs = ctx.testRuns();
  if (runs.length === 0) return okR(id, 0, "无测试运行");

  const last = [...runs].sort((a, b) => b.ts - a.ts)[0]!;
  const evidence: Evidence[] = [
    {
      kind: "testrun",
      ids: [last.behaviorId],
      label: `${last.cmd}：passed=${last.passed ?? "?"} failed=${last.failed ?? "?"} total=${last.total ?? "?"} exit=${last.exitCode ?? "?"}`,
    },
  ];

  if (last.parseOk && last.total != null && last.total > 0) {
    return okR(
      id,
      pct((last.passed ?? 0) / last.total),
      `最终一次运行：${last.passed}/${last.total} 通过`,
      evidence,
    );
  }

  if (last.exitCode != null) {
    return {
      id,
      status: "degraded",
      score: last.exitCode === 0 ? 100 : 0,
      weight: 1,
      detail: `未能解析用例计数，按 exitCode=${last.exitCode} 粗判（结果不可靠）`,
      evidence,
    };
  }

  return degradedR(ctx, id, "最终一次运行无用例计数也无 exitCode", evidence);
}
