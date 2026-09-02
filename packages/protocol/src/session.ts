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
  /**
   * 治理统计（P1 新增，可选）：写入 session.json 使跨进程（MiniApp/原型）可见。
   * 采集桥的内存计数本不落盘，MiniApp 读 session.json 时若无此字段则看不到实时进度。
   */
  stats?: SessionStats;
}

/** 治理层统计（P1 §3） */
export interface SessionStats {
  /** 被识别为基线、未进入数据层输出的事件数（决策 D-007） */
  baseline: number;
  /** 因合并被折叠的事件数 */
  merged: number;
  /** 输出事件数 */
  emitted: number;
}
