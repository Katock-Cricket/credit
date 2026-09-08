/**
 * 单次Accept行数（算法 §3.3.3，number 越大越差，max=800）。
 *
 * `maxLines = max(每次 Accept 的 added + deleted)`；`score = 100 − min(maxLines/800×100, 100)`。
 * 语义：一次接受越多行，人越没看就放行。
 *
 * **⚠️ 本指标已于 2026-09-08 退出 CREDIT 分数框架** —— `rules/src/tree.ts` 中不再注册该节点，
 * 故**不会被计算、不参与分数聚合**。实现在此**刻意保留**（决策要求"数据层保留相关逻辑"）：
 * - 采集与 `diffStats` 补齐仍在（`packages/core` 的 `GitPort`）；
 * - 本函数仍可用于离线分析；
 * - 恢复计分只需在规则树加回 `gen.acceptLines` leaf，无需重写。
 *
 * 退出原因：真实 `userAccept` 在桌面端未实测触发（遗留 A-001），`diffStats` 靠事后补齐，
 * 指标长期落 `degraded` 保守分，不具备判别力。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR, normNumber } from "./helpers.js";

export async function genAcceptLines(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const accepts = ctx.behaviors.filter((b) => b.action === "accept");
  if (accepts.length === 0) {
    return degradedR(ctx, id, "无 userAccept 事件，无法统计单次接受行数");
  }

  const evidence: Evidence[] = [];
  let maxLines = 0;
  let missing = 0;

  for (const b of accepts) {
    const ds = b.context?.diffStats as { added?: number; deleted?: number } | null | undefined;
    const added = Number(ds?.added ?? NaN);
    const deleted = Number(ds?.deleted ?? NaN);
    if (!Number.isFinite(added) || !Number.isFinite(deleted)) {
      missing++;
      continue;
    }
    const lines = added + deleted;
    maxLines = Math.max(maxLines, lines);
    evidence.push({
      kind: "behavior",
      ids: [b.id],
      label: `Accept：+${added} / −${deleted} = ${lines} 行`,
    });
  }

  if (missing > 0 && maxLines === 0) {
    return degradedR(
      ctx,
      id,
      `${missing}/${accepts.length} 次 Accept 缺 diffStats（行数补齐失败）`,
    );
  }

  const max = ctx.config.diff.acceptMaxLines;
  return okR(
    id,
    normNumber(maxLines, max, 0, false),
    `单次最大 Accept ${maxLines} 行（阈值 ${max}）${missing > 0 ? `，另有 ${missing} 次缺行数` : ""}`,
    evidence.slice(0, 10),
  );
}
