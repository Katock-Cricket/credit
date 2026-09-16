/**
 * 光标游走 NC（算法 §3.3.5③）：光标停留过的核心新增行 / 全部核心新增行。
 * 停留判定 = dwell ≥ `readDwellMs`(500ms)，复用 C4 的 `cursorLines`。
 *
 * **⚠️ 本指标已于 2026-09-09 退出 CREDIT 分数框架（决策 D-035）** ——
 * `rules/src/tree.ts` 中不再注册该节点，故**不会被计算、不参与分数聚合**。
 * 实现在此**刻意保留**（决策要求"数据层保留收集"）：
 * `selectionChanged` / `cursor` 事件采集与 `ReadingTraceIndex` 行级停留索引**全部不动**，
 * 本函数仍可用于离线分析；恢复计分只需在规则树加回 `gen.verify.cursorNc` leaf。
 *
 * 退出原因（B-014 实测）：P1 采集的 `cursor` 事件仅 **4 条**且 `dwellMs` 全为 0
 * （采集层限制，非计算问题）→ 该指标**恒为 0**，不具备判别力。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR, pct } from "./helpers.js";
import { traceOf } from "../shared/reading.js";

export async function genVerifyCursorNc(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const cd = ctx.coreDiff();
  if (cd.totalCoreNew === 0) return okR(id, 0, "无核心新增行");

  const hasCursor = ctx.behaviors.some((b) => b.action === "cursor");
  if (!hasCursor) return degradedR(ctx, id, "无光标事件");

  const idx = ctx.reading();
  let hitCount = 0;
  let total = 0;
  const evidence: Evidence[] = [];

  for (const [uri, info] of Object.entries(cd.files)) {
    const core = new Set(info.coreNewLines);
    if (core.size === 0) continue;
    total += core.size;
    const t = traceOf(idx, uri);
    const hit = t.cursorLines.filter((l) => core.has(l));
    hitCount += hit.length;
    evidence.push({
      kind: "file",
      uris: [uri],
      lines: hit.slice(0, 40),
      label: `${uri}：光标停留 ${hit.length}/${core.size} 行`,
    });
  }

  if (total === 0) return okR(id, 0, "无核心新增行");
  return okR(id, pct(hitCount / total), `核心新增行有光标停留 ${hitCount}/${total}`, evidence.slice(0, 8));
}
