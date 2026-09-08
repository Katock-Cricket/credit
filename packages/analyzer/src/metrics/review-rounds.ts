/**
 * Review所用轮数（算法 §3.7.4，ordinal 四档）：轮数 = 识别出的 review 会话数。
 *
 * **关键语义**：0 轮是四档之一 → `ok` 且 **0 分**（"跳过 Review = 低分"是理论明确语义），
 * 不是 excluded。这与同组其他指标（无 Review 意见可处置 → excluded）严格区分。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, ordinal } from "./helpers.js";

export async function reviewRounds(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const sessions = ctx.taskGraph.reviewSessions ?? [];
  const rounds = sessions.length;

  const evidence: Evidence[] = sessions.map((s) => ({
    kind: "note",
    text: `第 ${s.roundIndex} 轮（${s.level}，置信度 ${s.confidence}）${s.disposition ? `，处置=${s.disposition}` : ""}`,
  }));

  const tier = rounds <= 0 ? 0 : rounds === 1 ? 1 : rounds === 2 ? 2 : 3;
  return okR(
    id,
    ordinal(ctx, "reviewRounds", tier),
    rounds === 0 ? "本次 PR 未进行 Review（0 轮 = 0 分）" : `共 ${rounds} 轮 Review`,
    evidence,
  );
}
