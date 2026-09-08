/**
 * 外部工具桩的统一计算器（算法 §4，决策 D-029）。
 *
 * 涉及 6 个指标：TC-L2 结构覆盖、TC-L3 变异杀死率、TC-L4 风险/边界覆盖、
 * 关键路径测试覆盖率、首轮/最终交付规约违规比例。
 *
 * **为何保留计算器而不是删掉节点**：未来"接入外部工具"就变成
 * **替换本函数的返回值**，不必改树结构、改 UI、改聚合。
 *
 * **绝不伪造**：不得用规则近似出一个分数 —— 假分数无法与真值区分，会永久污染总分。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult } from "../credit/types.js";
import { pendingR } from "./helpers.js";

/** 预留的 provider 注册表（当前为空 —— 为空即 pending） */
const PROVIDERS: Record<string, { tool: string }> = {};

export async function toolProxy(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const stub = node.stub;
  const provider = stub?.provider ?? "";
  const tool = stub?.tool ?? "外部工具";

  const registered = PROVIDERS[provider];
  if (!registered) {
    return pendingR(
      node.id,
      `依赖外部工具（${tool}），当前阶段未接入，不参与本次计算`,
    );
  }
  // 未来接入后：provider.run() 返回 ok → 按 §1.3 归一化计分
  return pendingR(node.id, `外部工具 ${tool} 已注册但未返回结果`);
}
