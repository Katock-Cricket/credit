/**
 * 当前 PR 关键词提取（算法 §5.1 步骤1，决策 D-042）。
 *
 * **共享产物纪律**：提取结果写入 pr_credit（`profileFeed.profileKeywords`），
 * 本地增量更新（F2）与 Dev_Credit 计分共用 —— 同一 PR 只提取一次。
 *
 * 输入：Task.Desc 集合 + gitDiff 文件语言分布。LLM 失败 → 规则降级
 * （扩展名→语言映射 top3，ok=false 由调用方标记）。
 */
import { llmJson } from "../shared/llm-json.js";
import type { LlmPort } from "../llm/port.js";
import type { GitDiffSnapshot } from "../credit/types.js";
import type { Task } from "../task/types.js";

export interface PrKeywordsResult {
  /** false = LLM 失败走规则降级（keywords 仍可用，但调用方应标记降级） */
  ok: boolean;
  keywords: string[];
  rationale: string;
}

const SYS = `你是技术关键词提取助手。给定一次 PR 的任务描述集合与文件语言分布，提取本次 PR 涉及的
技术关键词（框架 / 语言 / 领域词，如 "React" "数据库" "鉴权"）。

要求：
1. 最多 10 个，每个不超过 24 字符，使用通用写法（英文技术词保持英文）；
2. 只提取与本次修改实质相关的词，不要泛化（不要 "开发" "测试" 这类通用词）。

只输出 json，字段名必须严格如下：{"keywords":["TypeScript","WebSocket"]}`;

/** 扩展名 → 语言（规则降级链） */
const EXT_LANG: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript",
  rs: "Rust", go: "Go", py: "Python", java: "Java", cs: "C#", cpp: "C++", cc: "C++", h: "C++",
  c: "C", php: "PHP", rb: "Ruby", swift: "Swift", kt: "Kotlin", scala: "Scala",
  vue: "Vue", svelte: "Svelte", html: "HTML", css: "CSS", scss: "CSS", sql: "SQL",
  sh: "Shell", ps1: "PowerShell", md: "Markdown", json: "JSON", yaml: "YAML", yml: "YAML",
};

function extOf(uri: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(String(uri ?? ""));
  return m ? m[1]!.toLowerCase() : "";
}

/** gitDiff 的语言分布（按文件数），供 LLM 输入与规则降级 */
export function languageDistribution(gitDiff: GitDiffSnapshot | undefined): Array<[string, number]> {
  const count = new Map<string, number>();
  for (const f of gitDiff?.files ?? []) {
    const lang = EXT_LANG[extOf(f.uri)];
    if (lang) count.set(lang, (count.get(lang) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
}

function dedupeKeywords(list: unknown, max = 10): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const k = String(raw ?? "").trim().slice(0, 24);
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
    if (out.length >= max) break;
  }
  return out;
}

export async function extractPrKeywords(opts: {
  tasks: Task[];
  gitDiff?: GitDiffSnapshot;
  llm: LlmPort;
}): Promise<PrKeywordsResult> {
  const descs = opts.tasks
    .map((t) => String(t.desc ?? "").trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((d) => `- ${d.slice(0, 200)}`);
  const langs = languageDistribution(opts.gitDiff);
  const langText = langs.slice(0, 6).map(([l, n]) => `${l}×${n}`).join("、") || "（无 git diff）";

  const user =
    `本次 PR 的任务描述：\n${descs.join("\n") || "（无 Task 描述）"}\n\n` +
    `文件语言分布：${langText}\n\n请提取技术关键词。`;

  const r = await llmJson<{ keywords?: string[] }>(opts.llm, {
    metricId: "pr-keywords",
    templateId: "pr-keywords-v1",
    system: SYS,
    user,
    schema: { type: "object" },
  });

  if (r.ok && r.data) {
    const keywords = dedupeKeywords((r.data as { keywords?: unknown }).keywords);
    if (keywords.length > 0) return { ok: true, keywords, rationale: "LLM 提取" };
  }

  // 规则降级：语言分布 top3（弱关键词，但可用）
  const fallback = langs.slice(0, 3).map(([l]) => l);
  return {
    ok: false,
    keywords: fallback,
    rationale: r.ok ? "LLM 返回为空，按语言分布降级" : `LLM 失败（${r.rationale}），按语言分布降级`,
  };
}
