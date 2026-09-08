/**
 * 约束注入（算法 §3.1.4，binary）：纯规则，三类模式任一命中 → 100。
 *
 * Always（必须使用…）/ Ask（遇到…先问我）/ Never（禁止…）。
 * 降级：无 prompt → degraded(50)（采集异常，不是用户未注入）；有 prompt 无命中 → ok(0)。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR } from "./helpers.js";

const ALWAYS = [/必须使用/, /必须遵循/, /应当遵循/, /\bmust\s+use\b/i, /\balways\s+use\b/i, /务必/];
const ASK = [/遇到.{0,20}(问我|确认|先问)/, /\bask\s+me\s+when\b/i, /遇到.{0,10}情况先/];
const NEVER = [/禁止/, /不允许/, /不要使用/, /\bnever\s+use\b/i, /\bdon'?t\s+use\b/i, /不得/];

export async function specConstraint(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const turns = ctx.prompts();
  if (turns.length === 0) return degradedR(ctx, id, "无 Dev Prompt 事件");

  const evidence: Evidence[] = [];
  let hit = false;
  let kind = "";

  for (const t of turns) {
    const text = t.promptText;
    const k = ALWAYS.some((p) => p.test(text))
      ? "Always"
      : ASK.some((p) => p.test(text))
        ? "Ask"
        : NEVER.some((p) => p.test(text))
          ? "Never"
          : "";
    if (k) {
      hit = true;
      kind = k;
      evidence.push({ kind: "prompt", ids: [t.id], text: `[${k}] ${text.slice(0, 300)}` });
    }
  }

  return okR(
    id,
    hit ? 100 : 0,
    hit ? `检出约束注入（${kind} 类），共 ${evidence.length} 处` : "Prompt 中未检出约束注入",
    evidence.slice(0, 5),
  );
}
