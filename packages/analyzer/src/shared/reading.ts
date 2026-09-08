/**
 * C4 · 阅读行为判定（算法 §2.4 / §2.5 的阅读侧）。
 *
 * 输入：`file.scroll`（viewport 行区间 + dwellMs）、`view`/`file.open`、`cursor`。
 * 输出按文件索引的「已阅读行并集 + 累计 dwell + 光标停留行」。
 *
 * **uri 形态治理（关键）**：同一个文件在宿主里会以多种形态出现 ——
 * `D:/W/a.rs`、`d:/W/a.rs`（file:// 解码后）、`src/a.rs`（仓库相对）、
 * `inmemory://diff-modified/<ts>/D%3A/W/a.rs`（**Bitfun 的 Diff 查看器**）。
 * 初版按原始 uri 建索引，导致同一文件的阅读轨迹被切碎到 4 个 key，
 * 每个 key 只剩一部分行号 → 覆盖率算出来是 0。
 *
 * 故此处**以归一化 uri 作为索引 key**（大小写与分隔符免疫），
 * `trace.uri` 保留可读形态供展示。
 *
 * **fidelity**：`scrollKeepSequence=false` 时无完整 viewport 序列，
 * 以 `scrollAvailable` 标记；`file.scroll` 为 0 时只能以光标窗近似，调用方须据此降级。
 */
import type { Behavior } from "@credit/protocol";
import type { ReadingTraceIndex, ReadingTrace } from "../credit/types.js";
import { canonicalUri, normUri, buildUriAlias } from "./uri.js";

/** 计入"阅读"的动作（cursor 单独处理） */
const READ_ACTIONS = new Set(["view", "file.scroll", "file.open"]);

function lineRangeOf(b: Behavior): [number, number] | null {
  const lr = b.object?.lineRange;
  if (!Array.isArray(lr) || lr.length !== 2) return null;
  const a = Number(lr[0]);
  const c = Number(lr[1]);
  if (!Number.isFinite(a) || !Number.isFinite(c)) return null;
  return a <= c ? [a, c] : [c, a];
}

export function buildReadingTrace(
  behaviors: Behavior[],
  cfg: { readDwellMs: number },
): ReadingTraceIndex {
  const byUri: Record<string, ReadingTrace> = {};
  const readSets = new Map<string, Set<number>>();
  const cursorSets = new Map<string, Set<number>>();
  let scrollCount = 0;

  // 相对路径形态 → 归并到绝对路径（用于展示名）
  const rawUris = behaviors
    .filter((b) => b.object?.kind === "file" && b.object?.uri)
    .map((b) => b.object!.uri!);
  const alias = buildUriAlias(rawUris);

  for (const b of behaviors) {
    if (b.object?.kind !== "file") continue;
    const raw = b.object.uri ?? "";
    if (!raw) continue;

    if (b.action === "file.scroll") scrollCount++;

    /** 索引 key：大小写与分隔符免疫 */
    const key = normUri(raw);
    /** 展示名：归并后的可读路径 */
    const display = alias.get(raw) ?? canonicalUri(raw);

    let trace = byUri[key];
    if (!trace) {
      trace = { uri: display, dwellMs: 0, readLines: [], cursorLines: [] };
      byUri[key] = trace;
      readSets.set(key, new Set());
      cursorSets.set(key, new Set());
    }

    const dwell = Number(b.context?.dwellMs ?? 0) || 0;
    const range = lineRangeOf(b);

    if (READ_ACTIONS.has(b.action)) {
      trace.dwellMs += dwell;
      if (range) {
        const set = readSets.get(key)!;
        for (let i = range[0]; i <= range[1]; i++) set.add(i);
      }
    } else if (b.action === "cursor") {
      trace.dwellMs += dwell;
      if (range && dwell >= cfg.readDwellMs) {
        const set = cursorSets.get(key)!;
        for (let i = range[0]; i <= range[1]; i++) set.add(i);
      }
    }
  }

  for (const key of Object.keys(byUri)) {
    byUri[key]!.readLines = [...(readSets.get(key) ?? [])].sort((a, b) => a - b);
    byUri[key]!.cursorLines = [...(cursorSets.get(key) ?? [])].sort((a, b) => a - b);
  }

  return { byUri, scrollAvailable: scrollCount > 0 };
}

/**
 * 取某文件的阅读轨迹（无则返回空轨）。
 *
 * 匹配顺序：归一化精确 → **后缀匹配**（查询用仓库相对路径时，
 * 也能命中以它结尾的绝对路径，如 `src/a.rs` → `D:/W/src/a.rs`）。
 */
export function traceOf(idx: ReadingTraceIndex, uri: string): ReadingTrace {
  const n = normUri(uri);
  const direct = idx.byUri[n];
  if (direct) return direct;

  for (const k of Object.keys(idx.byUri)) {
    if (k === n || k.endsWith(`/${n}`)) return idx.byUri[k]!;
  }
  return { uri, dwellMs: 0, readLines: [], cursorLines: [] };
}
