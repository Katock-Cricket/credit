/**
 * BehaviorStore：jsonl 顺序写 + 内存缓冲 flush（架构 §5.3）。
 * - behaviors/<prId>.jsonl：每行一个 Behavior（带协议 v 字段由 ingress 注入）
 * - session.json：原子写（临时文件 rename）
 * 崩溃最多丢窗口内事件（可接受，§7.2）。
 * 文件 I/O 经注入 FsPort（§5.4），默认 node fs；挂载进 web-ui 时注入 Bitfun fs 适配。
 */
import type { Behavior, PrSession } from "@credit/protocol";
import { nodeFsPort, joinPath, type FsPort } from "../fs-port.js";

export interface StoreOptions {
  /** 根目录；默认 <home>/.bitfun/credit */
  rootDir?: string;
  /** 缓冲 flush 阈值：条目数 */
  flushMaxItems?: number;
  /** 缓冲 flush 阈值：毫秒 */
  flushIntervalMs?: number;
  /** 文件系统 Port（默认 node fs；web-ui 挂载时注入 Bitfun 适配） */
  fsPort?: FsPort;
}

export class BehaviorStore {
  private readonly rootDir: string;
  private readonly behaviorsDir: string;
  private readonly flushMaxItems: number;
  private readonly flushIntervalMs: number;
  private readonly fs: FsPort;
  private buffer = new Map<string, string[]>(); // prId -> jsonl lines
  private timer: NodeJS.Timeout | null = null;

  constructor(opts: StoreOptions = {}) {
    this.fs = opts.fsPort ?? nodeFsPort;
    this.rootDir = opts.rootDir ?? `${this.fs.homedir()}/.bitfun/credit`;
    this.behaviorsDir = joinPath(this.rootDir, "behaviors");
    this.flushMaxItems = opts.flushMaxItems ?? 200;
    this.flushIntervalMs = opts.flushIntervalMs ?? 500;
    this.fs.mkdir(this.behaviorsDir);
    this.installExitFlush();
  }

  append(prId: string, b: Behavior): void {
    const line = JSON.stringify({ ...b, v: "0.2" });
    const arr = this.buffer.get(prId) ?? [];
    arr.push(line);
    this.buffer.set(prId, arr);
    if (arr.length >= this.flushMaxItems) void this.flush();
    else this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.size === 0) return;
    const entries = [...this.buffer.entries()];
    this.buffer.clear();
    await Promise.all(
      entries.map(async ([prId, lines]) => {
        const file = joinPath(this.behaviorsDir, `${prId}.jsonl`);
        try {
          await this.fs.appendFile(file, lines.join("\n") + "\n");
        } catch (e) {
          // 写失败不冒泡（§5 桥旁路纪律）；交由上层 logger 记录
          throw e;
        }
      }),
    );
  }

  /** 原子写 session.json（临时文件 rename，§5.2） */
  async writeSession(session: PrSession): Promise<void> {
    const file = joinPath(this.rootDir, "session.json");
    const tmp = joinPath(this.rootDir, `.session.json.tmp.${process.pid}`);
    const data = JSON.stringify(session, null, 2);
    await this.fs.writeFile(tmp, data);
    await this.fs.rename(tmp, file);
  }

  async readSession(): Promise<PrSession | null> {
    const file = joinPath(this.rootDir, "session.json");
    try {
      const data = await this.fs.readFile(file);
      return JSON.parse(data) as PrSession;
    } catch {
      return null;
    }
  }

  private installExitFlush(): void {
    // 浏览器/WebView 环境无 Node process，跳过退出钩子（桥旁路纪律：不崩）。
    if (typeof process === "undefined" || typeof process.once !== "function") return;
    const syncFlush = () => {
      if (this.buffer.size === 0) return;
      for (const [prId, lines] of this.buffer) {
        const file = joinPath(this.behaviorsDir, `${prId}.jsonl`);
        try {
          this.fs.appendFileSync(file, lines.join("\n") + "\n");
        } catch {
          /* 退出钩子尽力而为 */
        }
      }
      this.buffer.clear();
    };
    process.once("exit", syncFlush);
  }
}
