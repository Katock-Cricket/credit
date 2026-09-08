/**
 * 计算器的结果构造与常用工具。
 *
 * **状态语义见算法 §1.5**，此处只收口构造，避免每个计算器各写一遍：
 * - `ok` —— 正常计分（含"语义未做 = 低分"，如 Review 0 轮 = 0 分）
 * - `excluded` —— 依赖的工件不存在，不计分，权重重分配
 * - `excluded_no_evidence` —— 无证据（人工测试专用：不贡献也不惩罚）
 * - `pending` —— 外部工具桩
 * - `degraded` —— 关键字段缺失 / 采集异常，计保守分（默认 50），UI 明示
 * - `error` —— 计算器异常或 LLM 两次失败，计 0
 */
import type { MetricResult, Evidence } from "../credit/types.js";
import type { MetricContext } from "../credit/context.js";
import type { OrdinalKey } from "@credit/rules";

function mk(
  id: string,
  status: MetricResult["status"],
  score: number | null,
  detail: string,
  evidence: Evidence[] = [],
  weight = 1,
): MetricResult {
  return { id, status, score, detail, evidence, weight };
}

export const okR = (id: string, score: number, detail: string, ev: Evidence[] = []): MetricResult =>
  mk(id, "ok", Number(score.toFixed(2)), detail, ev);

export const degradedR = (
  ctx: MetricContext,
  id: string,
  detail: string,
  ev: Evidence[] = [],
): MetricResult =>
  mk(id, "degraded", ctx.config.degraded.conservativeScore, `${detail}（数据不足，计保守分）`, ev);

export const excludedR = (id: string, detail: string): MetricResult =>
  mk(id, "excluded", null, detail);

export const noEvidenceR = (id: string, detail: string): MetricResult =>
  mk(id, "excluded_no_evidence", null, detail);

export const pendingR = (id: string, detail: string): MetricResult =>
  mk(id, "pending", null, detail);

export const errorR = (id: string, detail: string): MetricResult => mk(id, "error", 0, detail);

/**
 * LLM 未拿到结果时的统一处置（见 `llm-json.ts` 的 `unavailable` 语义）：
 * 通道未就绪 → degraded 保守分；调用真失败 → error 计 0。
 */
export function llmFail(
  ctx: MetricContext,
  id: string,
  r: { unavailable: boolean; rationale: string },
): MetricResult {
  return r.unavailable
    ? degradedR(ctx, id, `LLM 通道未就绪：${r.rationale}`)
    : errorR(id, `LLM 调用失败：${r.rationale}`);
}

/** ordinal 档位 → 分值（档位表来自 config，不硬编码） */
export function ordinal(ctx: MetricContext, key: OrdinalKey, tierIndex: number): number {
  const table = ctx.config.ordinal[key] ?? [0, 50, 100];
  return table[Math.max(0, Math.min(table.length - 1, tierIndex))] ?? 0;
}

/** percent 归一化（0–1 → 0–100；higherIsBetter=false 时取反） */
export function pct(ratio: number, higherIsBetter = true): number {
  const r = Math.max(0, Math.min(1, ratio));
  return Number(((higherIsBetter ? r : 1 - r) * 100).toFixed(2));
}

/** number 线性归一：越大越差时取反 */
export function normNumber(
  value: number,
  max: number,
  min = 0,
  higherIsBetter = true,
): number {
  if (max <= min) return 0;
  const r = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return Number(((higherIsBetter ? r : 1 - r) * 100).toFixed(2));
}

/** 正则命中测试（大小写不敏感） */
export function hits(text: string, patterns: RegExp[]): boolean {
  const t = String(text ?? "");
  return patterns.some((p) => p.test(t));
}

export function firstHit(text: string, patterns: RegExp[]): RegExp | null {
  const t = String(text ?? "");
  return patterns.find((p) => p.test(t)) ?? null;
}

/** 数组交集大小 */
export function intersectCount<T>(a: ReadonlySet<T>, b: readonly T[]): number {
  let n = 0;
  for (const x of b) if (a.has(x)) n++;
  return n;
}
