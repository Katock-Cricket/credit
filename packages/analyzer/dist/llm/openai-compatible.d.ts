/**
 * OpenAILlmPort —— 外部 OpenAI 兼容 API（P2-pre/P2 离线计算主用，决策 D-023）。
 *
 * **为何不走 Bitfun 通道**：P2-pre 的计算跑在仓内独立 Node server（`apps/miniapp-prototype`），
 * 拿不到宿主的 `app.ai.*`。本 Provider 与 `bitfun` Provider 实现同一 `LlmPort` 接口，
 * P4 切换只改注入，上层零改动。
 *
 * **纪律**：`complete()` 永不抛异常，一律返回 `LlmResult`。
 *
 * **安全**：密钥运行时从环境变量读取（`config.json` 只存变量名），
 * 且**不写入任何日志、缓存键或产物**（架构 §7.3）。
 */
import type { LlmCache, LlmPort } from "./port.js";
/** 最小 fetch 契约（便于注入替身做单测） */
export type FetchLike = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
}) => Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
}>;
export interface OpenAILlmOptions {
    baseUrl: string;
    model: string;
    /** 环境变量名（默认 OPENAI_API_KEY） */
    apiKeyEnv?: string;
    /** 环境变量源（默认 process.env；单测可注入） */
    env?: Record<string, string | undefined>;
    /** 显式传 key（优先级低于环境变量缺失时的回退；一般不用） */
    apiKey?: string | null;
    timeoutMs?: number;
    /** 重试次数（不含首次） */
    retry?: number;
    cache?: LlmCache | null;
    fetchImpl?: FetchLike;
    sleep?: (ms: number) => Promise<void>;
}
/**
 * 从响应文本中取出模型输出内容。
 *
 * **关键分支纪律**：响应**是**合法 JSON 却取不到 `choices[0].message.content` 时，
 * 必须返回 `null`（判为 `invalid-json`），**不得回退成整个响应体** ——
 * 否则网关的错误响应（`{"error":…}`）会被当成"合法 JSON 只是过不了 schema"，
 * 把**真实故障伪装成 schema 校验失败**，排障时极易误导（2026-09-07 排查所得）。
 *
 * 只有响应**不是**合法 JSON 时（网关错误页等纯文本），才按纯文本处理。
 */
export declare function extractContent(rawText: string): string | null;
/**
 * 宽容 JSON 解析。
 *
 * **为何需要**：即使声明了 `response_format: json_object`，模型仍可能
 * 1. 在 JSON 前后带说明文字（"好的，结果如下：{...}"）；
 * 2. 被输入里的代码带偏，直接续写代码片段（实测：SPEC 里全是 Rust，
 *    模型返回 `rust struct CodecProbeResult {...}`）。
 *
 * 第 1 种可以救回来，第 2 种救不回 —— 但**不应该因此判 error**，
 * 故此处尽力提取平衡的第一个 `{...}` / `[...]`。
 */
export declare function parseLooseJson(text: string): unknown | null;
export declare function createOpenAILlmPort(opts: OpenAILlmOptions): LlmPort;
