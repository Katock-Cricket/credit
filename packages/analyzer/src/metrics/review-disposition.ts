/**
 * Review意见处置（算法 §3.7.5，ordinal 三档）：
 * 全盘 Accept（AI 方案照单全收）→ 0；选择性采纳 → 50；自拟方案（Dev 自己改）→ 100。
 *
 * 无 Review → excluded。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, excludedR, ordinal } from "./helpers.js";

const OWN_SOLUTION =
  /(我(建议|认为|想|打算).{0,20}(改|修|实现|用))|(按我的.{0,6}(方案|思路))|我的方案|我自己改/i;

export async function reviewDisposition(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const sessions = ctx.taskGraph.reviewSessions ?? [];
  if (sessions.length === 0) return excludedR(id, "无 Review 会话，无意见可处置");

  const evidence: Evidence[] = sessions.map((s) => ({
    kind: "note",
    text: `${s.id}（第 ${s.roundIndex} 轮）：${s.disposition ? `处置=${s.disposition}` : "无处置信息"}`,
  }));

  const own = ctx.prompts().filter((t) => OWN_SOLUTION.test(t.promptText));
  if (own.length > 0) {
    for (const t of own.slice(0, 3)) {
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
    return okR(id, ordinal(ctx, "threeTier", 2), "检出 Dev 自拟方案处置 Review 意见", evidence);
  }

  const selected = sessions.filter((s) => /selected|选择|部分/i.test(`${s.disposition ?? ""} ${s.evidence}`));
  if (selected.length > 0) {
    return okR(
      id,
      ordinal(ctx, "threeTier", 1),
      `选择性采纳（${selected.length}/${sessions.length} 轮为选择性处置）`,
      evidence,
    );
  }

  return okR(id, ordinal(ctx, "threeTier", 0), "全盘 Accept Review 意见", evidence);
}
