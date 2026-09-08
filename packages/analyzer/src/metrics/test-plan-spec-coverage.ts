/**
 * 测试对SPEC覆盖率（算法 §3.2.1）：直接取 `rtm().specCoverage × 100`。
 *
 * 与 `TC-L1` **同源同值**（理论框架定义二者算法一致），但树中作为两个独立节点分别计分
 * —— 这是刻意的：二者在指标体系中的归组与权重路径不同。
 *
 * 状态：无 SPEC → excluded；有 SPEC 无测试 → ok(0)（A3：测试没覆盖需求 = 低分）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, excludedR, degradedR } from "./helpers.js";

export async function testPlanSpecCoverage(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return excludedR(id, "无 SPEC 文档，无法计算覆盖率");

  const m = await ctx.rtm();
  if (m.testCases.length === 0) {
    return okR(id, 0, "有 SPEC 但未识别出任何测试用例，覆盖率为 0");
  }
  if (!m.llmOk) {
    return degradedR(ctx, id, "RTM 匹配未完成（LLM 不可用）");
  }

  const covered = Object.values(m.specToTest).filter((v) => v.length > 0).length;
  const evidence: Evidence[] = m.specItems.slice(0, 12).map((s) => ({
    kind: "llm",
    templateId: "rtm-v1",
    rationale: `${s.id}：${(m.specToTest[s.id] ?? []).length > 0 ? "已覆盖" : "未覆盖"} — ${s.text.slice(0, 60)}`,
  }));

  return okR(
    id,
    Number((m.specCoverage * 100).toFixed(2)),
    `${covered}/${m.specItems.length} 个 SPEC 条目有测试用例映射`,
    evidence,
  );
}
