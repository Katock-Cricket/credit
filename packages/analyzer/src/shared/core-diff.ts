/**
 * C5 · 核心 Diff 行集（算法 §2.5）。
 *
 * 1. 文件级排除（`coreFileExcludePatterns`）—— 锁文件/产物/快照不承载可读语义；
 * 2. 行级过滤：新增行中剔除**空行与纯符号行**（`{ } ( ) ; ,` 等），否则会稀释
 *    「阅读覆盖 PR / 编辑覆盖 PE」的分母，让认真审阅的人显得比例很低；
 * 3. AI 行标记集：`userAccept` 触及的行先归 AI，Dev 后续编辑的行再移出到 Dev 集
 *    —— 这是「编辑覆盖 PE」能区分"只看不改"与"真的动手改"的关键。
 *
 * **git 不可用时返回空集**，调用方按 §5.4 降级为 excluded / degraded，**绝不伪造**。
 */
import type { Behavior } from "@credit/protocol";
import type { CoreDiffLineSet, GitDiffSnapshot } from "../credit/types.js";
import { isMeaningfulLine } from "./diff-parser.js";
import { collectFileUris, normUri, resolveGitUri } from "./uri.js";

/** 极简 glob：支持 `**`（跨分隔）与 `*`（段内），够用于排除规则 */
export function matchGlob(uri: string, pattern: string): boolean {
  const norm = uri.replace(/\\/g, "/");
  const esc = pattern
    .replace(/\\/g, "/")
    .replace(/[.+^${}()|[\]]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000") // **/ → 占位
    .replace(/\*\*/g, "\u0001") // 裸 ** → 占位
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?")
    .replace(/\u0001/g, ".*");
  return new RegExp(`^${esc}$`).test(norm);
}

export function isExcludedFile(uri: string, patterns: string[]): boolean {
  return patterns.some((p) => matchGlob(uri, p));
}

function lineRangeOf(b: Behavior): [number, number] | null {
  const lr = b.object?.lineRange;
  if (Array.isArray(lr) && lr.length === 2) {
    const a = Number(lr[0]);
    const c = Number(lr[1]);
    if (Number.isFinite(a) && Number.isFinite(c)) return a <= c ? [a, c] : [c, a];
  }
  // edit 行为可能只在 context.diff 里带行信息
  const diff = b.context?.diff;
  if (Array.isArray(diff)) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const h of diff) {
      const hunk = h as { startLine?: number; endLine?: number };
      const s = Number(hunk.startLine);
      const e = Number(hunk.endLine);
      if (Number.isFinite(s) && Number.isFinite(e)) {
        lo = Math.min(lo, s);
        hi = Math.max(hi, e);
      }
    }
    if (lo <= hi) return [lo, hi];
  }
  return null;
}

/**
 * 构建核心 Diff 行集。
 *
 * **uri 对齐**：git 输出的是仓库相对路径，而阅读轨迹/编辑行为以 behaviors 的
 * 绝对 uri 为 key。若不先对齐，后续 `traceOf(coreDiffUri)` 全部落空 → 验视三指标恒为 0。
 */
export function buildCoreDiff(
  git: GitDiffSnapshot,
  behaviors: Behavior[],
  cfg: { coreFileExcludePatterns: string[] },
): CoreDiffLineSet {
  const out: CoreDiffLineSet = {
    files: {},
    totalCoreNew: 0,
    totalCoreAll: 0,
    aiLines: {},
    devEditedLines: {},
  };
  if (!git.available || !git.files) return out;

  const knownUris = collectFileUris(behaviors);

  for (const raw of git.files) {
    const f = { ...raw, uri: resolveGitUri(raw.uri, knownUris) };
    if (isExcludedFile(f.uri, cfg.coreFileExcludePatterns)) continue;
    const lines = f.addedLines ?? [];
    const texts = f.addedTexts ?? [];
    const core: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const text = texts[i] ?? ""; // 无内容时不过滤（保守：宁可多算）
      if (texts.length > 0 && !isMeaningfulLine(text)) continue;
      core.push(lines[i]!);
    }
    out.files[f.uri] = { coreNewLines: core, totalAdded: f.added, totalDeleted: f.deleted };
    out.totalCoreNew += core.length;
    out.totalCoreAll += f.added + f.deleted;
  }

  // AI 行标记集 + Dev 编辑行
  const ai = new Map<string, Set<number>>();
  const dev = new Map<string, Set<number>>();
  const coreOf = (uri: string): Set<number> => {
    // 先精确命中，再按归一化兜底（behaviors 里可能仍存在形态差异，如 file:// 编码）
    const direct = out.files[uri];
    if (direct) return new Set(direct.coreNewLines);
    let hit: string | undefined;
    for (const k of Object.keys(out.files)) {
      if (normUri(k) === normUri(uri)) {
        hit = k;
        break;
      }
    }
    return new Set(hit ? out.files[hit]!.coreNewLines : []);
  };

  for (const b of behaviors) {
    if (b.object?.kind !== "file") continue;
    const uri = b.object.uri;
    if (!uri) continue;
    const core = coreOf(uri);
    if (core.size === 0) continue;
    const range = lineRangeOf(b);
    if (!range) continue;

    const hit: number[] = [];
    for (let i = range[0]; i <= range[1]; i++) if (core.has(i)) hit.push(i);
    if (hit.length === 0) continue;

    const isAi = b.actor === "ai";
    const isAccept = b.action === "accept";
    if (isAi || isAccept) {
      const s = ai.get(uri) ?? new Set<number>();
      for (const l of hit) s.add(l);
      ai.set(uri, s);
    }
    if (b.action === "edit" && !isAi) {
      const s = dev.get(uri) ?? new Set<number>();
      for (const l of hit) s.add(l);
      dev.set(uri, s);
    }
  }

  // Dev 编辑过的行从 AI 集中移出（算法 §2.5）
  for (const [uri, devSet] of dev) {
    const aiSet = ai.get(uri);
    if (aiSet) for (const l of devSet) aiSet.delete(l);
  }

  for (const [uri, s] of ai) out.aiLines[uri] = [...s].sort((a, b) => a - b);
  for (const [uri, s] of dev) out.devEditedLines[uri] = [...s].sort((a, b) => a - b);

  return out;
}
