/**
 * 会话状态机（架构 §3.2 / §5.2，协议侧类型）。
 * 管理 PrSession 生命周期与计数；持久化委托 Store。
 */
import type {
  PrSession,
  SessionState,
  ControlMethod,
} from "@credit/protocol";
import { canTransition } from "@credit/protocol";
import type { BehaviorStore } from "../store/jsonl-store.js";

export class SessionManager {
  private session: PrSession | null = null;
  constructor(private readonly store: BehaviorStore) {}

  /** 载入既有会话（进程恢复） */
  async load(): Promise<void> {
    this.session = await this.store.readSession();
  }

  get current(): PrSession | null {
    return this.session;
  }

  get prId(): string {
    return this.session?.prId ?? "unknown";
  }

  /** 开始 PR 会话（idle→recording） */
  async start(prId: string, branch?: string): Promise<PrSession> {
    const prev = this.session;
    if (prev && prev.state !== "committed" && prev.state !== "idle") {
      // 强制结束上一会话
      await this.end(prev.prId);
    }
    const next: PrSession = {
      prId,
      state: "recording",
      startedAt: Date.now(),
      endedAt: null,
      seq: 0,
      branch: branch ?? null,
      commitMsg: null,
      counts: {},
    };
    this.session = next;
    await this.store.writeSession(next);
    return next;
  }

  /** 结束会话（recording→computing 或 idle），落盘 */
  async end(prId: string): Promise<PrSession> {
    if (!this.session || this.session.prId !== prId) {
      throw new Error(`no active session for prId=${prId}`);
    }
    if (!canTransition(this.session.state, "computing")) {
      throw new Error(`invalid transition ${this.session.state}->computing`);
    }
    this.session = { ...this.session, state: "computing", endedAt: Date.now() };
    await this.store.writeSession(this.session);
    return this.session;
  }

  /** 提交完成（computing→committed） */
  async commit(prId: string, commitMsg?: string): Promise<PrSession> {
    if (!this.session || this.session.prId !== prId) {
      throw new Error(`no active session for prId=${prId}`);
    }
    if (!canTransition(this.session.state, "committed")) {
      throw new Error(`invalid transition ${this.session.state}->committed`);
    }
    this.session = {
      ...this.session,
      state: "committed",
      commitMsg: commitMsg ?? this.session.commitMsg,
    };
    await this.store.writeSession(this.session);
    return this.session;
  }

  async reset(): Promise<void> {
    this.session = null;
    await this.store.writeSession({
      prId: "none",
      state: "idle",
      startedAt: Date.now(),
      endedAt: null,
      seq: 0,
      counts: {},
    });
  }

  /** 递增序列号并返回下一个 id 序号 */
  nextSeq(): number {
    if (!this.session) throw new Error("session not started");
    this.session.seq += 1;
    return this.session.seq;
  }

  /** 累加计数（按源分类） */
  bumpCount(source: string): void {
    if (!this.session) return;
    this.session.counts[source] = (this.session.counts[source] ?? 0) + 1;
  }

  /** 控制方法路由（credit.control.*） */
  async handle(method: ControlMethod, prId?: string): Promise<PrSession | null> {
    switch (method) {
      case "credit.control.start":
        return this.start(prId ?? `pr-${Date.now()}`);
      case "credit.control.end":
        if (prId) return this.end(prId);
        return null;
      case "credit.control.getStatus":
        return this.session;
      case "credit.control.reset":
        await this.reset();
        return null;
      default:
        return null;
    }
  }
}
