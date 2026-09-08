/**
 * AI对SPEC决策影响占比（算法 §3.1.1，percent 越低越好）。
 *
 * 两步 LLM：① 从 SPEC 提取决策点；② 把每个决策点归因给首次提出者（dev/ai/unclear）。
 * `score = 100 − aiRatio × 100` —— AI 提出的决策越多，人把关越少。
 *
 * 降级：决策点全 unclear → excluded；无对话事件 → degraded；LLM 失败 → error。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { llmJson, asArray, clamp01to100 } from "../shared/llm-json.js";
import { stripCodeBlocks } from "../shared/spec-docs.js";
import { okR, degradedR, excludedR, llmFail, pct } from "./helpers.js";

interface DecisionPoint {
  decisionId?: string;
  point?: string;
  quote?: string;
}
interface Attribution {
  decisionId?: string;
  firstProposer?: string;
  reason?: string;
}

const SYS_DECIDE = `你是需求分析助手。从 SPEC 文档中提取所有关键决策点（技术选型、接口契约、边界约束、数据结构等）。

重要：
1. 文档里常常包含代码片段，**仅供你理解，严禁续写、改写或输出代码**；
2. 只输出 json，不要任何说明文字、不要 markdown 代码块标记。

输出格式：{"decisions":[{"decisionId":"D1","point":"...","quote":"原文摘录"}]}`;

/**
 * **归因定义必须毫不含糊**。
 *
 * 初版只说"判断谁先提出"，模型两次给出完全相反的结果（一次 AI 占 70%、一次 AI 占 0%），
 * 后者明显不合理（该 PR 全程 AI 主导）。根因是**"开发者只是同意"该算谁**没有定义，
 * 模型按各自的直觉走。故在此把边界钉死。
 */
const SYS_ATTRIB = `你是对话归因助手。给定决策点列表与按时间排列的对话，判断每个决策点**首次**由谁提出。

判定标准（务必严格）：
- "dev" —— 开发者在对话中**主动、具体**提出了该决策的内容（明确的选型、数值、方案、边界）；
- "ai"  —— AI 主动提出或建议了该决策，**即使开发者随后同意也仍归 ai**
          （例如开发者说"可以""按你说的""第一个""你决定"，一律算 ai）；
- "unclear" —— 对话里找不到该决策的提出过程。

只输出 json，字段名必须如下：
{"attributions":[{"decisionId":"D1","firstProposer":"ai","reason":"..."}]}`;

export async function specAiDecisionRatio(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return excludedR(id, "无 SPEC 文档");

  const turns = ctx.prompts();
  if (turns.length === 0) {
    return degradedR(ctx, id, "无对话事件，无法归因决策提出者");
  }

  // **剥离代码块**：SPEC 里的大段代码会让模型"续写代码"而不输出 JSON（间歇性失败的根因）
  const specText = stripCodeBlocks(specs.map((s) => `# ${s.uri}\n${s.content}`).join("\n\n")).slice(
    0,
    8000,
  );

  const r1 = await llmJson<{ decisions?: DecisionPoint[] }>(ctx.llm, {
    metricId: "spec-decision-points",
    templateId: "spec-decision-points-v1",
    system: SYS_DECIDE,
    // 显式边界：告诉模型"下面是被分析的材料"，降低其续写材料内容的概率
    // （初版直接把 SPEC 全文当 user 消息，模型被其中的 Rust 代码带偏，返回了代码片段）
    user: `下面是 SPEC 文档全文，请从中提取决策点。\n\n=== SPEC 开始 ===\n${specText}\n=== SPEC 结束 ===`,
    schema: { type: "object", required: ["decisions"] },
  });
  ctx.stats.llmCalls++;
  if (!r1.ok || !r1.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r1);
  }

  const decisions = asArray<DecisionPoint>(r1.data.decisions);
  if (decisions.length < ctx.config.decisionAttribution.minDecisions) {
    return excludedR(id, `决策点仅 ${decisions.length} 个（< ${ctx.config.decisionAttribution.minDecisions}），样本太小比例无意义`);
  }

  const timeline = turns
    .slice(0, 60)
    .map((t, i) => `[${i}] dev: ${t.promptText.slice(0, 400)}${t.messageText ? `\n    ai: ${t.messageText.slice(0, 400)}` : ""}`)
    .join("\n");

  const r2 = await llmJson<{ attributions?: Attribution[] }>(ctx.llm, {
    metricId: "spec-decision-attrib",
    templateId: "spec-decision-attrib-v1",
    system: SYS_ATTRIB,
    user: `决策点：\n${JSON.stringify(decisions)}\n\n对话时间线：\n${timeline}`,
    schema: { type: "object", required: ["attributions"] },
  });
  ctx.stats.llmCalls++;
  if (!r2.ok || !r2.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r2);
  }

  let dev = 0;
  let ai = 0;
  let unclear = 0;
  const evidence: Evidence[] = [];
  for (const a of asArray<Attribution>(r2.data.attributions)) {
    const who = String(a?.firstProposer ?? "unclear").toLowerCase();
    if (who === "dev") dev++;
    else if (who === "ai") ai++;
    else unclear++;
    evidence.push({
      kind: "llm",
      templateId: "spec-decision-attrib-v1",
      rationale: `${a?.decisionId ?? "?"} 首次提出者=${who}：${String(a?.reason ?? "").slice(0, 120)}`,
    });
  }

  const denom = dev + ai;
  if (denom === 0) return excludedR(id, "所有决策点均无法归因（unclear）");

  const aiRatio = ai / denom;
  return okR(
    id,
    pct(aiRatio, false),
    `共 ${dev + ai + unclear} 个决策点：Dev 提出 ${dev}、AI 提出 ${ai}、无法判断 ${unclear}；AI 占比 ${(aiRatio * 100).toFixed(0)}%`,
    evidence,
  );
}
