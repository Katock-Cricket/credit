/**
 * SPEC质量·完整性（算法 §3.1.5①）：LLM 按 6 维检查清单判定。
 * 维度：目标 / 范围 / 主路径 / 边界 / 错误路径 / 非功能约束（默认等权）。
 *
 * 降级：SPEC 内容 < minContentChars → excluded；LLM 失败 → error（不隐藏）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { llmJson, asArray, clamp01to100 } from "../shared/llm-json.js";
import { okR, excludedR, llmFail } from "./helpers.js";

const DIMS = ["目标", "范围", "主路径", "边界", "错误路径", "非功能约束"] as const;

const SYS = `你是 SPEC 质量评审助手。按六个维度检查 SPEC 是否覆盖：目标、范围、主路径、边界、错误路径、非功能约束。
对每个维度输出 present（是否覆盖）与 quote（依据原文，未覆盖则 null）。
严格输出 json：{"dims":[{"dim":"目标","present":true,"quote":"..."}]}`;

export async function specQualityCompleteness(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return excludedR(id, "无 SPEC 文档");

  const content = specs.map((s) => s.content).join("\n\n");
  if (content.trim().length < ctx.config.spec.minContentChars) {
    return excludedR(id, `SPEC 内容仅 ${content.trim().length} 字符，过短无评估意义`);
  }

  // 消费共享判定（与一致性、可验证性共用一次 LLM 调用，见 shared/spec-quality.ts）
  const q = await ctx.specQuality();
  if (!q.ok) {
    return llmFail(ctx, id, { unavailable: false, rationale: q.error ?? "SPEC 质量判定未完成" });
  }

  const dims = q.dims;
  const present = dims.filter((d) => d?.present).length;
  const total = dims.length > 0 ? dims.length : DIMS.length;
  const score = clamp01to100((present / total) * 100);

  const evidence: Evidence[] = dims.map((d) => ({
    kind: "llm",
    templateId: "spec-quality-v2",
    rationale: `${d.dim ?? "?"}：${d.present ? "已覆盖" : "缺失"}${d.quote ? ` — ${String(d.quote).slice(0, 80)}` : ""}`,
  }));

  return okR(id, score, `六维覆盖 ${present}/${total}`, evidence);
}
