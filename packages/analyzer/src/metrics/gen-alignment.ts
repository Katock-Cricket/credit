/**
 * 生成与SPEC对齐度（算法 §3.3.4）：对每个映射到 SPEC 条目的 Task，
 * LLM 比对"该 Task 实际改了什么"与"对应条目要求什么"，输出 0–100 的对齐分，
 * 再按 **Task 关联的 Diff 行数加权**平均（改得多的 Task 影响更大）。
 *
 * 降级：无 SPEC / 无 Task / 无映射 → excluded；LLM 失败 → error。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { llmJson, asArray, clamp01to100 } from "../shared/llm-json.js";
import { okR, excludedR, llmFail } from "./helpers.js";

const SYS = `你是代码评审助手。给定若干"工作片段"的目标描述与它实际改动的文件/行数量，
对照相应的 SPEC 条目，判断实现与需求是否对齐。
alignment 为 0–100（100=完全对齐），deviation 说明偏差（无则省略）。
严格输出 json：{"items":[{"taskId":"T1","alignment":90,"deviation":"..."}]}`;

export async function genAlignment(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return excludedR(id, "无 SPEC 文档，无法评估对齐度");

  const m = await ctx.rtm();
  const tasks = ctx.tasks();
  if (tasks.length === 0) return excludedR(id, "无 Task 数据");

  // taskId → specItemId 反查
  const taskToSpec = new Map<string, string>();
  for (const [specId, tids] of Object.entries(m.specToTask)) {
    for (const t of tids) taskToSpec.set(t, specId);
  }

  const targets = tasks.filter((t) => taskToSpec.has(t.id));
  if (targets.length === 0) return excludedR(id, "没有 Task 被映射到 SPEC 条目");

  const payload = targets.map((t) => ({
    taskId: t.id,
    desc: t.desc ?? t.behaviorSummary,
    files: t.files.map((f) => f.uri).slice(0, 8),
    lines: t.files.reduce((s, f) => s + (f.touchedLines ?? 0), 0),
    specText: (m.specItems.find((s) => s.id === taskToSpec.get(t.id))?.text ?? "").slice(0, 600),
  }));

  const r = await llmJson<{ items?: Array<{ taskId?: string; alignment?: number; deviation?: string }> }>(
    ctx.llm,
    {
      metricId: "gen-alignment",
      templateId: "gen-alignment-v1",
      system: SYS,
      user: JSON.stringify(payload),
      schema: { type: "object", required: ["items"] },
    },
  );
  ctx.stats.llmCalls++;
  if (!r.ok || !r.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r);
  }

  const judged = asArray<{ taskId?: string; alignment?: number; deviation?: string }>(r.data.items);
  let sumW = 0;
  let sumWS = 0;
  const evidence: Evidence[] = [];

  for (const j of judged) {
    const t = targets.find((x) => x.id === j?.taskId);
    if (!t) continue;
    const w = Math.max(1, t.files.reduce((s, f) => s + (f.touchedLines ?? 0), 0));
    const a = clamp01to100(Number(j?.alignment ?? 0));
    sumW += w;
    sumWS += w * a;
    evidence.push({
      kind: "llm",
      templateId: "gen-alignment-v1",
      rationale: `${t.id} 对齐 ${a}${j?.deviation ? `；偏差：${String(j.deviation).slice(0, 80)}` : ""}`,
    });
  }

  if (sumW === 0) return excludedR(id, "对齐判定无有效结果");

  return okR(id, Number((sumWS / sumW).toFixed(2)), `${judged.length} 个 Task 的加权对齐度`, evidence);
}
