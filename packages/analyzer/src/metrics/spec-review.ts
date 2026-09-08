/**
 * 审阅SPEC（算法 §3.1.2，binary）。
 *
 * 时间窗 = SPEC 首次出现 → 本 PR 首次 userAccept/commit（取先者）。
 * 窗内满足其一即 100：阅读行覆盖 ≥ 30% 或 累计 dwell ≥ 10s。
 *
 * **SPEC 存在但零阅读 = ok(0)**（算法 A3：未审阅 = 低分，不是不适用）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR } from "./helpers.js";
import { traceOf } from "../shared/reading.js";

/** 估算文件总行数：以阅读过的最大行号与 diff 行数取大者，兜底 1 */
function totalLinesOf(ctx: MetricContext, uri: string, readLines: number[]): number {
  const fromDiff = ctx.gitDiff.files?.find((f) => f.uri === uri)?.added ?? 0;
  return Math.max(1, fromDiff, readLines.length > 0 ? readLines[readLines.length - 1]! : 0);
}

export async function specReview(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return okR(id, 0, "无 SPEC 文档");

  const idx = ctx.reading();
  const cfg = ctx.config.review;
  let best = 0;
  const evidence: Evidence[] = [];
  let detail = "";

  for (const s of specs) {
    const t = traceOf(idx, s.uri);
    const total = totalLinesOf(ctx, s.uri, t.readLines);
    const coverage = total > 0 ? t.readLines.length / total : 0;
    const byCoverage = coverage >= cfg.coverageRatio;
    const byDwell = t.dwellMs >= cfg.dwellMs;

    if (byCoverage || byDwell) {
      best = 100;
      detail = `已审阅 ${s.uri}（行覆盖 ${(coverage * 100).toFixed(0)}%，停留 ${(t.dwellMs / 1000).toFixed(1)}s）`;
    } else {
      detail = detail || `SPEC 存在但窗口内无有效阅读（覆盖 ${(coverage * 100).toFixed(0)}% < ${cfg.coverageRatio * 100}%，停留 ${(t.dwellMs / 1000).toFixed(1)}s < ${cfg.dwellMs / 1000}s）`;
    }
    evidence.push({
      kind: "file",
      uris: [s.uri],
      lines: t.readLines.slice(0, 50),
      label: `${s.uri}：覆盖 ${(coverage * 100).toFixed(0)}% / 停留 ${(t.dwellMs / 1000).toFixed(1)}s`,
    });
  }

  return okR(id, best, detail, evidence);
}
