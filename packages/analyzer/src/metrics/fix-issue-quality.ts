/**
 * 问题描述质量（算法 §3.5.1，ordinal 三档）：**取所有修复 Prompt 中的最高档**
 * （体现用户最好的一次实践，而非平均水平）。
 *
 * 分档：仅贴问题 → 0；有猜测/代码片段 → 50；有复现步骤 + 根因假设 → 100。
 * LLM 失败 → **规则降级**（含复现步骤关键词 → 100，含猜测词 → 50，其余 0），标 degraded。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { llmJson, asArray } from "../shared/llm-json.js";
import { okR, degradedR, llmFail, ordinal } from "./helpers.js";

const SYS = `你是对话质量分析助手。对每条"反馈问题"的开发者发言，判断它包含哪些元素：
hasReproSteps=是否描述了可复现的步骤；hasRootCauseHypothesis=是否给出了原因假设；
hasGuessOrCode=是否只是猜测或贴了代码片段；pastedLogOnly=是否只是贴了日志/报错。
严格输出 json：{"items":[{"promptId":"p1","hasReproSteps":true,"hasRootCauseHypothesis":false,"hasGuessOrCode":false,"pastedLogOnly":false}]}`;

const RULE_REPRO = /(复现|重现|步骤[:：]|第一步|1\.\s*\w|如何触发|steps?\s+to\s+reproduce)/i;
const RULE_GUESS = /(可能|猜测|也许是|大概是|估计是|疑似|maybe|probably|i\s+guess)/i;

export async function fixIssueQuality(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const fixTurns = ctx.prompts().filter((t) => ctx.tasks().some((task) => task.stage === "ai-fix"));
  const pool = fixTurns.length > 0 ? fixTurns : ctx.prompts();
  if (pool.length === 0) return degradedR(ctx, id, "无 Dev Prompt 事件");

  const r = await llmJson<{
    items?: Array<{
      promptId?: string;
      hasReproSteps?: boolean;
      hasRootCauseHypothesis?: boolean;
      hasGuessOrCode?: boolean;
      pastedLogOnly?: boolean;
    }>;
  }>(ctx.llm, {
    metricId: "fix-issue-quality",
    templateId: "fix-issue-quality-v1",
    system: SYS,
    user: JSON.stringify(
      pool.slice(0, 30).map((t) => ({ promptId: t.id, text: t.promptText.slice(0, 800) })),
    ),
    schema: { type: "object", required: ["items"] },
  });
  ctx.stats.llmCalls++;

  if (!r.ok || !r.data) {
    ctx.stats.llmFallback++;
    // 通道未就绪（没配 key）→ 不该判 0 分，走保守分；真失败才有规则降级兜底
    if (r.unavailable) return llmFail(ctx, id, r);
    // 规则降级
    let best = 0;
    for (const t of pool) {
      if (RULE_REPRO.test(t.promptText)) best = Math.max(best, 2);
      else if (RULE_GUESS.test(t.promptText)) best = Math.max(best, 1);
    }
    return {
      id,
      status: "degraded",
      score: ordinal(ctx, "threeTier", best),
      weight: 1,
      detail: `LLM 判定失败，按关键词规则降级：${r.rationale}`,
      evidence: [],
    };
  }

  let best = 0;
  const evidence: Evidence[] = [];
  for (const it of asArray<{
    hasReproSteps?: boolean;
    hasRootCauseHypothesis?: boolean;
    hasGuessOrCode?: boolean;
    pastedLogOnly?: boolean;
  }>(r.data.items)) {
    const tier = it?.hasReproSteps && it?.hasRootCauseHypothesis ? 2 : it?.hasGuessOrCode || it?.pastedLogOnly ? 1 : 0;
    best = Math.max(best, tier);
    evidence.push({
      kind: "llm",
      templateId: "fix-issue-quality-v1",
      rationale: `复现=${it?.hasReproSteps ? "有" : "无"} 根因假设=${it?.hasRootCauseHypothesis ? "有" : "无"} → 档 ${tier}`,
    });
  }

  return okR(id, ordinal(ctx, "threeTier", best), `修复反馈的最高档为 ${["仅贴问题", "猜测/代码", "复现+假设"][best]}`, evidence.slice(0, 8));
}
