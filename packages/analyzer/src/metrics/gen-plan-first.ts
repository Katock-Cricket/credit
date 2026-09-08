/**
 * 先审计划再授权生成（算法 §3.3.2，binary）。
 *
 * 三条件：
 * 1. AI 输出过计划（agentMessage 含"计划/方案/步骤/里程碑"等结构化标题，或计划类工具）
 * 2. Dev 阅读了计划 —— **采集限制下的代理信号**：从计划输出结束到 Dev 下一个动作
 *    （Accept 或 Prompt）的间隔 ≥ 10s，视为"花时间看了"
 * 3. 授权晚于阅读（满足条件 2 即天然满足时序）
 *
 * 无计划输出且存在直接 Accept → ok(0)。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR } from "./helpers.js";

const PLAN_PATTERN = /(计划|方案|步骤|里程碑|plan\b|step\s*1|以下(是|为).{0,6}(步骤|计划))/i;
const PLAN_TOOLS = /^(todo|plan|todo_write|write_plan|create_plan)/i;

export async function genPlanFirst(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const bs = ctx.behaviors;
  const dwell = ctx.config.planReview.dwellMs;

  // ① AI 输出计划
  const planMsgs = bs
    .filter(
      (b) =>
        (b.action === "agent.message" && PLAN_PATTERN.test(String(b.context?.promptText ?? b.context?.output ?? ""))) ||
        (b.action === "agent.tool" && PLAN_TOOLS.test(String(b.context?.toolName ?? ""))),
    )
    .sort((a, b) => a.ts - b.ts);

  if (planMsgs.length === 0) {
    return okR(id, 0, "未检出 AI 输出的计划/步骤，直接进入生成");
  }

  const planEndTs = planMsgs[planMsgs.length - 1]!.ts;

  // ② 计划之后 Dev 的下一个动作
  const nextAction = bs
    .filter((b) => b.ts >= planEndTs && (b.action === "accept" || b.action === "prompt.submit"))
    .sort((a, b) => a.ts - b.ts)[0];

  if (!nextAction) {
    return okR(
      id,
      0,
      "计划输出后无后续动作（无 Accept 也无 Prompt），无法判定是否审阅",
      [{ kind: "behavior", ids: [planMsgs[planMsgs.length - 1]!.id], label: "计划输出" }],
    );
  }

  const gap = nextAction.ts - planEndTs;
  const evidence: Evidence[] = [
    { kind: "behavior", ids: [planMsgs[planMsgs.length - 1]!.id], label: "AI 计划输出" },
    { kind: "behavior", ids: [nextAction.id], label: "计划后的首个 Dev 动作" },
    { kind: "note", text: `间隔 ${(gap / 1000).toFixed(1)}s（阈值 ${dwell / 1000}s）` },
  ];

  return okR(
    id,
    gap >= dwell ? 100 : 0,
    gap >= dwell
      ? `计划后停留 ${(gap / 1000).toFixed(1)}s 才授权，视为审阅了计划`
      : `计划后仅 ${(gap / 1000).toFixed(1)}s 即授权，未达审阅阈值`,
    evidence,
  );
}
