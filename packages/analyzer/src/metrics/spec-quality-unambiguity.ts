/**
 * SPEC质量·无歧义性（算法 §3.1.5③）：**规则扫描为主**（四类模式）。
 *
 * 1. 模糊量词（适当/尽快/合理/尽量…）
 * 2. 条件缺失（含"应当/必须"但同句无 if/当/时）
 * 3. 主语缺失（句首为动词且无系统/用户等主语词）
 * 4. 代词指代（它/其/该模块 且前句有多个候选先行词）
 *
 * `score = (1 − 含歧义条款 / 总条款) × 100`。
 * 设计上刻意以规则为主：歧义是**可枚举的语言现象**，规则比 LLM 稳定且可解释。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, excludedR } from "./helpers.js";
import { clamp01to100 } from "../shared/llm-json.js";

const VAGUE = /适当|尽快|灵活|合理|尽量|一定程度的|as appropriate|timely|flexible/i;
const OBLIGATION = /应当|必须|应该|should|must/i;
const CONDITION = /if|when|若|当|时|unless/i;
const SUBJECT = /系统|用户|服务|组件|前端|后端|模块|接口|本方案|本需求/i;
const PRONOUN = /它|其|该功能|该模块|该接口|this feature|it should/i;

function isAmbiguous(text: string): { hit: boolean; reason: string } {
  const sentences = text.split(/[。；\n]/).map((s) => s.trim()).filter(Boolean);
  let vague = 0;
  let missingCond = 0;
  let missingSubject = 0;
  let pronoun = 0;

  for (const s of sentences) {
    if (VAGUE.test(s)) vague++;
    if (OBLIGATION.test(s) && !CONDITION.test(s)) missingCond++;
    if (/^[开添修删支实返回处判]/u.test(s) && !SUBJECT.test(s)) missingSubject++;
    if (PRONOUN.test(s)) pronoun++;
  }
  const total = sentences.length || 1;
  // 任一类别密度超 20% 即判该条款含歧义
  if (vague / total > 0.2) return { hit: true, reason: "模糊量词过多" };
  if (missingCond / total > 0.2) return { hit: true, reason: "义务表述缺条件子句" };
  if (missingSubject / total > 0.2) return { hit: true, reason: "主语缺失" };
  if (pronoun / total > 0.2) return { hit: true, reason: "代词指代不清" };
  return { hit: false, reason: "" };
}

export async function specQualityUnambiguity(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return excludedR(id, "无 SPEC 文档");

  const items = specs.flatMap((s) => s.items);
  if (items.length === 0) return excludedR(id, "SPEC 无可分析条目");

  let ambiguous = 0;
  const evidence: Evidence[] = [];
  for (const it of items) {
    const r = isAmbiguous(it.text);
    if (r.hit) {
      ambiguous++;
      evidence.push({ kind: "note", text: `${it.id}：${r.reason}` });
    }
  }

  const ratio = ambiguous / items.length;
  return okR(
    id,
    clamp01to100((1 - ratio) * 100),
    `${items.length} 个条目中 ${ambiguous} 个存在歧义`,
    evidence.slice(0, 8),
  );
}
