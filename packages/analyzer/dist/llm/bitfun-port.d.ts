/**
 * BitfunLlmPort —— 宿主 `app.ai.*` 通道（**P4 启用**，本阶段仅预留口子）。
 *
 * 决策 D-023 要求"保留接入 Bitfun LLM 的口子"：本文件即该口子的落点。
 * P4 集成时 MiniApp Worker（`node.enabled = true`）可直接注入本实现，
 * 上层（Task 识别 / 指标计算）零改动，且随即恢复需规 §7「数据不出端」。
 *
 * 宿主 `app.ai.*` 的确切签名以 MiniApp api-reference 为准；此处以最小契约
 * `ai.complete({ system, user, model })` 表达，P4 接入时按实际签名适配本文件即可。
 */
import type { LlmCache, LlmPort } from "./port.js";
/** 宿主 AI 通道的最小契约（P4 按真实 api-reference 对齐） */
export interface BitfunAiLike {
    complete(opts: {
        system: string;
        user: string;
        model?: string;
    }): Promise<{
        text?: string;
    } | string>;
}
export interface BitfunLlmOptions {
    ai: BitfunAiLike | null;
    model?: string;
    /** 失败降级模型（架构：fast → primary） */
    fallbackModel?: string;
    cache?: LlmCache | null;
}
export declare function createBitfunLlmPort(opts: BitfunLlmOptions): LlmPort;
