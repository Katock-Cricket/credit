/**
 * 会话状态机（架构 §3.2 / §5.2，协议侧类型；P1 任务 T3）。
 * 管理 PrSession 生命周期与计数；持久化委托 Store。
 *
 * 四态：idle → recording → computing → committed（`recording→idle` = 放弃）。
 * P1 新增：`recover()` 断点恢复、`finish()` 结束并保存、`reset()` 放弃并清理本轮数据。
 */
import type {
  PrSession,
  SessionState,
  SessionStats,
  ControlMethod,
} from "@credit/protocol";
import { canTransition } from "@credit/protocol";
import type { BehaviorStore } from "../store/jsonl-store.js";

/** 生成 prId：`pr-YYYYMMDD-HHmmss-<短随机>`，唯一且可排序（架构 §5.3） */
export function makePrId(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `pr-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 断点恢复结果（供日志与 UI 显式提示"已自动接续"） */
export interface RecoverReport {
  found: boolean;
  from: SessionState | null;
  /** resume=自动续采 / rewind=computing 回退 / wait=等待 start / degraded=安全降级 / none=无会话 */
  action: "resume" | "rewind" | "wait" | "degraded" | "none";
  prId: string;
  reason?: string;
}

/** 放弃本轮记录的清理结果 */
export interface ResetReport {
  removed: string[];
  failed: string[];
}

const idleSession = (): PrSession => ({
  prId: "",
  state: "idle",
  startedAt: Date.now(),
  endedAt: null,
  seq: 0,
  branch: null,
  commitMsg: null,
  counts: {},
});

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
    return this.session?.prId || "unknown";
  }

  /**
   * 断点恢复（P1 §4.4）：启动时按 session.json 状态决定动作。
   * - recording  → 自动续采（沿用 prId 与 seq）
   * - computing  → 回退 recording（P1 无计算，中断即回退；P2 起需重跑计算）
   * - committed/idle → 等待 start
   * - 缺失/坏文件/未知状态 → 安全降级 idle，**不删除任何数据文件**
   */
  async recover(): Promise<RecoverReport> {
    let s: PrSession | null = null;
    try {
      s = await this.store.readSession();
    } catch {
      s = null;
    }
    if (!s || !s.prId || s.prId === "none") {
      this.session = null;
      return { found: false, from: null, action: "none", prId: "" };
    }
    switch (s.state) {
      case "recording": {
        // 续采前先用数据文件校正 seq（详见 maxSeqFromBehaviors 注释）：
        // session.json 的 seq 可能被只做控制面的进程覆盖回 0，直接沿用会让
        // 新 Behavior 的 id 与已有行重复。
        // 校正与写回均为**尽力而为**：失败只降级为沿用原 seq，绝不让 recover 整体失败
        // （否则会话无法恢复，采到的事件会落到错误 prId）。
        let seq = s.seq ?? 0;
        try {
          seq = Math.max(seq, await this.maxSeqFromBehaviors(s.prId));
        } catch {
          /* 数据文件不可读：沿用 session.json 的 seq */
        }
        const resumed: PrSession = { ...s, seq };
        this.session = resumed;
        try {
          await this.store.writeSession(resumed);
        } catch {
          /* 写回失败不阻断恢复：内存会话已就绪，后续 persist 会再试 */
        }
        return { found: true, from: "recording", action: "resume", prId: s.prId };
      }
      case "computing": {
        let seq = s.seq ?? 0;
        try {
          seq = Math.max(seq, await this.maxSeqFromBehaviors(s.prId));
        } catch {
          /* 同上 */
        }
        const rewound: PrSession = { ...s, state: "recording", endedAt: null, seq };
        this.session = rewound;
        try {
          await this.store.writeSession(rewound);
        } catch {
          /* 同上 */
        }
        return { found: true, from: "computing", action: "rewind", prId: s.prId };
      }
      case "committed":
      case "idle":
        this.session = s;
        return { found: true, from: s.state, action: "wait", prId: s.prId };
      default:
        this.session = null;
        return {
          found: true,
          from: null,
          action: "degraded",
          prId: s.prId,
          reason: `unknown state: ${String(s.state)}`,
        };
    }
  }

  /**
   * 从 behaviors 数据文件求当前最大 seq —— **数据层才是 seq 的事实来源**。
   *
   * 背景（2026-09-02 实测缺陷）：`Behavior.id = ${prId}-${seq}`，而 session.json 会被
   * **多个进程**写入 —— 采集桥（真实累加 seq）与 MiniApp 原型（仅控制面、不采集事件，
   * 其内存 seq 恒为 0）都会定期 `persist()`。后写者覆盖前者，导致桥重启 `recover()`
   * 时读到被重置的 seq，续采的 id 从 1 重来、与已有行重复（实测 30 行中 17 行 id 冲突）。
   *
   * 故恢复时以数据文件里已有的最大 seq 为准取 max，不再单信控制面状态。
   * 读取失败退化为 0（仅沿用 session.json），绝不阻塞恢复。
   */
  private async maxSeqFromBehaviors(prId: string): Promise<number> {
    try {
      const { items } = await this.store.readBehaviors(prId);
      let max = 0;
      for (const b of items) {
        const m = /-(\d+)$/.exec(String((b as { id?: unknown })?.id ?? ""));
        if (!m) continue;
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > max) max = n;
      }
      return max;
    } catch {
      return 0;
    }
  }

  /**
   * 同步确保存在会话（P1）：publish 是同步链路，不能等待 `start` 的落盘。
   * 本方法同步建立内存会话并 fire-and-forget 落盘，避免 P0 时代
   * "start 未 await 就取 prId" 导致的 `unknown` 污染与 seq 错乱。
   */
  ensureStarted(prId: string, branch?: string): PrSession {
    if (this.session && this.session.prId) return this.session;
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
    void this.store.writeSession(next).catch(() => {});
    return next;
  }

  /** 开始 PR 会话（idle→recording）；若上轮未结束则先 finish 保存 */
  async start(prId: string, branch?: string): Promise<PrSession> {
    const prev = this.session;
    if (prev && prev.prId && prev.state !== "committed" && prev.state !== "idle") {
      // 上轮未结束：先保存（P1 改为 finish，避免停在 computing）
      await this.finish(prev.prId);
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

  /** 结束会话（recording→computing），落盘 */
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

  /**
   * 结束并保存（P1 §4.2）：recording → computing → committed。
   * P1 无计算负载，computing 瞬时通过；P2 起 end 后需等待计算完成再 commit。
   */
  async finish(prId: string): Promise<PrSession> {
    // 已在 computing（如上次 end 后中断）时直接 commit，不再走 end（end 要求从 recording 转换）
    const cur = this.session;
    if (cur && cur.prId === prId && cur.state === "computing") {
      return this.commit(prId);
    }
    await this.end(prId);
    return this.commit(prId);
  }

  /**
   * 放弃本轮记录（P1 §4.3）：丢弃未 flush 缓冲 + 删除本轮 raw/behaviors 数据文件 + 置 idle。
   * 审计保留"本轮已放弃"这一事实（计数/log），但事件内容不保留。
   */
  async reset(): Promise<ResetReport> {
    const prId = this.session?.prId;
    let report: ResetReport = { removed: [], failed: [] };
    if (prId) {
      try {
        report = await this.store.removeSessionData(prId);
      } catch {
        report = { removed: [], failed: [] };
      }
    }
    this.session = null;
    await this.store.writeSession(idleSession());
    return report;
  }

  /**
   * 同步磁盘上由**外部进程**（如 MiniApp 原型）写入的会话（P1）。
   *
   * 背景：采集桥（Bitfun 主进程）与 MiniApp 原型是两个进程，各自持有内存会话。
   * 原型点"开始记录"只写 `session.json`，桥必须感知，否则事件会落到另一个 prId。
   *
   * 同步规则（保守，避免回退本地进度）：
   * - 本地无会话 / prId 不同 → 采纳外部会话；
   * - prId 相同但状态不同 → 采纳外部状态，**保留较大的 seq**（本地可能已采到更多事件）。
   */
  async syncFromDisk(): Promise<boolean> {
    let ext: PrSession | null = null;
    try {
      ext = await this.store.readSession();
    } catch {
      return false;
    }
    if (!ext) return false;
    const cur = this.session;

    // 外部为 **idle / 空 prId** —— 用户在另一进程点了"放弃记录"，或尚未开始。
    // 必须清空本地会话；否则本进程会继续往一个已被放弃的 prId 写数据，
    // 表现为"点了放弃，却仍在生成新的记录文件"（2026-09-02 实测）。
    //
    // 注意：**不能**沿用下面的 `!ext.prId` 提前 return —— idle 会话的 prId 是空字符串
    // （见 idleSession），会被那条判断当成"无效外部会话"而跳过，本地 recording 得以残留。
    if (ext.state === "idle" || !ext.prId || ext.prId === "none") {
      if (cur) {
        this.session = null;
        return true;
      }
      return false;
    }

    if (!cur || !cur.prId || cur.prId !== ext.prId) {
      this.session = ext;
      return true;
    }
    if (cur.state !== ext.state) {
      this.session = { ...ext, seq: Math.max(cur.seq, ext.seq) };
      return true;
    }
    return false;
  }

  /**
   * 将内存会话写回磁盘（P1）：session.json 原先只在 start/end/commit/reset 时写，
   * 导致 seq/counts 等内存态不落盘 —— 其他进程（MiniApp 原型）读到的永远是初始快照。
   * 由采集侧定期调用，使跨进程进度可见。
   */
  async persist(stats?: SessionStats): Promise<void> {
    if (!this.session) return;
    const next: PrSession = stats ? { ...this.session, stats } : this.session;
    this.session = next;
    await this.store.writeSession(next);
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
      case "credit.control.finish":
        if (prId) return this.finish(prId);
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
