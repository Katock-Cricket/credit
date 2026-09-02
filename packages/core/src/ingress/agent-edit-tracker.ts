/**
 * Agent 编辑回溯关联（P0 §R-actor；P2-pre 从 `core/index.ts` 抽出以支持 raw 重放）。
 *
 * **背景**：前端 `textChanged` 由 agent 写盘 → 编辑器异步 reload 触发，往往**晚于**
 * `agentToolUse`，导致实时 `source` 判定失效。此处维护"agent 近期编辑过的文件 + 时间戳"，
 * `textChanged` 到达时回溯窗口匹配，命中则强制 `source="agent"`（actor=ai）。
 *
 * **为何抽出**：T2 的 raw 重放必须与实时采集走**完全相同的判定逻辑**，否则重放结果
 * 与实时落盘产生偏差，重放就失去意义。抽成独立模块后两边共用一份实现。
 */
import type { CreditConfig } from "../config.js";
import { extractToolTargetFiles } from "./normalize.js";

/** uri 归一化：去 file:// 协议、统一斜杠、小写、去尾部斜杠 */
export function normalizeUri(u: string): string {
  return String(u ?? "")
    .replace(/^file:\/\//i, "")
    .replace(/\\/g, "/")
    .toLowerCase()
    .replace(/\/+$/, "");
}

export interface AgentEditTracker {
  /** 从 `agentToolUse` 登记其涉及的文件（可能多个） */
  recordFromToolUse(toolInput: unknown, ts: number): void;
  /** 该文件在回溯窗口内是否被 agent 编辑过 */
  isAgentEdited(uri: string, ts: number): boolean;
}

export function createAgentEditTracker(
  cfg: Pick<CreditConfig, "agentEditLookupMs">,
): AgentEditTracker {
  /** normalizedUri -> 近期编辑时间戳列表 */
  const recent = new Map<string, number[]>();
  const windowMs = cfg.agentEditLookupMs;

  return {
    recordFromToolUse(toolInput: unknown, ts: number): void {
      for (const raw of extractToolTargetFiles(toolInput)) {
        const k = normalizeUri(raw);
        if (!k) continue;
        const arr = recent.get(k) ?? [];
        arr.push(ts);
        const cutoff = ts - windowMs;
        recent.set(
          k,
          arr.filter((t) => t >= cutoff),
        );
      }
    },

    isAgentEdited(uri: string, ts: number): boolean {
      const arr = recent.get(normalizeUri(uri));
      if (!arr || arr.length === 0) return false;
      const cutoff = ts - windowMs;
      return arr.some((t) => t >= cutoff);
    },
  };
}
