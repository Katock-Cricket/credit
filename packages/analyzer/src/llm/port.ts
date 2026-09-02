/**
 * LlmPort 抽象（P2-pre T0，决策 D-023）。
 *
 * **双通道**：`openai-compatible`（P2-pre/P2 离线计算，外部 OpenAI 兼容 API）与
 * `bitfun`（P4 起，宿主 `app.ai.*`）实现同一接口，切换只改注入，上层零改动。
 *
 * **核心纪律**：`complete()` **永不抛异常** —— 一律返回 `LlmResult`。调用方据此
 * 选择降级路径，绝不因 LLM 失败中断 Task 识别（同架构 §3.3 单指标错误隔离）。
 */

/** 结构化输出校验用的最小 JSON Schema（本阶段只校验顶层 required 与 type） */
export type JsonSchema = {
  type?: "object" | "array";
  required?: string[];
  /** 附加说明，不参与校验 */
  description?: string;
};

export type LlmProviderId = "openai-compatible" | "bitfun" | "null";

export interface LlmCallSpec {
  /** 缓存键组成部分（如 'task-desc' / 'fragment-merge' / 'stage-disambiguate' / 'review-detect'） */
  metricId: string;
  /** 模板版本化：templateId 变更即缓存失效 */
  templateId: string;
  /** 系统提示词 */
  system: string;
  /** 用户提示词（由调用方生成） */
  user: string;
  /** 参与缓存键 hash 的结构化输入 */
  input: unknown;
  /** 结构化输出校验 schema */
  schema: JsonSchema;
  /** 可选：覆盖默认模型 */
  model?: string;
}

export type LlmFailureReason =
  /** 通道未就绪（无密钥 / 未注入实现） */
  | "unavailable"
  /** 超时 / 网络 / 5xx（已重试） */
  | "timeout"
  /** 返回内容不是合法 JSON（已重试） */
  | "invalid-json"
  /** JSON 合法但不过 schema 校验（已重试） */
  | "schema"
  /** 其他异常 */
  | "error";

export type LlmResult =
  | { ok: true; json: unknown; model: string; cached: boolean }
  | { ok: false; reason: LlmFailureReason; message: string };

export interface LlmPort {
  readonly id: LlmProviderId;
  /** 通道是否就绪（无密钥、未配置时返回 false，调用方据此降级） */
  isAvailable(): Promise<boolean>;
  /** 发起一次结构化调用；**永不抛异常** */
  complete(spec: LlmCallSpec): Promise<LlmResult>;
}

// ───────────────────────── 配置 ─────────────────────────

export interface LlmConfig {
  provider: LlmProviderId;
  openaiCompatible: {
    baseUrl: string;
    model: string;
    /**
     * 环境变量名（**不存密钥本体**）。
     * 安全约束见架构 §7.3：`config.json` 只存变量名，密钥一律运行时取。
     */
    apiKeyEnv: string;
  };
  bitfun: { model: string; fallbackModel: string };
  timeoutMs: number;
  /** 每种失败原因的重试次数（不含首次） */
  retryPerModel: number;
  cacheEnabled: boolean;
  /** Desc 生成时喂给 LLM 的 prompt 原文最大字符数 */
  descMaxInputChars: number;
  /** 单次批量调用包含的 Task 数上限 */
  maxTasksPerBatch: number;
}

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: "openai-compatible",
  openaiCompatible: {
    baseUrl: "https://api.chatanywhere.tech/v1",
    model: "deepseek-v4-flash",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  bitfun: { model: "fast", fallbackModel: "primary" },
  timeoutMs: 60_000,
  retryPerModel: 1,
  cacheEnabled: true,
  descMaxInputChars: 1200,
  maxTasksPerBatch: 30,
};

/**
 * 从环境变量取 API Key（架构 §7.3：密钥不落 config、不落日志、不落产物）。
 *
 * @param envName 环境变量名
 * @param env 环境变量源（默认 `process.env`；单测可注入）
 */
export function readApiKey(
  envName: string,
  env: Record<string, string | undefined> = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {},
): string | null {
  const v = env[envName];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ───────────────────────── 缓存 ─────────────────────────

export interface LlmCache {
  get(key: string): unknown | undefined;
  set(key: string, value: unknown): void;
}

/** 稳定序列化：对象 key 排序，保证同语义输入得到同 hash（缓存命中率） */
function stable(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(stable);
  if (x && typeof x === "object") {
    const src = x as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) out[k] = stable(src[k]);
    return out;
  }
  return x;
}

/**
 * FNV-1a 64-bit 同步 hash（无依赖、可在任意 JS 运行时跑）。
 * 仅用于缓存键，不需密码学强度。
 */
export function hashInput(x: unknown): string {
  const s = JSON.stringify(stable(x)) ?? "null";
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, "0");
}

/** 构造缓存键（架构 §10.4） */
export function makeCacheKey(spec: LlmCallSpec, model: string): string {
  return hashInput({
    metricId: spec.metricId,
    templateId: spec.templateId,
    model,
    input: spec.input,
  });
}

/** 内存缓存（默认；进程内去重） */
export function createMemoryCache(): LlmCache {
  const m = new Map<string, unknown>();
  return {
    get: (k) => m.get(k),
    set: (k, v) => void m.set(k, v),
  };
}

// ───────────────────────── schema 校验 ─────────────────────────

/**
 * 最小 schema 校验（只查顶层 type 与 required）。
 * 刻意不做完整 JSON Schema 实现 —— 本阶段的输出契约都很简单，过度设计反成负担。
 */
export function validateJson(json: unknown, schema: JsonSchema): string | null {
  if (schema.type === "object") {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return `期望 object，实际 ${Array.isArray(json) ? "array" : typeof json}`;
    }
  }
  if (schema.type === "array" && !Array.isArray(json)) {
    return `期望 array，实际 ${typeof json}`;
  }
  if (schema.required && schema.required.length > 0) {
    if (!json || typeof json !== "object") return `期望 object 以校验 required`;
    const obj = json as Record<string, unknown>;
    const missing = schema.required.filter((k) => obj[k] === undefined);
    if (missing.length > 0) return `缺少字段：${missing.join(", ")}`;
  }
  return null;
}
