/**
 * GitPort：git 能力抽象（AGENTS §5-4 Port 注入纪律；P1 任务 T6）。
 *
 * 用途：`userAccept` 的 `diffStats` 在 P0 前端桥恒为 null（偏差 B-002），P1 由本 Port 按
 * `fileUris` 补齐行数，使下游"单次Accept行数"指标（算法 §3.3.3）有数据源。
 *
 * 设计要点：
 * - **同步接口**：`publish` 是同步链路，同步 diff 才能保证 raw/behaviors 行序一致；
 * - **顶层零 node 引用**：浏览器/WebView 加载本模块不得崩（与 fs-port.ts 同纪律）；
 * - **兜底语义**：`git diff` 取的是**当前工作区与 HEAD 的差异**，与 Accept 时刻的快照变更
 *   存在时间偏差（Accept 后若继续编辑会偏大），故仅为**近似补齐**；失败保持 null，
 *   由下游按 `fidelity: 'frontend'` + `degraded` 处理。
 */
export interface DiffStat {
  file: string;
  added: number;
  deleted: number;
}

export interface GitPort {
  /** 按文件清单取变更行数；不可用/失败一律返回 null（不抛错） */
  diffNumstat(fileUris: string[]): DiffStat[] | null;
}

/** 空实现：浏览器侧或测试占位 —— 永远返回 null（补齐失败 → 保持 null + degraded） */
export const nullGitPort: GitPort = {
  diffNumstat: () => null,
};

function loadNodeCp(): typeof import("node:child_process") | null {
  if (typeof process === "undefined") return null;
  const versions = (process as { versions?: { node?: string } }).versions;
  if (!versions?.node) return null;
  try {
    // Node 22+ 优先用 getBuiltinModule（ESM 安全）；eval('require') 仅作 CJS 回退
    const getBuiltinModule = (process as { getBuiltinModule?: (id: string) => unknown })
      .getBuiltinModule;
    if (typeof getBuiltinModule === "function") {
      return getBuiltinModule("node:child_process") as typeof import("node:child_process");
    }
    const req: NodeRequire =
      typeof (globalThis as { require?: NodeRequire }).require === "function"
        ? (globalThis as { require: NodeRequire }).require
        : (eval("require") as NodeRequire);
    return req("node:child_process") as typeof import("node:child_process");
  } catch {
    return null;
  }
}

/** 解析 `git diff --numstat` 输出：`<added>\t<deleted>\t<file>`；二进制文件形如 `-\t-\t<file>` */
export function parseNumstat(text: string): DiffStat[] {
  const out: DiffStat[] = [];
  for (const line of String(text ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("\t");
    if (parts.length < 3) continue;
    const added = Number(parts[0]);
    const deleted = Number(parts[1]);
    if (!Number.isFinite(added) || !Number.isFinite(deleted)) continue; // 二进制/无法统计
    const file = parts.slice(2).join("\t").replace(/^"|"$/g, "");
    out.push({ file, added, deleted });
  }
  return out;
}

/** Node 侧默认实现（函数内动态取 node:child_process，浏览器永不进入该分支） */
export const nodeGitPort: GitPort = {
  diffNumstat(fileUris: string[]): DiffStat[] | null {
    const cp = loadNodeCp();
    if (!cp || !Array.isArray(fileUris) || fileUris.length === 0) return null;
    try {
      const files = fileUris.map((f) => `"${String(f).replace(/"/g, '\\"')}"`).join(" ");
      const out = cp.execSync(`git diff --numstat -- ${files}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const stats = parseNumstat(out);
      return stats.length > 0 ? stats : null;
    } catch {
      return null;
    }
  },
};
