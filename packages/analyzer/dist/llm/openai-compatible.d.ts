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
/** 从响应文本中取出模型输出内容（兼容纯 JSON 响应与 ```json 围栏） */
export declare function extractContent(rawText: string): string | null;
export declare function createOpenAILlmPort(opts: OpenAILlmOptions): LlmPort;
