/**
 * 亲自触发/重跑测试（算法 §3.4.1，binary）：存在 **Dev** 触发的测试运行 → 100。
 *
 * 语义要点：**AI 跑了而 Dev 没跑 = 0 分**（本指标考察的是人有没有亲自验证，
 * 不是"测试有没有跑过"）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR } from "./helpers.js";

export async function testDevTrigger(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const runs = ctx.testRuns();
  const devRuns = runs.filter((r) => r.actor === "dev");

  const evidence: Evidence[] = devRuns.slice(0, 8).map((r) => ({
    kind: "testrun",
    ids: [r.behaviorId],
    label: `Dev 触发：${r.cmd}（exit=${r.exitCode ?? "?"}）`,
  }));

  if (devRuns.length === 0) {
    const aiRuns = runs.filter((r) => r.actor === "ai");
    return okR(
      id,
      0,
      aiRuns.length > 0 ? "测试均由 AI 触发，Dev 未亲自运行" : "无测试运行记录",
      aiRuns.slice(0, 5).map((r) => ({
        kind: "testrun",
        ids: [r.behaviorId],
        label: `AI 触发：${r.cmd}`,
      })),
    );
  }

  return okR(id, 100, `Dev 亲自触发 ${devRuns.length} 次测试运行`, evidence);
}
