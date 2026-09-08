/**
 * 提供失败用例/复现步骤（算法 §3.5.2，binary）：命中其一 → 100。
 * 1. 修复环节内 Dev 新增/修改了测试文件（且针对失败点）
 * 2. 修复 Prompt 含结构化复现步骤（关键词规则 + LLM 补充）
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR } from "./helpers.js";
import { isTestUri } from "../shared/spec-docs.js";

const REPRO_PATTERN =
  /(复现|重现)(步骤|方法|方式)?[:：]|如何触发|steps?\s+to\s+reproduce|最小复现|复现代码|测试用例[:：]/i;

export async function fixReproCase(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const evidence: Evidence[] = [];
  let hit = false;

  // ① Dev 编辑测试文件
  for (const b of ctx.behaviors) {
    if (b.action !== "edit" || b.actor !== "dev") continue;
    const uri = b.object?.kind === "file" ? b.object.uri : undefined;
    if (uri && isTestUri(uri)) {
      hit = true;
      evidence.push({ kind: "file", uris: [uri], label: "Dev 编辑了测试文件" });
      break;
    }
  }

  // ② Prompt 含复现步骤
  for (const t of ctx.prompts()) {
    if (REPRO_PATTERN.test(t.promptText)) {
      hit = true;
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
      break;
    }
  }

  return okR(
    id,
    hit ? 100 : 0,
    hit ? "检出复现步骤或针对失败点的测试用例" : "未检出复现步骤/失败用例",
    evidence.slice(0, 5),
  );
}
