/**
 * 人工测试最终通过率（算法 §3.6.1，需规 §5.4 的 A2 降级实现）：**Prompt 检测**。
 *
 * 在 PR 时间线尾部窗口（最后 25% 或最后 10 条，取宽者）内，
 * LLM 检测"手动验证/浏览器操作/功能试用"的人工测试信号。
 *
 * **无证据 → `excluded_no_evidence`** —— 不贡献也不惩罚总分（用户既定决策），
 * 与"检测到但没通过 = 0 分"严格区分。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { llmJson, asArray } from "../shared/llm-json.js";
import { okR, noEvidenceR, degradedR, llmFail, pct } from "./helpers.js";

const SYS = `你是测试过程分析助手。判断开发者是否描述了**人工/手动测试**行为
（如在浏览器里实际操作、手动播放验证、点了某个按钮看效果、手动构造输入试了试）。
对每个验证点给出 verdict：pass=通过，fail=失败。
严格输出 json：{"detected":true,"points":[{"verdict":"pass","quote":"...","promptId":"p1"}]}`;

export async function manualPassRate(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const turns = ctx.prompts();
  if (turns.length === 0) return noEvidenceR(id, "无 Dev Prompt 事件，无法检测人工测试");

  const cfg = ctx.config.manualTest;
  const tailCount = Math.max(cfg.minPrompts, Math.ceil(turns.length * cfg.tailWindowRatio));
  const tail = turns.slice(-tailCount);

  const r = await llmJson<{
    detected?: boolean;
    points?: Array<{ verdict?: string; quote?: string; promptId?: string }>;
  }>(ctx.llm, {
    metricId: "manual-pass-rate",
    templateId: "manual-pass-rate-v1",
    system: SYS,
    user: JSON.stringify(tail.map((t) => ({ promptId: t.id, text: t.promptText.slice(0, 800) }))),
    schema: { type: "object", required: ["detected"] },
  });
  ctx.stats.llmCalls++;

  if (!r.ok || !r.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r);
  }

  if (!r.data.detected) {
    return noEvidenceR(id, "未检测到人工测试证据，不参与计算");
  }

  const points = asArray<{ verdict?: string; quote?: string; promptId?: string }>(r.data.points);
  const pass = points.filter((p) => String(p?.verdict).toLowerCase() === "pass").length;
  const fail = points.length - pass;

  const evidence: Evidence[] = points.slice(0, 8).map((p) => ({
    kind: "prompt",
    ids: [String(p?.promptId ?? "")],
    text: `[${p?.verdict ?? "?"}] ${String(p?.quote ?? "").slice(0, 200)}`,
  }));

  if (pass + fail === 0) return noEvidenceR(id, "检测到人工测试信号但无明确验证点");

  return okR(id, pct(pass / (pass + fail)), `人工验证点：通过 ${pass}、失败 ${fail}`, evidence);
}
