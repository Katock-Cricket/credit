/**
 * BehaviorStore：双层 jsonl 顺序写 + 内存缓冲 flush（架构 §5.3，P1 任务 T2）。
 *
 * 目录：
 * - `raw/<prId>.jsonl`       —— 原始 CreditRawEvent 全量（P1 新增；审计与重放基线）
 * - `behaviors/<prId>.jsonl` —— 治理后 Behavior（数据层输出，P2 直接消费）
 * - `session.json`           —— 原子写（临时文件 rename）
 *
 * 纪律：
 * - 只追加、不回写；坏行"容错"= 读取时跳过 + 计数，**绝不改写历史行**（AGENTS §5-6）。
 * - 崩溃最多丢缓冲窗口内事件（架构 §7.2 已接受），已 flush 数据不丢。
 * 文件 I/O 经注入 FsPort（§5.4），默认 node fs；挂载进 web-ui 时注入 Bitfun fs 适配。
 */
import type { Behavior, PrSession, CreditRawEvent } from "@credit/protocol";
import { PROTOCOL_VERSION, normalizeToCurrent } from "@credit/protocol";
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

/** jsonl 解析结果（含坏行统计，供冒烟与自检） */
export interface ParseResult<T> {
  items: T[];
  /** 跳过的坏行数 */
  badLines: number;
  /** 前若干条错误摘要（避免日志爆炸） */
  errors: string[];
}

const MAX_PARSE_ERRORS = 10;

/** 解析 jsonl 文本：空行跳过，坏行跳过 + 计数，合法行经版本迁移 */
export function parseJsonl<T>(text: string): ParseResult<T> {
  const items: T[] = [];
  const errors: string[] = [];
  let badLines = 0;
  const lines = String(text ?? "").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!.trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line) as T & { v?: string };
      items.push(normalizeToCurrent(obj) as T);
    } catch (e) {
      badLines += 1;
      if (errors.length < MAX_PARSE_ERRORS) {
        errors.push(`line ${i + 1}: ${String(e).slice(0, 200)}`);
      }
    }
  }
  return { items, badLines, errors };
}

export class BehaviorStore {
  private readonly rootDir: string;
  private readonly behaviorsDir: string;
  private readonly rawDir: string;
  private readonly flushMaxItems: number;
  private readonly flushIntervalMs: number;
  private readonly fs: FsPort;
  private buffer = new Map<string, string[]>(); // prId -> behavior jsonl lines
  private rawBuffer = new Map<string, string[]>(); // prId -> raw event jsonl lines
  private timer: NodeJS.Timeout | null = null;

  constructor(opts: StoreOptions = {}) {
    this.fs = opts.fsPort ?? nodeFsPort;
    this.rootDir = opts.rootDir ?? `${this.fs.homedir()}/.bitfun/credit`;
    this.behaviorsDir = joinPath(this.rootDir, "behaviors");
    this.rawDir = joinPath(this.rootDir, "raw");
    this.flushMaxItems = opts.flushMaxItems ?? 200;
    this.flushIntervalMs = opts.flushIntervalMs ?? 500;
    this.fs.mkdir(this.behaviorsDir);
    this.fs.mkdir(this.rawDir);
    this.installExitFlush();
  }

  get dirs(): { rootDir: string; behaviorsDir: string; rawDir: string } {
    return { rootDir: this.rootDir, behaviorsDir: this.behaviorsDir, rawDir: this.rawDir };
  }

  /** 追加治理后的 Behavior（数据层输出） */
  append(prId: string, b: Behavior): void {
    this.pushLine(this.buffer, prId, JSON.stringify({ ...b, v: PROTOCOL_VERSION }));
  }

  /** 追加原始事件（raw 层，审计/重放基线） */
  appendRaw(prId: string, evt: CreditRawEvent): void {
    this.pushLine(this.rawBuffer, prId, JSON.stringify({ ...evt, v: PROTOCOL_VERSION }));
  }

  private pushLine(target: Map<string, string[]>, prId: string, line: string): void {
    const arr = target.get(prId) ?? [];
    arr.push(line);
    target.set(prId, arr);
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
    if (this.buffer.size === 0 && this.rawBuffer.size === 0) return;
    const behaviors = [...this.buffer.entries()];
    const raws = [...this.rawBuffer.entries()];
    this.buffer.clear();
    this.rawBuffer.clear();
    await Promise.all([
      ...behaviors.map(([prId, lines]) =>
        this.fs.appendFile(joinPath(this.behaviorsDir, `${prId}.jsonl`), lines.join("\n") + "\n"),
      ),
      ...raws.map(([prId, lines]) =>
        this.fs.appendFile(joinPath(this.rawDir, `${prId}.jsonl`), lines.join("\n") + "\n"),
      ),
    ]);
  }

  /**
   * 读取某会话的治理后 Behavior（坏行跳过 + 计数，不改写文件）。
   * 文件不存在返回空列表。
   */
  async readBehaviors(prId: string): Promise<ParseResult<Behavior>> {
    return this.readJsonl<Behavior>(joinPath(this.behaviorsDir, `${prId}.jsonl`));
  }

  /** 读取某会话的原始事件（坏行跳过 + 计数，不改写文件） */
  async readRaw(prId: string): Promise<ParseResult<CreditRawEvent>> {
    return this.readJsonl<CreditRawEvent>(joinPath(this.rawDir, `${prId}.jsonl`));
  }

  private async readJsonl<T>(file: string): Promise<ParseResult<T>> {
    try {
      const text = await this.fs.readFile(file);
      return parseJsonl<T>(text);
    } catch {
      // 文件缺失等一律视为空（不抛错，§5 旁路纪律）
      return { items: [], badLines: 0, errors: [] };
    }
  }

  /**
   * 放弃本轮记录：丢弃未 flush 的缓冲 + 删除本轮 raw/behaviors 数据文件（P1 §4.3）。
   * FsPort 无 unlink 能力时降级为"仅清缓冲 + 返回 failed"，不抛错。
   */
  async removeSessionData(prId: string): Promise<{ removed: string[]; failed: string[] }> {
    // 先丢弃内存缓冲：放弃的数据不应再落盘
    this.buffer.delete(prId);
    this.rawBuffer.delete(prId);

    const targets = [
      joinPath(this.behaviorsDir, `${prId}.jsonl`),
      joinPath(this.rawDir, `${prId}.jsonl`),
    ];
    const removed: string[] = [];
    const failed: string[] = [];
    if (typeof this.fs.unlink !== "function") {
      failed.push(...targets);
      return { removed, failed };
    }
    for (const file of targets) {
      try {
        if (this.fs.exists && !this.fs.exists(file)) continue;
        await this.fs.unlink(file);
        removed.push(file);
      } catch {
        failed.push(file);
      }
    }
    return { removed, failed };
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
      const parsed = JSON.parse(data) as PrSession;
      // 结构性校验：坏 session 一律视作无会话，交由 recover 安全降级
      if (!parsed || typeof parsed !== "object" || typeof parsed.prId !== "string") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private installExitFlush(): void {
    // 浏览器/WebView 环境无 Node process，跳过退出钩子（桥旁路纪律：不崩）。
    if (typeof process === "undefined" || typeof process.once !== "function") return;
    const syncFlush = () => {
      if (this.buffer.size === 0 && this.rawBuffer.size === 0) return;
      const write = (dir: string, prId: string, lines: string[]) => {
        const file = joinPath(dir, `${prId}.jsonl`);
        try {
          this.fs.appendFileSync(file, lines.join("\n") + "\n");
        } catch {
          /* 退出钩子尽力而为 */
        }
      };
      for (const [prId, lines] of this.buffer) write(this.behaviorsDir, prId, lines);
      for (const [prId, lines] of this.rawBuffer) write(this.rawDir, prId, lines);
      this.buffer.clear();
      this.rawBuffer.clear();
    };
    process.once("exit", syncFlush);
  }
}
