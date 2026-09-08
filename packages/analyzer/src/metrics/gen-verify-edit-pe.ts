/**
 * 编辑覆盖 PE（算法 §3.3.5②）：Dev **亲手编辑**且落在核心新增行内的行 / 全部核心新增行。
 *
 * 关键：「Accept 直收的行」已由 C5 归入 AI 行集并排除 ——
 * 只有 Dev 真的动手改过，才计入 PE。这让"只看不改"（高 PR 低 PE）能被区分出来。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR, pct } from "./helpers.js";

export async function genVerifyEditPe(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const cd = ctx.coreDiff();
  if (cd.totalCoreNew === 0) return okR(id, 0, "无核心新增行");

  const hasEdit = ctx.behaviors.some((b) => b.action === "edit");
  if (!hasEdit) {
    return degradedR(ctx, id, "无编辑事件，无法判定是否修改过 AI 产物");
  }

  let edited = 0;
  let total = 0;
  const evidence: Evidence[] = [];
  for (const [uri, info] of Object.entries(cd.files)) {
    total += info.coreNewLines.length;
  }
  for (const [uri, lines] of Object.entries(cd.devEditedLines)) {
    edited += lines.length;
    evidence.push({ kind: "file", uris: [uri], lines: lines.slice(0, 40), label: `${uri}：Dev 编辑 ${lines.length} 行` });
  }

  if (total === 0) return okR(id, 0, "无核心新增行");
  return okR(
    id,
    pct(edited / total),
    `核心新增行中被 Dev 亲手修改 ${edited}/${total} 行`,
    evidence.slice(0, 8),
  );
}
