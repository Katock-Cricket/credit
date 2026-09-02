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
import type { LlmCallSpec, LlmCache, LlmPort, LlmResult } from "./port.js";
import { makeCacheKey, validateJson } from "./port.js";

/** 宿主 AI 通道的最小契约（P4 按真实 api-reference 对齐） */
export interface BitfunAiLike {
  complete(opts: {
    system: string;
    user: string;
    model?: string;
  }): Promise<{ text?: string } | string>;
}

export interface BitfunLlmOptions {
  ai: BitfunAiLike | null;
  model?: string;
  /** 失败降级模型（架构：fast → primary） */
  fallbackModel?: string;
  cache?: LlmCache | null;
}

export function createBitfunLlmPort(opts: BitfunLlmOptions): LlmPort {
  const cache = opts.cache ?? null;
  const defaultModel = opts.model ?? "fast";
  const fallbackModel = opts.fallbackModel ?? "primary";

  return {
    id: "bitfun",
    async isAvailable(): Promise<boolean> {
      return !!opts.ai;
    },
    async complete(spec: LlmCallSpec): Promise<LlmResult> {
      const ai = opts.ai;
      if (!ai) {
        return {
          ok: false,
          reason: "unavailable",
          message: "BitfunLlmPort：未注入 app.ai（P4 前预期如此）",
        };
      }
      const model = spec.model ?? defaultModel;

      if (cache) {
        const hit = cache.get(makeCacheKey(spec, model));
        if (hit !== undefined) return { ok: true, json: hit, model, cached: true };
      }

      // 降级链：fast → primary（架构 §7.2 / 算法 §2.8）
      for (const m of [model, fallbackModel]) {
        try {
          const res = await ai.complete({ system: spec.system, user: spec.user, model: m });
          const text = typeof res === "string" ? res : (res?.text ?? "");
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch {
            continue; // 换下一个模型
          }
          const err = validateJson(json, spec.schema);
          if (err) continue;
          if (cache) cache.set(makeCacheKey(spec, model), json);
          return { ok: true, json, model: m, cached: false };
        } catch {
          // 单模型失败 → 尝试降级模型
          continue;
        }
      }

      return {
        ok: false,
        reason: "error",
        message: `BitfunLlmPort：${model} 与 ${fallbackModel} 均失败`,
      };
    },
  };
}
