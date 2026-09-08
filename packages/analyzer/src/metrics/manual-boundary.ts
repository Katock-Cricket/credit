/**
 * 主动构造边界/异常补测（算法 §3.6.2，binary）：
 * Dev 要求 AI 增加边界/异常用例，或自己描述了构造异常场景 → 100。
 * 未命中 = 0（**不豁免**）。
 * 降级：Prompt 与终端事件全空 → degraded(50)。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR } from "./helpers.js";

const PATTERNS = [
  /边界/,
  /异常/,
  /极端/,
  /edge\s*case/i,
  /corner\s*case/i,
  /断网/,
  /空数据/,
  /超长输入/,
  /非法输入/,
  /越界/,
  /空文件/,
  /损坏文件/,
];

export async function manualBoundary(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const turns = ctx.prompts();
  const terminals = ctx.behaviors.filter((b) => b.action === "terminal.exec");
  if (turns.length === 0 && terminals.length === 0) {
    return degradedR(ctx, id, "无 Prompt 与终端事件");
  }

  const evidence: Evidence[] = [];
  for (const t of turns) {
    if (PATTERNS.some((p) => p.test(t.promptText))) {
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
  }

  return okR(
    id,
    evidence.length > 0 ? 100 : 0,
    evidence.length > 0
      ? `检出 ${evidence.length} 处边界/异常补测要求`
      : "未检出主动构造边界/异常补测",
    evidence.slice(0, 5),
  );
}
