/**
 * 阅读覆盖 PR（算法 §3.3.5①）：已阅读的核心新增行 / 全部核心新增行。
 *
 * 降级：textScrolled 与 selectionChanged 都为 0（采集异常）→ degraded；
 *       仅 scroll 缺失 → 本指标 degraded（viewport 只能以光标窗近似），PE/NC 不受影响。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR, pct } from "./helpers.js";
import { traceOf } from "../shared/reading.js";

export async function genVerifyReadPr(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const cd = ctx.coreDiff();
  if (cd.totalCoreNew === 0) return okR(id, 0, "无核心新增行");

  const idx = ctx.reading();
  const hasCursor = ctx.behaviors.some((b) => b.action === "cursor");
  if (!idx.scrollAvailable && !hasCursor) {
    return degradedR(ctx, id, "无滚动与光标事件，采集异常");
  }
  if (!idx.scrollAvailable) {
    return degradedR(ctx, id, "无 viewport 事件，仅能以光标窗近似");
  }

  let read = 0;
  let total = 0;
  const evidence: Evidence[] = [];
  for (const [uri, info] of Object.entries(cd.files)) {
    const core = new Set(info.coreNewLines);
    if (core.size === 0) continue;
    total += core.size;
    const t = traceOf(idx, uri);
    const hit = t.readLines.filter((l) => core.has(l));
    read += hit.length;
    evidence.push({
      kind: "file",
      uris: [uri],
      lines: hit.slice(0, 40),
      label: `${uri}：已读 ${hit.length}/${core.size} 行`,
    });
  }

  if (total === 0) return okR(id, 0, "无核心新增行");
  return okR(id, pct(read / total), `核心新增行已读 ${read}/${total}`, evidence.slice(0, 8));
}
