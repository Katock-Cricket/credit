/**
 * 行级 diff（P1：编辑合并后需按"首 before ↔ 尾 after"重算差异）。
 *
 * 算法与采集桥 `computeLineDiffHunks` 一致（LCS 动态规划），保证同一份内容在
 * 桥侧与 core 侧算出相同 hunks，便于冒烟比对。
 */

export interface DiffHunk {
  op: "insert" | "delete";
  /** after 文本中的起始行（1-based） */
  startLine: number;
  endLine: number;
  lines: string[];
  contextBefore: string[];
  contextAfter: string[];
}

function pushHunk(
  hunks: DiffHunk[],
  op: "insert" | "delete",
  a: string[],
  b: string[],
  lineIdx: number,
  lineEnd: number,
  afterLine: number,
  pad: number,
): void {
  const src = op === "insert" ? b : a;
  const lines = src.slice(lineIdx, lineEnd);
  const ctxStart = Math.max(0, lineIdx - pad);
  const ctxEnd = Math.min(src.length, lineEnd + pad);
  const startLine = op === "insert" ? afterLine + 1 : lineIdx + 1;
  hunks.push({
    op,
    startLine,
    endLine: startLine + lines.length - 1,
    lines,
    contextBefore: src.slice(ctxStart, lineIdx),
    contextAfter: src.slice(lineEnd, ctxEnd),
  });
}

/**
 * 计算 before → after 的行级差异 hunks。
 * 空内容视为 0 行（与桥侧一致），避免把"新建文件"算成整文件删除。
 */
export function computeLineDiffHunks(
  beforeText: string | null | undefined,
  afterText: string | null | undefined,
  pad = 3,
): DiffHunk[] {
  const a = beforeText ? String(beforeText).split(/\r?\n/) : [];
  const b = afterText ? String(afterText).split(/\r?\n/) : [];
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];

  // LCS DP
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const hunks: DiffHunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      pushHunk(hunks, "delete", a, b, i, i + 1, j, pad);
      i += 1;
    } else {
      pushHunk(hunks, "insert", a, b, j, j + 1, j, pad);
      j += 1;
    }
  }
  while (i < n) {
    pushHunk(hunks, "delete", a, b, i, i + 1, j, pad);
    i += 1;
  }
  while (j < m) {
    pushHunk(hunks, "insert", a, b, j, j + 1, j, pad);
    j += 1;
  }
  return hunks;
}

/** 取编辑事件的发生行号（用于失焦判定中的行跳跃阈值） */
export function editLineOf(evt: { changes?: unknown; type?: string }): number | null {
  const changes = evt?.changes;
  if (Array.isArray(changes) && changes.length > 0) {
    const first = changes[0] as { startLine?: number };
    if (typeof first?.startLine === "number" && Number.isFinite(first.startLine)) {
      return first.startLine;
    }
  }
  return null;
}
