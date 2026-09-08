/**
 * Unified diff 解析（纯函数，可单测）。
 *
 * 只提取**新增行**的行号与内容 —— C5「核心 Diff 行集」需要行内容来做
 * 「剔除空行与纯符号行」的过滤（算法 §2.5），仅有 numstat 计数是不够的。
 */

export interface DiffAddedFile {
  uri: string;
  /** 新增行号（新文件坐标，1-based），升序 */
  addedLines: number[];
  /** 与 addedLines 一一对应的行内容 */
  addedTexts: string[];
  totalAdded: number;
  totalDeleted: number;
}

/** 只含符号与空白的行 —— 不承载可读内容，计入分母会稀释阅读覆盖语义 */
const PURE_SYMBOL = /^[\s{}()[\];,/*+=<>|&!?.:'"`@#$%^*~\\-]*$/;

export function isMeaningfulLine(text: string): boolean {
  if (!text.trim()) return false;
  return !PURE_SYMBOL.test(text);
}

/**
 * 解析 `git diff -U0` 输出。
 * 容错：无法识别的行跳过；`---/+++` 头缺失时沿用上一个文件名。
 */
export function parseUnifiedDiff(patch: string): DiffAddedFile[] {
  const files: DiffAddedFile[] = [];
  let cur: DiffAddedFile | null = null;
  let newLineNo = 0;

  for (const raw of String(patch ?? "").split("\n")) {
    const line = raw.replace(/\r$/, "");

    if (line.startsWith("diff --git ")) {
      cur = null;
      continue;
    }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      // /dev/null 表示删除文件，无新增
      if (p === "/dev/null") {
        cur = null;
        continue;
      }
      const uri = p.replace(/^b\//, "");
      cur = { uri, addedLines: [], addedTexts: [], totalAdded: 0, totalDeleted: 0 };
      files.push(cur);
      continue;
    }
    if (line.startsWith("@@")) {
      const m = /@@\s*-\d+(?:,\d+)?\s*\+(\d+)(?:,(\d+))?\s*@@/.exec(line);
      newLineNo = m ? Number(m[1]) : 0;
      continue;
    }
    if (!cur) continue;

    if (line.startsWith("+")) {
      const text = line.slice(1);
      cur.addedLines.push(newLineNo);
      cur.addedTexts.push(text);
      cur.totalAdded++;
      newLineNo++;
    } else if (line.startsWith("-")) {
      cur.totalDeleted++;
    } else if (line.startsWith(" ") || line === "") {
      newLineNo++;
    }
  }

  return files;
}
