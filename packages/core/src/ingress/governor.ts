/**
 * Ingress 治理层（P1 任务 T4，SPEC §3）。
 *
 * 职责：把 P0 的原始事件流治理为"可计算、体量可控"的事件序列 —— 只做**合并与降噪**，
 * 不做指标计算。
 *
 * ### 编辑合并：失焦驱动（对齐 foreshadow `edit-merge.ts`）
 *
 * 时间窗合并是错的：连续打字时两次击键间隔常达数秒，而穿插的 cursor/scroll 并不代表
 * 用户注意力转移。正确判据是**失焦（注意力转移）**：
 *
 * - **白名单**（不触发结算，继续暂存编辑）：`textChanged` 同行/邻近行、`selectionChanged`（光标）、
 *   `textScrolled`（滚动）—— 这些都不表明注意力转移；
 * - **失焦**（结算此前暂存的编辑）：切换到其他文件、打开新文件、问 Agent、跑终端、Accept、
 *   Review 等；同一文件内编辑行号跳跃超过 `editLostFocusLineThr` 也算失焦。
 *
 * 结算时取 focus 块内**首条的 before** 与**末条的 after**，用行级 diff 重算差异；
 * 若首尾内容相同（净零编辑，如"加→删"往复）则整块丢弃（与 foreshadow 一致）。
 *
 * ### 其余治理
 * - **基线事件治理**（决策 D-007）：文件首次打开/基线未建立时产出的 textChanged 无
 *   beforeText，仅用于建立内容基线，**不进入数据层输出**（raw 层照实保留）。
 * - **滚动合并**：`scrollMergeWindowMs` 窗口内合并，保留累计覆盖行区间与累计 dwellMs。
 * - **选择合并**：`readDwellMs` 窗口内合并，dwellMs 累加。
 *
 * 合并在时间上引入延迟：事件先暂存，失焦/到期/显式 flush 才输出。
 * 非合并类事件（prompt/accept/agent/terminal 等）立即透传（并触发编辑结算）。
 */
import type { CreditRawEvent } from "@credit/protocol";
import { DEFAULT_CREDIT_CONFIG, type CreditConfig } from "../config.js";
import { computeLineDiffHunks, editLineOf } from "./diff.js";

export interface EmittedEvent {
  /** 治理后的事件（合并场景下为"代表事件"，字段已按合并语义聚合） */
  evt: CreditRawEvent;
  /** 合并计数：1 = 未合并，>1 = 由 n 条原始事件合并而来 */
  mergedCount: number;
}

export interface GovernorStats {
  /** 被识别为基线、未进入输出的事件数（决策 D-007） */
  baseline: number;
  /** 因合并被折叠的事件数（含被整块丢弃的净零编辑） */
  merged: number;
  /** 输出事件数 */
  emitted: number;
}

/** 一次"注意力聚焦"内的编辑暂存（对齐 foreshadow 的 focus 编辑块） */
interface EditStage {
  key: string;
  uri: string;
  actor: "dev" | "ai";
  /** focus 块首条编辑（提供 before） */
  first: CreditRawEvent;
  /** focus 块末条编辑（提供 after） */
  last: CreditRawEvent;
  count: number;
  firstTs: number;
  lastTs: number;
  /** 末条编辑所在行号（用于行跳跃失焦判定） */
  line: number | null;
}

interface PendingScroll {
  key: string;
  kind: "scroll";
  dueTs: number;
  evt: CreditRawEvent;
  count: number;
  firstTs: number;
  lastTs: number;
  firstLine?: number;
  lastLine?: number;
  dwellMs?: number;
}

interface PendingSelection {
  key: string;
  kind: "selection";
  dueTs: number;
  evt: CreditRawEvent;
  count: number;
  firstTs: number;
  lastTs: number;
  dwellMs?: number;
  /** 最近一次光标位置（用于行容忍度合并判定） */
  line: number;
}

export interface GovernorOptions {
  cfg?: CreditConfig;
  /** 定时器自动冲刷时的回调（用于调用方落盘） */
  onFlush?: (events: EmittedEvent[]) => void;
}

export class IngressGovernor {
  private readonly cfg: CreditConfig;
  private readonly onFlush?: (events: EmittedEvent[]) => void;
  /** 编辑暂存：key = `uri|actor` */
  private editStages = new Map<string, EditStage>();
  /** 上一次编辑的位置引用（失焦判定基准） */
  private lastEdit: { uri: string; actor: "dev" | "ai"; line: number | null } | null = null;
  private pendingScroll = new Map<string, PendingScroll>();
  private pendingSelection = new Map<string, PendingSelection>();
  /** 文件内容基线：uri -> 最近已知内容（用于识别/补全 before=null） */
  private baseContent = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private s: GovernorStats = { baseline: 0, merged: 0, emitted: 0 };

  constructor(opts: GovernorOptions = {}) {
    this.cfg = opts.cfg ?? DEFAULT_CREDIT_CONFIG;
    this.onFlush = opts.onFlush;
  }

  get stats(): GovernorStats {
    return { ...this.s };
  }

  /** 治理入口：返回本次应输出的事件（可能为空 —— 被暂存或识别为基线） */
  push(evt: CreditRawEvent): EmittedEvent[] {
    const now = this.tsOf(evt);
    const out: EmittedEvent[] = [];

    // 到期/超时的暂存先输出（编辑与光标的兜底时长、滚动的静默到期）
    out.push(...this.settleExpired(now));

    switch (evt.type) {
      case "textChanged": {
        const uri = String((evt as { uri?: string }).uri ?? "");
        const raw = evt as { beforeText?: string | null; afterText?: string | null };
        const hasBase = this.baseContent.has(uri);
        const beforeMissing = raw.beforeText == null || raw.beforeText === "";

        // 基线事件：无 before 且该文件基线未建立 → 仅建基线（D-007 不进输出）
        if (beforeMissing && !hasBase) {
          this.baseContent.set(uri, raw.afterText ?? "");
          this.s.baseline += 1;
          if (this.cfg.baselineEmitBehavior) {
            out.push({ evt, mergedCount: 1 });
            this.s.emitted += 1;
          }
          return out;
        }

        // 无 before 但基线已建立 → 用基线补全，使其成为一条完整 edit
        let evtIn: CreditRawEvent = evt;
        if (beforeMissing && hasBase) {
          evtIn = { ...evt, beforeText: this.baseContent.get(uri) ?? "" } as CreditRawEvent;
        }
        this.baseContent.set(uri, String((evtIn as { afterText?: string }).afterText ?? ""));

        // 暂存本次编辑；若相对上一条已失焦，先结算此前暂存（结算结果需返回输出）
        out.push(...this.stageEdit(uri, evtIn, now));
        return out;
      }
      case "textScrolled": {
        // 白名单：滚动不表明注意力转移，不结算编辑
        const uri = String((evt as { uri?: string }).uri ?? "");
        // 区间相交则递归合并；跳到不相交的区域才结算上一段
        out.push(...this.mergeScroll(uri, evt, now));
        return out;
      }
      case "selectionChanged": {
        // 白名单：光标移动不表明注意力转移，不结算编辑
        const uri = String((evt as { uri?: string }).uri ?? "");
        const kind = String((evt as { kind?: string }).kind ?? "");
        // 行容忍度合并：超出 ±cursorMergeLineThr 的行跳跃会先结算上一段
        out.push(...this.mergeSelection(`${uri}|${kind}`, evt, now));
        return out;
      }
      case "agentToolUse": {
        // 转向与 Agent 交互 → 结算编辑
        out.push(...this.settleAll());
        out.push({ evt, mergedCount: 1 });
        this.s.emitted += 1;
        // 未打开文件的 AI 编辑补齐（见 synthesizeAgentEdit 说明）
        const synthesized = this.synthesizeAgentEdit(evt, now);
        if (synthesized) out.push(synthesized);
        return out;
      }
      case "activeEditorChanged":
      case "fileOpened": {
        // 若重新激活的仍是**正在编辑的那个文件**（外部修改触发重载、或编辑器重新聚焦），
        // 不算注意力转移 —— 否则"文件重载"会把正在进行的编辑切成两段。
        const uri = String((evt as { uri?: string }).uri ?? "");
        const stillEditing = [...this.editStages.values()].some((s) => s.uri === uri);
        if (!stillEditing) out.push(...this.settleAll());
        out.push({ evt, mergedCount: 1 });
        this.s.emitted += 1;
        return out;
      }
      default: {
        // 注意力转移类事件（问 Agent/终端/Accept/Review…）→ 结算暂存的编辑
        out.push(...this.settleAll());
        out.push({ evt, mergedCount: 1 });
        this.s.emitted += 1;
        return out;
      }
    }
  }

  /** 显式冲刷所有暂存（会话结束、flush、测试用） */
  flushPending(): EmittedEvent[] {
    const out = this.settleAll();
    this.clearTimer();
    return out;
  }

  /**
   * 丢弃全部暂存（不产出）。
   * 用于"放弃本轮记录"：此时暂存的事件属于要丢弃的内容，绝不能被冲刷落盘。
   */
  discardPending(): void {
    this.editStages.clear();
    this.lastEdit = null;
    this.pendingScroll.clear();
    this.pendingSelection.clear();
    this.clearTimer();
  }

  /** 释放定时器（桥 dispose / 测试结束调用） */
  dispose(): void {
    this.editStages.clear();
    this.lastEdit = null;
    this.pendingScroll.clear();
    this.pendingSelection.clear();
    this.baseContent.clear();
    this.clearTimer();
  }

  // ——— 编辑：失焦驱动的合并与结算 ———

  /**
   * 失焦判定（对齐 foreshadow `lostFocus`）：
   * - 换文件、dev/ai 切换 → 失焦；
   * - 行号缺失 → 保守判失焦；
   * - 同行/邻近行（行差 ≤ `editLostFocusLineThr`）→ 不失焦，继续暂存。
   * 注意：cursor/scroll 由 push 的白名单拦截，不进入本判定。
   */
  private lostFocus(
    prev: { uri: string; actor: "dev" | "ai"; line: number | null },
    cur: { uri: string; actor: "dev" | "ai"; line: number | null },
  ): boolean {
    if (prev.uri !== cur.uri) return true;
    if (prev.actor !== cur.actor) return true;
    if (cur.line == null || prev.line == null) return true;
    return Math.abs(cur.line - prev.line) > this.cfg.editLostFocusLineThr;
  }

  /**
   * 暂存一条编辑；若相对上一条已失焦，先结算此前暂存并返回结算结果。
   * 注意：结算结果必须由调用方输出，否则会被静默丢弃。
   */
  private stageEdit(uri: string, evt: CreditRawEvent, now: number): EmittedEvent[] {
    const settled: EmittedEvent[] = [];
    const actor: "dev" | "ai" = (evt as { source?: string }).source === "agent" ? "ai" : "dev";
    const line = editLineOf(evt as { changes?: unknown });
    const cur = { uri, actor, line };

    if (this.lastEdit && this.lostFocus(this.lastEdit, cur)) {
      settled.push(...this.settleAll());
    }

    const key = `${uri}|${actor}`;
    const existing = this.editStages.get(key);
    if (existing) {
      existing.last = evt;
      existing.count += 1;
      existing.lastTs = now;
      existing.line = line ?? existing.line;
    } else {
      this.editStages.set(key, {
        key,
        uri,
        actor,
        first: evt,
        last: evt,
        count: 1,
        firstTs: now,
        lastTs: now,
        line,
      });
    }
    this.lastEdit = cur;
    this.scheduleTimer(now, this.cfg.editMaxHoldMs);
    return settled;
  }

  /**
   * 结算**全部**暂存：编辑 + 光标 + 滚动。
   * 用于注意力转移（切换文件、问 Agent、终端、Accept…）—— 此时滚动与停留也都该收尾。
   */
  private settleAll(): EmittedEvent[] {
    const out: EmittedEvent[] = [];
    for (const stage of this.editStages.values()) {
      const e = this.materializeEdit(stage);
      if (e) out.push(e);
    }
    this.editStages.clear();
    this.lastEdit = null;
    for (const p of this.pendingSelection.values()) {
      const e = this.materializeSelection(p);
      if (e) out.push(e);
    }
    this.pendingSelection.clear();
    for (const p of this.pendingScroll.values()) {
      out.push(this.materializeScroll(p));
    }
    this.pendingScroll.clear();
    return out;
  }

  /**
   * 结算**到期**的暂存（兜底，非失焦）：
   * - 编辑：超过 `editMaxHoldMs` 未失焦；
   * - 光标：超过 `cursorMaxHoldMs` 未跳跃；
   * - 滚动：`dueTs` 到期（滑动窗口静默结束，且不超过 `scrollMaxHoldMs`）。
   */
  private settleExpired(now: number): EmittedEvent[] {
    const out: EmittedEvent[] = [];

    for (const [key, stage] of [...this.editStages.entries()]) {
      if (now - stage.firstTs > this.cfg.editMaxHoldMs) {
        this.editStages.delete(key);
        const e = this.materializeEdit(stage);
        if (e) out.push(e);
      }
    }
    if (this.editStages.size === 0) this.lastEdit = null;

    for (const [key, p] of [...this.pendingSelection.entries()]) {
      if (now - p.firstTs > this.cfg.cursorMaxHoldMs) {
        this.pendingSelection.delete(key);
        const e = this.materializeSelection(p);
        if (e) out.push(e);
      }
    }

    for (const [key, p] of [...this.pendingScroll.entries()]) {
      if (p.dueTs <= now) {
        this.pendingScroll.delete(key);
        out.push(this.materializeScroll(p));
      }
    }
    return out;
  }

  /**
   * 生成合并后的编辑事件：取首条 before 与末条 after，重算行级 diff。
   * 净零编辑（before === after）整块丢弃（对齐 foreshadow）。
   */
  private materializeEdit(stage: EditStage): EmittedEvent | null {
    const before = String((stage.first as { beforeText?: string | null }).beforeText ?? "");
    const after = String((stage.last as { afterText?: string | null }).afterText ?? "");

    if (before === after) {
      // 净零编辑：往复操作后内容回到原样 → 整块丢弃
      this.s.merged += stage.count;
      return null;
    }

    this.s.emitted += 1;
    if (stage.count > 1) this.s.merged += stage.count - 1;

    const changes =
      stage.count > 1
        ? computeLineDiffHunks(before, after, this.cfg.editDiffPadding)
        : ((stage.last as { changes?: unknown }).changes ??
           computeLineDiffHunks(before, after, this.cfg.editDiffPadding));

    return {
      mergedCount: stage.count,
      evt: {
        ...stage.last,
        beforeText: before,
        afterText: after,
        changes,
        ts: stage.firstTs,
      } as unknown as CreditRawEvent,
    };
  }

  /**
   * 从 `agentToolUse` 为**未打开的文件**合成一条 AI 编辑行为。
   *
   * 编辑事件源自编辑器 model 变更，未打开的文件不会产生 textChanged，
   * 导致 Agent 改动未打开文件时该行为完全丢失（只剩工具调用记录）。
   * 这里用 Edit 的 `old_string`/`new_string`（Write 的 `content`）合成一条
   * `actor=ai` 的 edit，粒度为改动片段（不是全文）。
   *
   * 已打开的文件（baseContent 中有基线）不合成 —— 交给 textChanged 并回溯标 ai，避免重复。
   */
  private synthesizeAgentEdit(evt: CreditRawEvent, ts: number): EmittedEvent | null {
    if (!this.cfg.synthesizeAgentEdit) return null;
    const toolName = String((evt as { toolName?: string }).toolName ?? "");
    if (toolName !== "Edit" && toolName !== "Write" && toolName !== "MultiEdit") return null;

    const inp = (evt as { toolInput?: Record<string, unknown> }).toolInput;
    if (!inp || typeof inp !== "object") return null;

    const file =
      (typeof inp.file_path === "string" && inp.file_path) ||
      (typeof inp.filePath === "string" && inp.filePath) ||
      (typeof inp.path === "string" && inp.path) ||
      "";
    if (!file) return null;

    // 已打开（有内容基线）→ 交给真实 textChanged，避免重复计数
    if (this.baseContent.has(file)) return null;

    const before = typeof inp.old_string === "string" ? inp.old_string : null;
    const after =
      typeof inp.new_string === "string"
        ? inp.new_string
        : typeof inp.content === "string"
          ? inp.content
          : null;
    if (before == null && after == null) return null; // 无内容信息，不合成

    this.s.emitted += 1;
    return {
      mergedCount: 1,
      evt: {
        type: "textChanged",
        uri: file,
        beforeText: before ?? "",
        afterText: after ?? "",
        changes: computeLineDiffHunks(before ?? "", after ?? "", this.cfg.editDiffPadding),
        source: "agent", // → actorOf 判为 ai
        ts,
        fidelity: "frontend",
      } as unknown as CreditRawEvent,
    };
  }

  // ——— 滚动与选择：窗口合并 ———

  /** 两段行区间是否有交集（端点相接也算） */
  private rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
    return Math.max(a1, b1) <= Math.min(a2, b2);
  }

  /**
   * 滚动合并（**行号区间相交，递归**，不看时间、不设条数上限）：
   *
   * - 新 scroll 与暂存区间**相交** → 合并取并集（并集继续参与后续判定，即递归扩张）；
   * - **不相交** → 说明滚动跳到了另一区域，结算上一段并开启新段。
   *
   * 结算的其余时机只有**注意力转移**（黑名单事件：切换文件、问 Agent、终端、Accept…）
   * 或显式 flush；cursor / 同文件编辑属白名单，不打断滚动。
   */
  private mergeScroll(uri: string, evt: CreditRawEvent, now: number): EmittedEvent[] {
    const out: EmittedEvent[] = [];
    const key = `scroll|${uri}`;
    const vp = (evt as { viewport?: { firstLine?: number; lastLine?: number } }).viewport;
    const dwell = Number((evt as { dwellMs?: number }).dwellMs ?? 0) || 0;
    const f = vp?.firstLine ?? 0;
    const l = vp?.lastLine ?? 0;
    const existing = this.pendingScroll.get(key);

    if (existing) {
      const ef = existing.firstLine ?? f;
      const el = existing.lastLine ?? l;
      if (this.rangesOverlap(ef, el, f, l)) {
        existing.count += 1;
        existing.lastTs = now;
        existing.firstLine = Math.min(ef, f);
        existing.lastLine = Math.max(el, l);
        existing.dwellMs = (existing.dwellMs ?? 0) + dwell;
        existing.evt = evt;
        existing.dueTs = existing.firstTs + this.cfg.scrollMaxHoldMs;
        this.scheduleTimer(now, this.cfg.scrollMaxHoldMs);
        return out;
      }
      // 跳到不相交区域 → 结算上一段
      this.pendingScroll.delete(key);
      out.push(this.materializeScroll(existing));
    }

    this.pendingScroll.set(key, {
      key,
      kind: "scroll",
      dueTs: now + this.cfg.scrollMaxHoldMs,
      evt,
      count: 1,
      firstTs: now,
      lastTs: now,
      firstLine: f,
      lastLine: l,
      dwellMs: dwell,
    });
    this.scheduleTimer(now, this.cfg.scrollMaxHoldMs);
    return out;
  }

  /**
   * 光标合并（行容忍度）：同一文件内，新位置与上一次相差不超过 `cursorMergeLineThr`
   * 视为同一次停留 —— 合并并累加 dwellMs，位置更新为最新。
   * 行跳跃超过阈值则先结算上一段（表示注意力移到了别处）。
   */
  private mergeSelection(
    key: string,
    evt: CreditRawEvent,
    now: number,
  ): EmittedEvent[] {
    const out: EmittedEvent[] = [];
    const fullKey = `sel|${key}`;
    const dwell = Number((evt as { dwellMs?: number }).dwellMs ?? 0) || 0;
    const line = Number((evt as { line?: number }).line ?? 0) || 0;
    const existing = this.pendingSelection.get(fullKey);

    if (existing && Math.abs(line - existing.line) <= this.cfg.cursorMergeLineThr) {
      existing.count += 1;
      existing.lastTs = now;
      existing.dwellMs = (existing.dwellMs ?? 0) + dwell;
      existing.line = line; // 位置取最新
      existing.evt = evt;
      this.scheduleTimer(now, this.cfg.cursorMaxHoldMs);
      return out;
    }

    // 行跳跃超阈值 → 结算上一段
    if (existing) {
      this.pendingSelection.delete(fullKey);
      const e = this.materializeSelection(existing);
      if (e) out.push(e);
    }
    this.pendingSelection.set(fullKey, {
      key: fullKey,
      kind: "selection",
      dueTs: now + this.cfg.cursorMaxHoldMs,
      evt,
      count: 1,
      firstTs: now,
      lastTs: now,
      dwellMs: dwell,
      line,
    });
    this.scheduleTimer(now, this.cfg.cursorMaxHoldMs);
    return out;
  }

  private materializeScroll(p: PendingScroll): EmittedEvent {
    this.s.emitted += 1;
    if (p.count > 1) this.s.merged += p.count - 1;
    const base = p.evt as { viewport?: { firstLine: number; lastLine: number } };
    return {
      mergedCount: p.count,
      evt: {
        ...p.evt,
        viewport: {
          firstLine: p.firstLine === Infinity ? 0 : (p.firstLine ?? base.viewport?.firstLine ?? 0),
          lastLine: p.lastLine === -Infinity ? 0 : (p.lastLine ?? base.viewport?.lastLine ?? 0),
        },
        dwellMs: p.dwellMs ?? 0,
        ts: p.firstTs,
      } as unknown as CreditRawEvent,
    };
  }

  private materializeSelection(p: PendingSelection): EmittedEvent {
    this.s.emitted += 1;
    if (p.count > 1) this.s.merged += p.count - 1;
    return {
      mergedCount: p.count,
      evt: { ...p.evt, dwellMs: p.dwellMs ?? 0, ts: p.firstTs } as unknown as CreditRawEvent,
    };
  }

  // ——— 公共内部 ———

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private tsOf(evt: CreditRawEvent): number {
    const t = (evt as { ts?: number }).ts;
    return typeof t === "number" && Number.isFinite(t) ? t : Date.now();
  }

  /**
   * 定时器：只处理**到期**的滚动/选择，以及超过 `editMaxHoldMs` 的编辑兜底。
   *
   * 关键：绝不能在此调用 `flushPending()` —— 那会把尚在聚焦中的编辑暂存一并结算，
   * 导致"滚动一下就把正在进行的编辑切成两段"（滚动的 600ms 窗口远短于编辑节奏）。
   * 编辑只应由**失焦**或 `editMaxHoldMs` 超时结算。
   */
  private scheduleTimer(_now: number, delay: number): void {
    if (typeof setTimeout !== "function") return;
    if (this.timer) return; // 已有定时器在跑，到点会统一处理
    if (this.editStages.size === 0 && this.pendingScroll.size === 0 && this.pendingSelection.size === 0) {
      this.clearTimer();
      return;
    }
    const d = Math.max(0, Number.isFinite(delay) ? delay : 0);
    this.timer = setTimeout(() => {
      this.timer = null;
      const now = Date.now();
      // 只结算**到期/超时**的：编辑与光标的兜底时长、滚动的静默到期
      const out = this.settleExpired(now);
      // 仍有未到期暂存 → 按最早到期时间重排下一次
      if (this.editStages.size > 0 || this.pendingScroll.size > 0 || this.pendingSelection.size > 0) {
        let nextDelay = this.cfg.editMaxHoldMs;
        if (this.pendingSelection.size > 0) {
          nextDelay = Math.min(nextDelay, this.cfg.cursorMaxHoldMs);
        }
        for (const p of this.pendingScroll.values()) {
          nextDelay = Math.min(nextDelay, Math.max(0, p.dueTs - now));
        }
        this.scheduleTimer(now, nextDelay);
      }
      if (out.length > 0 && this.onFlush) {
        try {
          this.onFlush(out);
        } catch {
          /* 回调异常不冒泡到定时器（§5 旁路纪律） */
        }
      }
    }, d);
  }
}
