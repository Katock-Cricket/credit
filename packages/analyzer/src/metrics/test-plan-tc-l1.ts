/**
 * TC-L1 需求/规格覆盖（算法 §3.2.4）：与「测试对SPEC覆盖率」**完全同源**。
 *
 * 刻意保留为独立节点（理论框架定义二者算法一致但归属不同分组）。
 * 实现上直接复用 `testplan-spec-coverage` 的计算函数，避免两份逻辑漂移。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult } from "../credit/types.js";
import { testPlanSpecCoverage } from "./test-plan-spec-coverage.js";

export async function testPlanTcL1(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const r = await testPlanSpecCoverage(ctx, node);
  return { ...r, id: node.id, detail: `${r.detail}（TC-L1，与测试对SPEC覆盖率同源）` };
}
