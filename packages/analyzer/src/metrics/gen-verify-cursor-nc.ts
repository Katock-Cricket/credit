/**
 * 光标游走 NC（算法 §3.3.5③）：光标停留过的核心新增行 / 全部核心新增行。
 * 停留判定 = dwell ≥ `readDwellMs`(500ms)，复用 C4 的 `cursorLines`。
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
