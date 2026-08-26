/**
 * 会话状态机（架构 §5.2 / §3.2，协议侧定义类型）。
 * 状态语义：idle → recording → computing → committed
 */
import type { Timestamp } from "./raw-event.js";

export type SessionState = "idle" | "recording" | "computing" | "committed";

export const SESSION_STATE_TRANSITIONS: Record<SessionState, SessionState[]> = {
  idle: ["recording"],
  recording: ["computing", "idle"],
  computing: ["committed", "recording"],
  committed: ["idle"],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return SESSION_STATE_TRANSITIONS[from].includes(to);
}

export interface PrSession {
  prId: string;
  state: SessionState;
  startedAt: Timestamp;
  endedAt?: Timestamp | null;
  /** 已落盘 Behavior 序列号（单调） */
  seq: number;
  /** 当前分支/commit 等上下文（可选） */
  branch?: string | null;
  commitMsg?: string | null;
  /** 累计采集计数（按源分类，冒烟比对用） */
  counts: Record<string, number>;
}
