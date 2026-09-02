/**
 * FsPort：文件系统抽象（架构 §5.4 Port 注入纪律）。
 * core 不直接依赖 node:fs，由调用方注入；默认实现用 node fs（Node 侧/离线单测）。
 * 挂载进 Bitfun web-ui（渲染进程无 node fs）时注入 Bitfun fs 适配器。
 *
 * 重要：本模块**顶层不得 import 任何 node: 内置模块**，否则 Vite 在浏览器/WebView
 * 预构建 @credit/core 时会因 node:module 不存在而 TypeError 崩溃。
 * node:fs/node:path/node:os 一律在函数内动态 import（浏览器永不调用这些分支）。
 */
export interface FsPort {
  mkdir(dir: string): void;
  appendFile(file: string, data: string): Promise<void>;
  appendFileSync(file: string, data: string): void;
  writeFile(file: string, data: string): Promise<void>;
  readFile(file: string): Promise<string>;
  rename(from: string, to: string): Promise<void>;
  homedir(): string;
  /**
   * 可选能力：删除文件（P1 `reset` 放弃本轮记录时清理数据文件用）。
   * 未提供时 reset 降级为"仅置 idle + log"，不抛错（§5 桥旁路纪律）。
   */
  unlink?(file: string): Promise<void>;
  /** 可选能力：判断文件是否存在 */
  exists?(file: string): boolean;
}

function isNode(): boolean {
  return typeof process !== "undefined" && !!(process as { versions?: { node?: string } }).versions?.node;
}

/** Node 侧默认 fs 实现工厂（函数内动态 import node:fs；浏览器/WebView 永不调用）。 */
export async function createNodeFsPort(): Promise<FsPort> {
  const nodeFs = await import("node:fs");
  const nodePath = await import("node:path");
  const nodeOs = await import("node:os");
  return {
    mkdir: (dir: string) => nodeFs.mkdirSync(dir, { recursive: true }),
    appendFile: (file: string, data: string) => nodeFs.promises.appendFile(file, data, "utf8"),
    appendFileSync: (file: string, data: string) => nodeFs.appendFileSync(file, data, "utf8"),
    writeFile: (file: string, data: string) => nodeFs.promises.writeFile(file, data, "utf8"),
    readFile: (file: string) => nodeFs.promises.readFile(file, "utf8"),
    rename: (from: string, to: string) => nodeFs.promises.rename(from, to),
    unlink: (file: string) => nodeFs.promises.unlink(file),
    exists: (file: string) => nodeFs.existsSync(file),
    homedir: () => nodeOs.homedir(),
  };
}

/**
 * 浏览器/WebView 安全的默认占位：仅在调用时才区分环境。
 * - Node 环境：惰性动态加载 node fs（兼容未注入 fsPort 的 Node 用法）。
 * - 非 Node（Bitfun web-ui）：调用方必注入 FsPort（mount.ts 已注入 bitfunFsPort），
 *   若未注入则抛清晰错误而非崩溃。
 * 顶层零 node 引用，浏览器加载本模块不会 TypeError。
 */
export const nodeFsPort: FsPort = (() => {
  let nodeCache: { fs: typeof import("node:fs"); path: typeof import("node:path"); os: typeof import("node:os") } | null = null;
  function loadNode() {
    if (nodeCache) return nodeCache;
    if (!isNode()) {
      throw new Error("[credit] nodeFsPort unavailable in browser; inject an FsPort (e.g. bitfunFsPort)");
    }
    // Node 22+：process.getBuiltinModule 可在 ESM 下**同步**取内置模块。
    // 这是 ESM 入口（如 MiniApp 原型 server.mjs）的正确路径 —— eval('require') 在 ESM 下
    // 会抛 ERR_AMBIGUOUS_MODULE_SYNTAX，仅能作为 CJS 上下文的回退。
    const getBuiltinModule = (process as { getBuiltinModule?: (id: string) => unknown })
      .getBuiltinModule;
    if (typeof getBuiltinModule === "function") {
      nodeCache = {
        fs: getBuiltinModule("node:fs") as typeof import("node:fs"),
        path: getBuiltinModule("node:path") as typeof import("node:path"),
        os: getBuiltinModule("node:os") as typeof import("node:os"),
      };
      return nodeCache;
    }
    // 回退：CJS 上下文（eval('require') 仅在 CJS 中可用）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const req: NodeRequire =
      typeof (globalThis as { require?: NodeRequire }).require === "function"
        ? (globalThis as { require: NodeRequire }).require
        : (eval('require') as NodeRequire);
    nodeCache = {
      fs: req("node:fs"),
      path: req("node:path"),
      os: req("node:os"),
    };
    return nodeCache;
  }
  return {
    mkdir: (dir: string) => loadNode().fs.mkdirSync(dir, { recursive: true }),
    appendFile: (file: string, data: string) => loadNode().fs.promises.appendFile(file, data, "utf8"),
    appendFileSync: (file: string, data: string) => loadNode().fs.appendFileSync(file, data, "utf8"),
    writeFile: (file: string, data: string) => loadNode().fs.promises.writeFile(file, data, "utf8"),
    readFile: (file: string) => loadNode().fs.promises.readFile(file, "utf8"),
    rename: (from: string, to: string) => loadNode().fs.promises.rename(from, to),
    unlink: (file: string) => loadNode().fs.promises.unlink(file),
    exists: (file: string) => loadNode().fs.existsSync(file),
    homedir: () => loadNode().os.homedir(),
  };
})();

export function joinPath(...parts: string[]): string {
  // 浏览器安全：用 POSIX 分隔符；Node 侧如需平台分隔符由调用方注入或使用 createNodeFsPort
  return parts.join("/");
}
