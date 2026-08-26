/**
 * 分级 logger（架构 §5，core 零 LLM、零 Bitfun 符号）。
 * 日志写入 logs/credit-bridge.log；按源/类型计数供冒烟比对。
 * 文件 I/O 经注入 FsPort（§5.4），默认 node fs；挂载进 web-ui 时注入 Bitfun 适配。
 */
import { nodeFsPort, joinPath, type FsPort } from "../fs-port.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  /** 日志目录（绝对）；默认 <home>/.bitfun/credit/logs */
  logDir?: string;
  /** 是否同时输出到控制台 */
  console?: boolean;
  /** 最低输出级别 */
  minLevel?: LogLevel;
  /** 文件系统 Port（默认 node fs） */
  fsPort?: FsPort;
}

export class CreditLogger {
  private readonly logFile: string;
  private readonly console: boolean;
  private readonly minLevel: LogLevel;
  private readonly fs: FsPort;
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly counts = new Map<string, number>();
  private writeError = false;

  constructor(opts: LoggerOptions = {}) {
    this.fs = opts.fsPort ?? nodeFsPort;
    const base = opts.logDir ?? `${this.fs.homedir()}/.bitfun/credit/logs`;
    this.logFile = joinPath(base, "credit-bridge.log");
    this.console = opts.console ?? true;
    this.minLevel = opts.minLevel ?? "info";
    this.ensureDir(base);
    this.installExitFlush();
  }

  private ensureDir(dir: string): void {
    try {
      this.fs.mkdir(dir);
    } catch {
      this.writeError = true;
    }
  }

  private levelRank(l: LogLevel): number {
    return { debug: 0, info: 1, warn: 2, error: 3 }[l];
  }

  /** 计数（按 key，如 `<source>:<type>`） */
  count(key: string): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  getCounts(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  log(level: LogLevel, source: string, msg: string, meta?: unknown): void {
    if (this.levelRank(level) < this.levelRank(this.minLevel)) return;
    const ts = new Date().toISOString();
    const line = `[${ts}] ${level.toUpperCase()} [${source}] ${msg}${
      meta !== undefined ? " " + safeStringify(meta) : ""
    }`;
    if (this.console) console.log(line);
    this.buffer.push(line);
    this.scheduleFlush();
  }

  info(source: string, msg: string, meta?: unknown): void {
    this.log("info", source, msg, meta);
  }
  warn(source: string, msg: string, meta?: unknown): void {
    this.log("warn", source, msg, meta);
  }
  error(source: string, msg: string, meta?: unknown): void {
    this.log("error", source, msg, meta);
  }
  debug(source: string, msg: string, meta?: unknown): void {
    this.log("debug", source, msg, meta);
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, 200);
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.writeError || this.buffer.length === 0) return;
    const chunk = this.buffer.join("\n") + "\n";
    this.buffer = [];
    try {
      await this.fs.appendFile(this.logFile, chunk);
    } catch (err) {
      // 浏览器/WebView：暴露真实写入错误（目录权限/scope/append 选项等），便于诊断
      if (typeof console !== "undefined" && console.error) {
        console.error("[credit] logger flush failed:", { logFile: this.logFile, error: String(err) });
      }
      this.writeError = true;
    }
  }

  private installExitFlush(): void {
    // 浏览器/WebView 环境无 Node process，跳过退出钩子（桥旁路纪律：不崩）。
    if (typeof process === "undefined" || typeof process.once !== "function") return;
    const flush = () => {
      // 同步尽力 flush（退出钩子）
      if (!this.writeError && this.buffer.length > 0) {
        try {
          this.fs.appendFileSync(this.logFile, this.buffer.join("\n") + "\n");
          this.buffer = [];
        } catch {
          this.writeError = true;
        }
      }
    };
    process.once("exit", flush);
    process.once("SIGINT", () => {
      flush();
      process.exit(0);
    });
    process.once("SIGTERM", () => {
      flush();
      process.exit(0);
    });
  }
}

function safeStringify(meta: unknown): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}
