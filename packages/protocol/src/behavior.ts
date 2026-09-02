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
  /** 合并计数：>1 表示本条由 n 条原始事件合并而来（P1 治理 §3） */
  mergedCount?: number;
  /**
   * P2-pre（架构 §5.2.1 字段归位）：工具名。
   * 此前被误置于 `object.uri`（导致后者语义随 action 漂移），现归位至此。
   */
  toolName?: string;
  /**
   * P2-pre（架构 §5.2.1 字段归位）：工具入参，原样透传不做裁剪。
   * 算法 §2.6 的「AI 触发测试识别」依赖 `toolInput.cmd`；B-010 的未打开文件
   * AI 编辑合成依赖 Edit/Write 的 `old_string`/`new_string`。
   */
  toolInput?: unknown;
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
