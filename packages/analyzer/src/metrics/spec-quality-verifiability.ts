/**
 * SPEC质量·可验证性（算法 §3.1.5④）：每条款判三个条件
 * —— 是否有验收标准、是否可量化、是否有测试映射。
 * `score = 三条件全满足的条款 / 总条款 × 100`。
 *
 * **不再单独调 LLM**：判定已并入共享的 `shared/spec-quality.ts`（与完整性、一致性同批产出），
 * 本指标只消费 `items` 字段。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { clamp01to100 } from "../shared/llm-json.js";
import { okR, excludedR, llmFail } from "./helpers.js";

export async function specQualityVerifiability(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return excludedR(id, "无 SPEC 文档");

  const items = specs.flatMap((s) => s.items.map((i) => ({ id: i.id, text: i.text })));
  if (items.length === 0) return excludedR(id, "SPEC 无可评估条目");

  // 消费共享判定（与完整性、一致性共用一次 LLM 调用）
  const q = await ctx.specQuality();
  if (!q.ok) {
    return llmFail(ctx, id, { unavailable: false, rationale: q.error ?? "SPEC 质量判定未完成" });
  }

  const v = q.verifiability;
  const full = v.verifiableIds.length;
  const total = v.itemCount || items.length;

  return okR(
    id,
    clamp01to100((full / Math.max(1, total)) * 100),
    `${total} 个条目中 ${full} 个同时满足「验收标准 + 可量化 + 有测试映射」`,
    [
      {
        kind: "llm",
        templateId: "spec-quality-v2",
        rationale:
          `全满足条目：${v.verifiableIds.slice(0, 12).join(", ") || "（无）"}` +
          `${v.verifiableIds.length > 12 ? "…" : ""}`,
      },
    ],
  );
}
