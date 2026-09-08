/**
 * 要求完善测试用例（算法 §3.2.3，binary）：纯规则。
 * Dev Prompt 命中"补充测试/增加边界用例/覆盖率不足…" → 100。
 * 降级：无 prompt → degraded(50)。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR } from "./helpers.js";

const PATTERNS = [
  /补充测试/,
  /增加(边界|异常|edge)?(用例|测试)/i,
  /完善断言/,
  /增加异常路径/,
  /覆盖率(不够|不足)/,
  /补\s*case/i,
  /add\s+(more\s+)?(test|edge)\s+case/i,
  /边界用例/,
];

export async function testPlanAskImprove(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const turns = ctx.prompts();
  if (turns.length === 0) return degradedR(ctx, id, "无 Dev Prompt 事件");

  const hits = turns.filter((t) => PATTERNS.some((p) => p.test(t.promptText)));
  const evidence: Evidence[] = hits.slice(0, 5).map((t) => ({
    kind: "prompt",
    ids: [t.id],
    text: t.promptText.slice(0, 300),
  }));

  return okR(
    id,
    hits.length > 0 ? 100 : 0,
    hits.length > 0
      ? `检出 ${hits.length} 处要求完善测试的 Prompt`
      : "未检出要求完善测试用例的 Prompt",
    evidence,
  );
}
