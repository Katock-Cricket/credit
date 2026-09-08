/**
 * LLM 结构化调用的统一 helper（算法 §2.8 / 决策 D-023）。
 *
 * **统一在此收口三件事**，避免每个计算器各写一遍：
 * 1. `templateId` 版本化 → 变更即缓存失效；
 * 2. 失败一律返回 `{ok:false}`，**调用方据此降级，绝不中断整树计算**；
 * 3. 产出统一的 `llm` 证据（模板 id + 一句话理由），便于 UI 追溯"这个分是怎么来的"。
 */
import type { LlmPort, LlmResult } from "../llm/port.js";

export interface LlmJsonResult<T> {
  ok: boolean;
  /**
   * **通道未就绪**（无密钥 / provider=null）与**调用失败**（超时/非法JSON/异常）是两回事：
   * - `unavailable` = 用户没配 LLM → 该指标 **degraded（保守 50）**，
   *   不该因为"没配 key"就把这些指标判 0 分（那是对用户的惩罚，且分数会被严重低估）；
   * - 调用失败 = 真出错 → **error（计 0，不隐藏）**，符合算法 §1.5。
   */
  unavailable: boolean;
  data: T | null;
  /** 供 evidence 使用 */
  rationale: string;
}

const EMPTY_SCHEMA = { type: "object" as const };

/**
 * 单次调用的**输入硬上限**（字符）。
 *
 * **为何需要统一在此收口**：各计算器各自 `slice()` 很容易漏，且阈值散落各处无法审计。
 * 实测最大一笔曾达 19538 字符（≈9.7k tokens）。设上限可保证**任何单点都不会失控**，
 * 代价只是超长时被截断（LLM 判定精度略降），远好于 token 爆炸。
 *
 * 该值可被 config 覆盖；截断会记入 `rationale`，便于发现"谁在喂超长输入"。
 */
const MAX_INPUT_CHARS = 12_000;

export async function llmJson<T = unknown>(
  llm: LlmPort,
  spec: {
    metricId: string;
    templateId: string;
    system: string;
    user: string;
    schema?: Record<string, unknown>;
    model?: string;
  },
): Promise<LlmJsonResult<T>> {
  if (!llm) return { ok: false, unavailable: true, data: null, rationale: "LLM 通道未注入" };
  const available = await llm.isAvailable().catch(() => false);
  if (!available) {
    return { ok: false, unavailable: true, data: null, rationale: "LLM 不可用（无密钥或通道未就绪）" };
  }

  // 输入硬上限：保证任何单点都不会把 token 打爆（超长时截断而非拒绝）
  const rawUser = String(spec.user ?? "");
  const truncated = rawUser.length > MAX_INPUT_CHARS;
  const user = truncated ? rawUser.slice(0, MAX_INPUT_CHARS) : rawUser;
  if (truncated) {
    console.warn(
      `[credit] LLM 输入超上限被截断：${spec.metricId}/${spec.templateId} ` +
        `${rawUser.length} → ${MAX_INPUT_CHARS} 字符`,
    );
  }

  let r: LlmResult;
  try {
    r = await llm.complete({
      metricId: spec.metricId,
      templateId: spec.templateId,
      system: spec.system,
      user,
      input: user,
      schema: (spec.schema ?? EMPTY_SCHEMA) as never,
      model: spec.model,
    });
  } catch (e) {
    return {
      ok: false,
      unavailable: false,
      data: null,
      rationale: `LLM 调用异常：${String((e as Error)?.message ?? e)}`,
    };
  }

  if (!r.ok) {
    return {
      ok: false,
      // 只有"通道不可用"算 unavailable；超时/非法JSON/其他异常都是真失败
      unavailable: r.reason === "unavailable",
      data: null,
      rationale: `LLM 失败（${r.reason}）：${r.message}`,
    };
  }
  return {
    ok: true,
    unavailable: false,
    data: r.json as T,
    rationale: r.cached ? "LLM 判定（命中缓存）" : "LLM 判定",
  };
}

/** 安全取数：LLM 输出可能缺字段，一律走这里的兜底避免计算器抛异常 */
export function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp01to100(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
