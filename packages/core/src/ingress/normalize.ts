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

/**
 * 工具入参中的目标文件路径候选键（按优先级）。
 * 覆盖 Bitfun/Claude Code 风格（file_path / target_file）与常见变体。
 */
const TOOL_TARGET_KEYS = [
  "file_path",
  "filePath",
  "filepath",
  "target_file",
  "targetFile",
  "notebook_path",
  "abs_path",
  "path",
  "filename",
  "target",
  "file",
];

/** 排除明显不是文件路径的值（命令串、含 shell 元字符、纯文件名无分隔符） */
function looksLikePath(v: string): boolean {
  if (!v.includes("/") && !v.includes("\\")) return false;
  // 命令串（含空格 + shell 元字符）不当作路径
  if (/[|;&><]/.test(v)) return false;
  return true;
}

/**
 * 从 `agentToolUse.toolInput` 提取**全部**工具目标文件路径候选。
 *
 * @see extractToolTargetFile 单值版本（取首个候选）
 */
export function extractToolTargetFiles(toolInput: unknown): string[] {
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return [];
  }
  const rec = toolInput as Record<string, unknown>;
  const out: string[] = [];
  for (const k of TOOL_TARGET_KEYS) {
    const v = rec[k];
    if (typeof v === "string" && looksLikePath(v)) out.push(v);
  }
  return out;
}

/**
 * 从 `agentToolUse.toolInput` 提取工具目标文件路径（架构 §5.2.1 `object.uri` 语义归一）。
 *
 * **背景**：P1 把 `toolName` 直接塞进 `object.uri`，导致该字段语义随 action 漂移
 * （文件 uri / sessionId / processId / toolName 混用），下游无法按 uri 做文件聚类。
 * 归位后：`panel` 类型的 `object.uri` 一律表示"工具目标文件"，解析不出则为 `undefined`。
 *
 * @returns 目标文件路径（首个候选）；无候选或全部不似路径时返回 null
 */
export function extractToolTargetFile(toolInput: unknown): string | null {
  return extractToolTargetFiles(toolInput)[0] ?? null;
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

/**
 * 单事件 → Behavior（不含 id/prId/seq，由 bridge 填充）。
 *
 * **返回 null = 丢弃该事件**（D-019）：如 `cmd` 为空串/纯空白的 `terminalCommand`
 * （终端回显、换行被误判为命令执行）。调用方须处理 null 并计入 `dropped:*`。
 */
export function toBehavior(
  evt: CreditRawEvent,
  prId: string,
  seq: number,
  cfg: Partial<CreditConfig> & { source?: string } = DEFAULT_CREDIT_CONFIG,
): Behavior | null {
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
    case "terminalCommand": {
      // D-019：空 cmd / 纯空白 cmd 直接丢弃，不产出 Behavior
      if (typeof evt.cmd !== "string" || !evt.cmd.trim()) return null;
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
    }
    case "fileRenamed":
      return {
        ...base,
        object: { kind: "file", uri: evt.newUri, role: role(evt.newUri) },
        context: { ...base.context, before: evt.oldUri },
      };
    case "promptSubmitted":
      return {
        ...base,
        // §5.2.1：dialog.uri = sessionId（语义正确，保持不变）
        object: { kind: "dialog", uri: evt.sessionId },
        context: {
          ...base.context,
          promptText: evt.promptText,
          // 归位：sessionId 此前仅存在于 uri，下游（Task 切分 S1 信号）无法按字段消费
          sessionId: evt.sessionId,
        },
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
          sessionId: evt.sessionId ?? undefined,
        },
      };
    case "agentToolUse": {
      const target = extractToolTargetFile(evt.toolInput);
      return {
        ...base,
        object: {
          kind: "panel",
          // §5.2.1 归位：**禁止**再把 toolName 塞进 uri；
          // panel.uri 表示"工具目标文件"，解析不出则不填
          ...(target ? { uri: target, role: role(target) } : {}),
        },
        context: {
          ...base.context,
          sessionId: evt.sessionId,
          toolName: evt.toolName,
          // 原样透传，不裁剪 —— 算法 §2.6（AI 触发命令识别）与 B-010（合成 AI 编辑）依赖
          toolInput: evt.toolInput ?? null,
          exitCode: evt.exitCode ?? null,
          output: evt.outputSummary ?? null,
        },
      };
    }
    case "agentMessage":
      return {
        ...base,
        object: { kind: "dialog", uri: evt.sessionId },
        context: {
          ...base.context,
          after: evt.text,
          sessionId: evt.sessionId,
        },
      };
    case "reviewEvent":
      return {
        ...base,
        object: { kind: "panel", uri: evt.reviewId },
      };
  }
}
