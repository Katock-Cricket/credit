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
"unavailable"
/** 超时 / 网络 / 5xx（已重试） */
 | "timeout"
/** 返回内容不是合法 JSON（已重试） */
 | "invalid-json"
/** JSON 合法但不过 schema 校验（已重试） */
 | "schema"
/** 其他异常 */
 | "error";
export type LlmResult = {
    ok: true;
    json: unknown;
    model: string;
    cached: boolean;
} | {
    ok: false;
    reason: LlmFailureReason;
    message: string;
};
export interface LlmPort {
    readonly id: LlmProviderId;
    /** 通道是否就绪（无密钥、未配置时返回 false，调用方据此降级） */
    isAvailable(): Promise<boolean>;
    /** 发起一次结构化调用；**永不抛异常** */
    complete(spec: LlmCallSpec): Promise<LlmResult>;
}
/**
 * DeepSeek 系模型 JSON 模式的**隐藏硬约束**：`messages` 中必须出现 `json` 字样
 * （不区分大小写），否则即使声明了 `response_format: { type: 'json_object' }`，
 * 模型也可能返回空内容或一段无关结构的纯文本。
 *
 * **实测（2026-09-07，`deepseek-v4-flash`）**：
 * - prompt 含 `json` → 正确返回 `{"tasks":[…]}`；
 * - prompt 不含 `json` → 返回 `{"thoughts":[…],"response":""}`，
 *   过不了 schema 校验，且耗时从 ~10s 涨到 ~125s（模型在"思考"该输出什么）。
 *
 * 该约束对调用方完全不可见（改 prompt 时极易无意破坏），故在此统一兜底：
 * 任何一次调用发出前都确保 messages 中含 `json` 关键字。
 */
export declare const JSON_MODE_HINT = "\uFF08\u8BF7\u4E25\u683C\u4EE5 json \u683C\u5F0F\u8F93\u51FA\uFF0C\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u989D\u5916\u6587\u5B57\uFF09";
export interface ChatMessage {
    role: "system" | "user";
    content: string;
}
/** messages 中是否已含 json 关键字（不区分大小写） */
export declare function hasJsonKeyword(messages: ChatMessage[]): boolean;
/** 确保 messages 满足 JSON 模式约束：缺 `json` 关键字时补在 system 上（无 system 则新增一条） */
export declare function ensureJsonMode(messages: ChatMessage[]): ChatMessage[];
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
    bitfun: {
        model: string;
        fallbackModel: string;
    };
    timeoutMs: number;
    /** 每种失败原因的重试次数（不含首次） */
    retryPerModel: number;
    cacheEnabled: boolean;
    /** Desc 生成时喂给 LLM 的 prompt 原文最大字符数 */
    descMaxInputChars: number;
    /** 单次批量调用包含的 Task 数上限 */
    maxTasksPerBatch: number;
}
export declare const DEFAULT_LLM_CONFIG: LlmConfig;
/**
 * 从环境变量取 API Key（架构 §7.3：密钥不落 config、不落日志、不落产物）。
 *
 * @param envName 环境变量名
 * @param env 环境变量源（默认 `process.env`；单测可注入）
 */
export declare function readApiKey(envName: string, env?: Record<string, string | undefined>): string | null;
export interface LlmCache {
    get(key: string): unknown | undefined;
    set(key: string, value: unknown): void;
}
/**
 * FNV-1a 64-bit 同步 hash（无依赖、可在任意 JS 运行时跑）。
 * 仅用于缓存键，不需密码学强度。
 */
export declare function hashInput(x: unknown): string;
/** 构造缓存键（架构 §10.4） */
export declare function makeCacheKey(spec: LlmCallSpec, model: string): string;
/** 内存缓存（默认；进程内去重） */
export declare function createMemoryCache(): LlmCache;
/**
 * 最小 schema 校验（只查顶层 type 与 required）。
 * 刻意不做完整 JSON Schema 实现 —— 本阶段的输出契约都很简单，过度设计反成负担。
 */
export declare function validateJson(json: unknown, schema: JsonSchema): string | null;
