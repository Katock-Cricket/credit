/**
 * Ingress 归一化（架构 §5.1 / 算法方案 §2）。
 * CreditRawEvent → Behavior。复用 foreshadow 归一化思路（编辑合并、光标滑窗合并、
 * Actor 标注），在 @credit/core/ingress 重新实现（不 import foreshadow 运行时代码，ADR-10）。
 *
 * P1 变更：文件角色识别改为 config-driven（T5，`resolveRole`），规则表不再硬编码。
 */
import type {
  CreditRawEvent,
  Behavior,
  Action,
  ObjectRole,
  Timestamp,
} from "@credit/protocol";
import {
  DEFAULT_CREDIT_CONFIG,
  type CreditConfig,
  type IdentifyRule,
} from "../config.js";
import { resolveRole } from "../identify/file-role.js";

export interface IngressConfig {
  /** 编辑合并时间窗（ms）：同 uri 相邻 textChanged 合并 */
  editMergeWindowMs: number;
  /** 光标停留判定阈值（ms） */
  readDwellMs: number;
  /** 触发源标识（冒烟比对用） */
  source: string;
}

export const DEFAULT_INGRESS_CONFIG: IngressConfig = {
  editMergeWindowMs: DEFAULT_CREDIT_CONFIG.editMergeWindowMs,
  readDwellMs: DEFAULT_CREDIT_CONFIG.readDwellMs,
  source: DEFAULT_CREDIT_CONFIG.source,
};

/**
 * 文件角色识别（P1 T5 起改为 config-driven，规则表见 `DEFAULT_IDENTIFY_RULES`）。
 * 保留导出以兼容既有调用；新代码请用 `resolveRole(uri, rules)` 显式传规则表。
 */
export function roleOf(uri: string, rules?: IdentifyRule[]): ObjectRole {
  return resolveRole(uri, rules ?? DEFAULT_CREDIT_CONFIG.identify.rules);
}

/** Actor 标注（架构 §5.1 注释） */
export function actorOf(evt: CreditRawEvent): "dev" | "ai" {
  switch (evt.type) {
    case "promptSubmitted":
    case "userAccept":
    case "selectionChanged":
    case "activeEditorChanged":
    case "fileRenamed":
    case "terminalCommand":
    case "textScrolled":
      return "dev";
    case "textChanged":
      // 编辑可能来自 agent 工具（Edit/Write 落盘 → 编辑器同步 → textChanged source=agent）
      return evt.source === "agent" ? "ai" : "dev";
    case "agentToolUse":
    case "agentMessage":
      return "ai";
    case "reviewEvent":
      return evt.actor;
    default:
      return "dev";
  }
}

function actionOf(evt: CreditRawEvent): Action {
  switch (evt.type) {
    case "textChanged":
      return "edit";
    case "selectionChanged":
      return evt.kind === "cursor" ? "cursor" : "view";
    case "activeEditorChanged":
      return "view";
    case "fileOpened":
      return "file.open";
    case "textScrolled":
      return "file.scroll";
    case "terminalCommand":
      return "terminal.exec";
    case "fileRenamed":
      return "file.rename";
    case "promptSubmitted":
      return "prompt.submit";
    case "userAccept":
      return "accept";
    case "agentToolUse":
      return "agent.tool";
    case "agentMessage":
      return "agent.message";
    case "reviewEvent":
      return evt.disposition ? "review.disposition" : "review.open";
  }
}

/** 单事件 → Behavior（不含 id/prId/seq，由 bridge 填充） */
export function toBehavior(
  evt: CreditRawEvent,
  prId: string,
  seq: number,
  cfg: Partial<CreditConfig> & { source?: string } = DEFAULT_CREDIT_CONFIG,
): Behavior {
  const actor = actorOf(evt);
  const action = actionOf(evt);
  const ts = (evt as { ts: Timestamp }).ts;
  const source = cfg.source ?? DEFAULT_CREDIT_CONFIG.source;
  const rules = cfg.identify?.rules ?? DEFAULT_CREDIT_CONFIG.identify.rules;
  /** 按配置规则表解析文件角色（AGENTS §9：规则不硬编码） */
  const role = (u: string): ObjectRole => resolveRole(u, rules);

  const fidelity =
    "fidelity" in evt ? (evt.fidelity as Behavior["context"]["fidelity"]) : undefined;

  const base: Behavior = {
    id: `${prId}-${seq}`,
    prId,
    ts,
    actor,
    action,
    object: { kind: "file" },
    context: { fidelity },
    source,
  };

  switch (evt.type) {
    case "textChanged":
      return {
        ...base,
        object: { kind: "file", uri: evt.uri, role: role(evt.uri) },
        context: {
          ...base.context,
          before: evt.beforeText,
          after: evt.afterText,
          // 行级 diff hunks（op/startLine/endLine/lines/contextBefore/contextAfter）
          diff: (evt as { changes?: unknown }).changes ?? null,
        },
      };
    case "selectionChanged":
      return {
        ...base,
        object: {
          kind: "file",
          uri: evt.uri,
          role: role(evt.uri),
          lineRange: [evt.line, evt.line],
        },
        context: {
          ...base.context,
          dwellMs: evt.dwellMs ?? null,
        },
      };
    case "activeEditorChanged":
      return {
        ...base,
        object: { kind: "file", uri: evt.uri, role: role(evt.uri) },
      };
    case "fileOpened":
      return {
        ...base,
        object: { kind: "file", uri: evt.uri, role: role(evt.uri) },
      };
    case "textScrolled":
      return {
        ...base,
        object: {
          kind: "file",
          uri: evt.uri,
          role: role(evt.uri),
          lineRange: [evt.viewport.firstLine, evt.viewport.lastLine],
        },
      };
    case "terminalCommand":
      return {
        ...base,
        object: { kind: "terminal", uri: evt.processId },
        context: {
          ...base.context,
          cmd: evt.cmd,
          output: evt.output ?? null,
          exitCode: evt.exitCode ?? null,
        },
      };
    case "fileRenamed":
      return {
        ...base,
        object: { kind: "file", uri: evt.newUri, role: role(evt.newUri) },
        context: { ...base.context, before: evt.oldUri },
      };
    case "promptSubmitted":
      return {
        ...base,
        object: { kind: "dialog", uri: evt.sessionId },
        context: { ...base.context, promptText: evt.promptText },
      };
    case "userAccept":
      return {
        ...base,
        object: {
          kind: evt.kind === "session" ? "snapshot" : "file",
          uri: evt.fileUris[0],
        },
        context: {
          ...base.context,
          diffStats: evt.diffStats ?? null,
        },
      };
    case "agentToolUse":
      return {
        ...base,
        object: { kind: "panel", uri: evt.toolName },
        context: {
          ...base.context,
          exitCode: evt.exitCode ?? null,
          output: evt.outputSummary ?? null,
        },
      };
    case "agentMessage":
      return {
        ...base,
        object: { kind: "dialog", uri: evt.sessionId },
        context: { ...base.context, after: evt.text },
      };
    case "reviewEvent":
      return {
        ...base,
        object: { kind: "panel", uri: evt.reviewId },
      };
  }
}
