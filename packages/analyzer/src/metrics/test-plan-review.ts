/**
 * 审阅测试方案（算法 §3.2.2，binary）：同 §3.1.2 的判定，对象换成测试工件。
 *
 * 时间窗 = 测试工件首次出现 → 首次测试运行/commit。
 * 窗内任一测试文件满足「行覆盖 ≥ 10% 或 dwell ≥ 5s」→ 100，否则 0。
 * **测试工件存在但没读 = ok(0)**，不是不适用。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR } from "./helpers.js";
import { traceOf } from "../shared/reading.js";

export async function testPlanReview(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const uris = ctx.testUris();
  if (uris.length === 0) return okR(id, 0, "无测试工件");

  const idx = ctx.reading();
  const cfg = ctx.config.review;
  const evidence: Evidence[] = [];
  let best = 0;
  let detail = "";

  for (const uri of uris) {
    const t = traceOf(idx, uri);
    const total = Math.max(1, t.readLines.length > 0 ? t.readLines[t.readLines.length - 1]! : 0);
    const coverage = t.readLines.length / total;
    const ok = coverage >= cfg.testCoverageRatio || t.dwellMs >= cfg.testDwellMs;
    if (ok) {
      best = 100;
      detail = `已审阅 ${uri}（覆盖 ${(coverage * 100).toFixed(0)}%，停留 ${(t.dwellMs / 1000).toFixed(1)}s）`;
    } else {
      detail = detail || `测试工件存在但未检出有效阅读（覆盖 ${(coverage * 100).toFixed(0)}%，停留 ${(t.dwellMs / 1000).toFixed(1)}s）`;
    }
    evidence.push({
      kind: "file",
      uris: [uri],
      lines: t.readLines.slice(0, 40),
      label: `${uri}：覆盖 ${(coverage * 100).toFixed(0)}% / 停留 ${(t.dwellMs / 1000).toFixed(1)}s`,
    });
  }

  return okR(id, best, detail, evidence.slice(0, 6));
}
