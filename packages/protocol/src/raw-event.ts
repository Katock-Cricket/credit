/**
 * CreditRawEvent 协议（架构 §5.1）。
 * 复用 foreshadow RawHostEvent 五类 + CREDIT 扩展 + textScrolled（v0.2 新增）。
 * 字段按 Rust 可提供的最大集超集定义（D2）；前端不可得置 null。
 */
import type { Fidelity } from "./version.js";

/** 毫秒时间戳统一由采集侧填充 */
export type Timestamp = number;

/** 复用 foreshadow 的宿主事件（桥侧可直接透传） */
export type ReusedEvent =
  | TextChangedEvent
  | SelectionChangedEvent
  | ActiveEditorChangedEvent
  | FileRenamedEvent
  | TerminalCommandEvent
  | TextScrolledEvent
  | FileOpenedEvent;

export interface TextChangedEvent {
  type: "textChanged";
  uri: string;
  changes: unknown; // 编辑变更描述（透传宿主结构）
  beforeText?: string | null;
  afterText?: string | null;
  source?: "user" | "agent"; // 区分人工编辑与 agent 工具编辑（默认 user）
  ts: Timestamp;
  fidelity?: Fidelity;
}

export interface SelectionChangedEvent {
  type: "selectionChanged";
  uri: string;
  kind: "cursor" | "select";
  line: number;
  column: number;
  selection?: string | null;
  dwellMs?: number | null;
  ts: Timestamp;
  fidelity?: Fidelity;
}

export interface ActiveEditorChangedEvent {
  type: "activeEditorChanged";
  uri: string;
  editorKind: "monaco" | "tiptap";
  ts: Timestamp;
  fidelity?: Fidelity;
}

/** 文档被打开（dev 或 agent 打开文件） */
export interface FileOpenedEvent {
  type: "fileOpened";
  uri: string;
  ts: Timestamp;
  fidelity?: Fidelity;
}

export interface FileRenamedEvent {
  type: "fileRenamed";
  oldUri: string;
  newUri: string;
  ts: Timestamp;
  fidelity?: Fidelity;
}

export interface TerminalCommandEvent {
  type: "terminalCommand";
  processId: string;
  cmd: string;
  output?: string | null;
  phase: "start" | "end";
  exitCode?: number | null;
  ts: Timestamp;
  fidelity?: Fidelity;
}

/** CREDIT 新增（v0.2）：Monaco onDidScrollChange / TipTap scroll 节流 200ms */
export interface TextScrolledEvent {
  type: "textScrolled";
  uri: string;
  viewport: { firstLine: number; lastLine: number };
  editorKind: "monaco" | "tiptap";
  ts: Timestamp;
  fidelity?: Fidelity;
}

/** CREDIT 扩展事件（P0 新增；字段超集，前端不可得置 null） */
export type CreditEvent =
  | PromptSubmittedEvent
  | AgentToolUseEvent
  | AgentMessageEvent
  | UserAcceptEvent
  | ReviewEvent;

export interface PromptSubmittedEvent {
  type: "promptSubmitted";
  sessionId: string;
  promptText: string;
  attachmentRefs?: string[] | null;
  fidelity: Fidelity;
  ts: Timestamp;
}

export interface AgentToolUseEvent {
  type: "agentToolUse";
  sessionId: string;
  toolName: string;
  toolInput?: unknown;
  outputSummary?: string | null;
  exitCode?: number | null;
  phase: "start" | "end";
  durationMs?: number | null;
  fidelity: Fidelity;
  ts: Timestamp;
}

export interface AgentMessageEvent {
  type: "agentMessage";
  sessionId: string;
  role: "assistant";
  text: string;
  isPlanHint?: boolean;
  fidelity: Fidelity;
  ts: Timestamp;
}

export interface UserAcceptEvent {
  type: "userAccept";
  kind: "file" | "block" | "session";
  snapshotId?: string | null;
  fileUris: string[];
  diffStats?: { file: string; added: number; deleted: number }[] | null;
  totalAdded?: number | null;
  totalDeleted?: number | null;
  sessionId?: string | null;
  fidelity: Fidelity;
  ts: Timestamp;
}

export interface ReviewEvent {
  type: "reviewEvent";
  reviewId: string;
  revision: number;
  findingId?: string | null;
  disposition?: string | null;
  actor: "dev" | "ai";
  fidelity: Fidelity;
  ts: Timestamp;
}

/** 协议联合类型 */
export type CreditRawEvent = ReusedEvent | CreditEvent;

/** 判别联合类型 */
export function isCreditRawEvent(x: unknown): x is CreditRawEvent {
  if (typeof x !== "object" || x === null) return false;
  const t = (x as { type?: unknown }).type;
  return typeof t === "string";
}
