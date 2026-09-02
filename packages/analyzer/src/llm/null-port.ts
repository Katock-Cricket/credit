/**
 * NullLlmPort —— 恒不可用（单测与降级验证，决策 D-023）。
 *
 * 用途：
 * 1. 单测：保证离线、零 token、结果确定；
 * 2. 降级验证：把 `provider` 切到 `null` 重跑，确认 Task 识别在完全无 LLM 时
 *    仍正常完成（SPEC §11 退出条件第 4 条）。
 */
import type { LlmCallSpec, LlmPort, LlmResult } from "./port.js";

export function createNullLlmPort(): LlmPort {
  return {
    id: "null",
    async isAvailable(): Promise<boolean> {
      return false;
    },
    async complete(_spec: LlmCallSpec): Promise<LlmResult> {
      return {
        ok: false,
        reason: "unavailable",
        message: "NullLlmPort：通道未启用（单测与降级路径）",
      };
    },
  };
}
