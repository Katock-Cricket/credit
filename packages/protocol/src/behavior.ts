/**
 * Behavior 模型（架构 §5.2）。归一化结果，供 analyzer 消费。
 */
import type { Fidelity } from "./version.js";
import type { Timestamp } from "./raw-event.js";

/** 文件身份识别器标注（详见算法方案文件身份识别器） */
export type ObjectRole =
  | "spec"
  | "test"
  | "test-plan"
  | "source"
  | "config"
  | "unknown";

/** 归一化动作枚举 */
export type Action =
  | "edit"
  | "cursor"
  | "view"
  | "file.open"
  | "terminal.exec"
  | "prompt.submit"
  | "accept"
  | "agent.tool"
  | "agent.message"
  | "review.open"
  | "review.disposition"
  | "file.rename"
  | "file.scroll";

export interface BehaviorObject {
  kind: "file" | "terminal" | "dialog" | "panel" | "snapshot";
  uri?: string;
  role?: ObjectRole;
  lineRange?: [number, number];
}

export interface BehaviorContext {
  before?: unknown;
  after?: unknown;
  /** 行级 diff hunks：{ op: "insert"|"delete", startLine, endLine, lines[], contextBefore[], contextAfter[] }[] */
  diff?: unknown;
  promptText?: string;
  diffStats?: { file: string; added: number; deleted: number }[] | null;
  dwellMs?: number | null;
  sessionId?: string;
  exitCode?: number | null;
  cmd?: string;
  output?: string | null;
  fidelity?: Fidelity;
}

export interface Behavior {
  id: string; // <prId>-<seq>
  prId: string;
  ts: Timestamp;
  actor: "dev" | "ai";
  action: Action;
  object: BehaviorObject;
  context: BehaviorContext;
  source: string; // 采集桥标识（冒烟 log 比对用）
}

/** 生成 Behavior.id（prId + 递增 seq） */
export function makeBehaviorId(prId: string, seq: number): string {
  return `${prId}-${seq}`;
}
