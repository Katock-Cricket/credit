/**
 * 行为明细的内容摘要（P2-pre）。
 *
 * 原实现只取 `context.promptText ?? cmd ?? uri ?? toolName ?? after`，
 * 导致除 `dev:prompt` 外几乎所有行都是空的（用户反馈"显得很空"）。
 * 这里按 action 提取该动作**真正有信息量**的内容：
 *
 * | action | 内容 |
 * | --- | --- |
 * | `prompt.submit` | Prompt 原文 |
 * | `edit` | diff 变更行（无 diff 时 before → after） |
 * | `terminal.exec` | 命令 + 输出 |
 * | `agent.tool` | 工具名 + 入参要点 + 输出要点 |
 * | `agent.message` | AI 输出文本 |
 * | 文件类 | 文件名 + 行范围 |
 */

const DEFAULT_MAX_CHARS = 120;

/** 压平空白并截断（超出加省略号），另返回全文供 title 悬浮 */
function flatten(s, maxChars) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > maxChars ? `${t.slice(0, maxChars)}…` : t;
}

function basename(uri) {
  return String(uri ?? "").split(/[\\/]/).pop() || String(uri ?? "");
}

/** edit：把 diff hunks 压成一行「+ 新增行 / - 删除行」 */
function diffSummary(ctx) {
  const diff = ctx?.diff;
  if (Array.isArray(diff) && diff.length > 0) {
    const parts = [];
    for (const h of diff.slice(0, 4)) {
      const op = h?.op === "delete" ? "-" : h?.op === "insert" ? "+" : "~";
      const lines = Array.isArray(h?.lines) ? h.lines : [];
      for (const l of lines.slice(0, 3)) parts.push(`${op} ${String(l).trim()}`);
    }
    if (parts.length > 0) return parts.join(" | ");
  }
  const before = ctx?.before;
  const after = ctx?.after;
  if (before || after) {
    return `${flatten(before, 60)} -> ${flatten(after, 60)}`;
  }
  return "";
}

/** 工具入参：挑几个常见键，避免整坨 JSON */
function toolInputSummary(input) {
  if (!input || typeof input !== "object") return "";
  const pick = (k) => (typeof input[k] === "string" ? input[k] : undefined);
  const preferred =
    pick("cmd") ??
    pick("command") ??
    pick("pattern") ??
    pick("path") ??
    pick("file_path") ??
    pick("query") ??
    pick("description");
  if (preferred) return preferred;
  const keys = Object.keys(input).slice(0, 3);
  return keys.map((k) => `${k}=${flatten(input[k], 20)}`).join(", ");
}

function extract(b) {
  const ctx = b?.context ?? {};
  switch (b?.action) {
    case "prompt.submit":
      return String(ctx.promptText ?? "");
    case "edit":
      return diffSummary(ctx);
    case "terminal.exec": {
      const cmd = String(ctx.cmd ?? "").trim();
      const out = flatten(ctx.output, 80);
      return out ? `${cmd} | ${out}` : cmd;
    }
    case "agent.tool": {
      const name = String(ctx.toolName ?? "");
      const input = toolInputSummary(ctx.toolInput);
      const out = flatten(ctx.output, 60);
      return [name, input, out].filter(Boolean).join(" | ");
    }
    case "agent.message":
      return String(ctx.after ?? "");
    case "file.open":
    case "view":
    case "file.scroll":
    case "cursor": {
      const uri = basename(b?.object?.uri);
      const lr = b?.object?.lineRange;
      if (Array.isArray(lr) && lr.length === 2) return `${uri}:${lr[0]}-${lr[1]}`;
      return uri;
    }
    default:
      return String(ctx.cmd ?? ctx.promptText ?? ctx.after ?? b?.object?.uri ?? "");
  }
}

/**
 * @param {object} b 一条 Behavior
 * @param {{ maxChars?: number }} opts
 * @returns {{ text: string, full: string }} text 为截断后的展示文本，full 为全文（供 title）
 */
export function describeBehavior(b, opts = {}) {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  const raw = extract(b);
  const full = String(raw ?? "").replace(/\s+/g, " ").trim();
  return { text: flatten(raw, maxChars), full };
}
