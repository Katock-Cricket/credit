/**
 * SPEC边界把控（算法 §3.1.3，ordinal 三档）。
 *
 * 先规则预筛"Dev 是否要求 AI 反问"，再由 LLM 对 AI 的每个反问判断 Dev 的回复质量：
 * 显式指明选项/参数 = 100；仅"可以/ok/第一个" = 50；未要求反问或未回复 = 0。
 *
 * 降级：无 prompt → degraded(50)；LLM 失败 + hasAsk=true → degraded(50)；
 *       LLM 失败 + hasAsk=false → ok(0)（规则已能定档）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { llmJson, asArray } from "../shared/llm-json.js";
import { okR, degradedR, llmFail, ordinal } from "./helpers.js";

const ASK_PATTERNS = [
  /ask\s+me/i,
  /clarif/i,
  /反问/,
  /澄清/,
  /有疑问.{0,6}问/,
  /confirm(ation)?/i,
  /先问/,
  /有.{0,4}问题.{0,4}(问|确认)/,
];

const SYS = `你是对话分析助手。给定一段开发者与 AI 的对话，找出 AI 向开发者提出的**所有反问/选择题**，
并判断开发者对每个反问的回复质量：explicit=显式指明选项或参数；default=仅同意/让 AI 决定（如"可以""ok""按你说的""第一个"）；none=未回复。
严格输出 json：{"replies":[{"question":"...","replyClass":"explicit","quote":"..."}]}`;

export async function specBoundary(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const turns = ctx.prompts();
  if (turns.length === 0) return degradedR(ctx, id, "无 Dev Prompt 事件");

  const askTurns = turns.filter((t) => ASK_PATTERNS.some((p) => p.test(t.promptText)));
  const hasAsk = askTurns.length > 0;

  const evidence: Evidence[] = askTurns.slice(0, 5).map((t) => ({
    kind: "prompt",
    ids: [t.id],
    text: t.promptText.slice(0, 300),
  }));

  if (!hasAsk) {
    return okR(id, ordinal(ctx, "threeTier", 0), "未检出要求 AI 反问的 Prompt", evidence);
  }

  const convo = turns
    .slice(0, 40)
    .map((t) => `dev: ${t.promptText.slice(0, 300)}${t.messageText ? `\nai: ${t.messageText.slice(0, 300)}` : ""}`)
    .join("\n");

  const r = await llmJson<{ replies?: Array<{ replyClass?: string; quote?: string; question?: string }> }>(
    ctx.llm,
    {
      metricId: "spec-boundary",
      templateId: "spec-boundary-v1",
      system: SYS,
      user: convo,
      schema: { type: "object", required: ["replies"] },
    },
  );
  ctx.stats.llmCalls++;
  if (!r.ok || !r.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r);
  }

  const replies = asArray<{ replyClass?: string; quote?: string }>(r.data.replies);
  let explicit = 0;
  let other = 0;
  for (const x of replies) {
    const c = String(x?.replyClass ?? "").toLowerCase();
    if (c === "explicit") explicit++;
    else other++;
    evidence.push({
      kind: "llm",
      templateId: "spec-boundary-v1",
      rationale: `反问回复=${c}：${String(x?.quote ?? "").slice(0, 100)}`,
    });
  }

  const total = explicit + other;
  if (total === 0) {
    return okR(id, ordinal(ctx, "threeTier", 0), "检出要求反问但未识别出 AI 的反问", evidence);
  }

  const rate = explicit / total;
  const tier = rate >= 1 ? 2 : rate > 0 ? 1 : 0;
  return okR(
    id,
    ordinal(ctx, "threeTier", tier),
    `AI 反问 ${total} 处，Dev 显式指明 ${explicit} 处（explicitRate ${(rate * 100).toFixed(0)}%）`,
    evidence,
  );
}
