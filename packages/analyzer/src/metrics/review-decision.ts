/**
 * 修哪些问题的决策方式（算法 §3.7.1，ordinal 三档）：
 * 按默认全修 → 0；选择性修（有搁置/驳回）→ 50；自拟方案 → 100。
 *
 * **无 Review → excluded**（没有 Review 意见，就谈不上"修哪些"的决策方式）
 * —— 与 `review.rounds`（0 轮 = ok/0 分）刻意区分。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, excludedR, ordinal } from "./helpers.js";

const OWN_SOLUTION =
  /(我(建议|认为|想|打算).{0,20}(改|修|实现|用))|(按我的.{0,6}(方案|思路))|我的方案|应该改为|改成.{0,10}而不是|不要.{0,8}直接/i;

export async function reviewDecision(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const sessions = ctx.taskGraph.reviewSessions ?? [];
  if (sessions.length === 0) return excludedR(id, "无 Review 会话，不存在修复决策");

  const evidence: Evidence[] = sessions.map((s) => ({
    kind: "note",
    text: `${s.id}：${s.disposition ? `处置=${s.disposition}` : "无处置信息"}（${s.evidence.slice(0, 80)}）`,
  }));

  // 自拟方案优先覆盖
  const own = ctx.prompts().filter((t) => OWN_SOLUTION.test(t.promptText));
  if (own.length > 0) {
    for (const t of own.slice(0, 3)) {
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
    return okR(id, ordinal(ctx, "threeTier", 2), "检出 Dev 自拟修复方案", evidence);
  }

  // 选择性：存在"选择性采纳"语义
  const selective = sessions.some((s) => /selected|选择|部分/i.test(`${s.disposition ?? ""} ${s.evidence}`));
  if (selective) {
    return okR(id, ordinal(ctx, "threeTier", 1), "选择性采纳 Review 意见后修复", evidence);
  }

  return okR(id, ordinal(ctx, "threeTier", 0), "按 Review 意见全盘修复", evidence);
}
