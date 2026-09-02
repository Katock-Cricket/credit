/**
 * @credit/core 公共入口（P1 数据层）。
 *
 * 链路：配置 → 治理（governor 合并/降噪/基线）→ 归一化（toBehavior）→ 双层存储；
 * 会话状态机与日志旁路。桥只调用 `createBridge().publish(evt)`，异常自捕获在桥侧（§5 纪律）。
 *
 * 双层落盘（P1 §2.2）：
 * - `raw/<prId>.jsonl`       原始事件全量（审计与重放基线，只追加）
 * - `behaviors/<prId>.jsonl` 治理后 Behavior（数据层输出，P2 直接消费）
 */
import type { CreditRawEvent } from "@credit/protocol";
import { BehaviorStore, type StoreOptions } from "./store/jsonl-store.js";
import { SessionManager, makePrId, type RecoverReport } from "./session/session-manager.js";
import { CreditLogger, type LoggerOptions } from "./logging/logger.js";
import { toBehavior, type IngressConfig } from "./ingress/normalize.js";
import { createAgentEditTracker } from "./ingress/agent-edit-tracker.js";
import {
  IngressGovernor,
  type GovernorStats,
  type EmittedEvent,
} from "./ingress/governor.js";
import { DEFAULT_CREDIT_CONFIG, mergeConfig, type CreditConfig } from "./config.js";
import { nullGitPort, type GitPort } from "./git-port.js";

export * from "./store/jsonl-store.js";
export * from "./session/session-manager.js";
export * from "./logging/logger.js";
export * from "./ingress/normalize.js";
export * from "./ingress/governor.js";
export * from "./ingress/agent-edit-tracker.js";
export * from "./replay.js";
export * from "./config.js";
export * from "./git-port.js";
export * from "./identify/file-role.js";
export type { FsPort } from "./fs-port.js";

/**
 * 构建标识：每次修改 core 后手动递增。
 * 用途：Bitfun 侧打印此值，确认运行时加载的是哪一份 core dist
 * （core 已排除 Vite 预构建，但进程内模块缓存仍需重启 dev server 才更新）。
 */
export const CORE_BUILD_ID = "p1-save-flush-20260901-6";

export interface BridgeOptions {
  store?: StoreOptions;
  logger?: LoggerOptions;
  ingress?: Partial<IngressConfig>;
  /** P1：完整配置（覆盖默认值）；可先用 loadConfig() 从 config.json 加载后传入 */
  config?: Partial<CreditConfig>;
  /** P1：git 能力 Port（accept 行数兜底，T6）；默认 nullGitPort（不兜底） */
  gitPort?: GitPort;
  /** 单事件处理预算（ms），超限告警（§7.2） */
  budgetMs?: number;
}

export interface BridgeSink {
  publish(evt: CreditRawEvent): void;
  readonly session: SessionManager;
  readonly store: BehaviorStore;
  readonly logger: CreditLogger;
  readonly config: CreditConfig;
  readonly governor: IngressGovernor;
  /** 断点恢复（挂载时调用一次）：recording 续采 / computing 回退 / 其余等待 */
  recover(): Promise<RecoverReport>;
  /** 冲刷治理 pending（同步）+ 落盘（异步） */
  flush(): Promise<void>;
  /** 仅同步冲刷治理 pending（测试、会话切换、getStatus 前） */
  flushPending(): void;
  /** 丢弃全部治理暂存（放弃本轮记录时用，不产出、不落盘） */
  discardPending(): void;
  /** 治理统计：baseline（基线事件数）/ merged（折叠数）/ emitted（输出数） */
  readonly stats: GovernorStats;
  /** 同步外部进程（MiniApp 原型）写入的 session.json；有变更返回 true */
  syncSession(): Promise<boolean>;
  /** 将内存会话（含最新 seq/counts 与治理统计）写回 session.json，使跨进程可见 */
  persist(): Promise<void>;
  dispose(): void;
}

export function createBridge(opts: BridgeOptions = {}): BridgeSink {
  const logger = new CreditLogger(opts.logger);
  const store = new BehaviorStore(opts.store);
  const session = new SessionManager(store);
  const cfg: CreditConfig = mergeConfig(DEFAULT_CREDIT_CONFIG, opts.config ?? {});
  const budgetMs = opts.budgetMs ?? 1;
  const git = opts.gitPort ?? nullGitPort;

  // —— agent 编辑回溯关联（P0 §R-actor）——
  // 前端 textChanged 由 agent 写盘 → CodeEditor 异步 reload 触发，往往晚于 agentToolUse，
  // 导致实时 source 判定失效。此处维护"agent 编辑过的文件 + 时间"，textChanged 到达时
  // 回溯窗口匹配，命中则强制 source="agent"（actor=ai）。
  // P2-pre：抽为独立模块，与 `replayRaw()` 共用同一套判定（见 ingress/agent-edit-tracker.ts）。
  const agentEdits = createAgentEditTracker(cfg);

  const governor = new IngressGovernor({
    cfg,
    onFlush: (events: EmittedEvent[]) => {
      for (const e of events) emit(e);
    },
  });

  function emit({ evt, mergedCount }: EmittedEvent): void {
    try {
      // T6：accept 行数兜底（同步，保证 raw/behaviors 行序一致）
      let out: CreditRawEvent = evt;
      if (evt.type === "userAccept") {
        const acc = evt as { diffStats?: unknown; fileUris?: string[] };
        if (!acc.diffStats) {
          const stats = git.diffNumstat(acc.fileUris ?? []);
          if (stats) out = { ...evt, diffStats: stats } as CreditRawEvent;
        }
      }
      // 启停语义（架构 §5.1-4）：仅当存在 state=recording 的会话时才归一化并落盘，
      // 其余（无会话 / idle / computing / committed）一律丢弃 —— 零成本。
      //
      // 注意：此处**不可**用 ensureStarted() 兜底建会话。那是 P0 为消除 `prId=unknown`
      // 污染引入的，但它架空了启停语义：用户在原型点"放弃本轮记录"之后，下一个事件
      // 会自动新建一个 recording 会话继续记录（2026-09-02 实测 bug）。
      const s = session.current;
      if (!s || s.state !== "recording") {
        logger.count(`${cfg.source}:dropped:notRecording`);
        return;
      }
      // 先探测：归一化层判定丢弃的事件（D-019：空 cmd 的 terminalCommand）
      // 不消耗 seq —— 否则 Behavior id 出现空洞，影响"seq 连续"的冒烟断言。
      const probe = toBehavior(out, s.prId, 0, cfg);
      if (!probe) {
        logger.count(`${cfg.source}:dropped:emptyCmd`);
        return;
      }
      const seq = session.nextSeq();
      probe.id = `${s.prId}-${seq}`;
      if (mergedCount > 1) probe.context.mergedCount = mergedCount;
      store.append(s.prId, probe);
      session.bumpCount(cfg.source);
    } catch (e) {
      // 单条输出失败不影响后续事件（§5 旁路纪律）
      logger.error(cfg.source, "emit failed", { error: String(e) });
    }
  }

  // 注：原 ensurePrId() 兜底建 prId 的逻辑已移除 —— 它与"非 recording 丢弃"的启停语义
  // 冲突（会在用户未开始/已放弃时为事件凭空造一个会话）。prId 一律来自显式 start。

  return {
    session,
    store,
    logger,
    config: cfg,
    governor,
    get stats() {
      return governor.stats;
    },
    async recover() {
      const report = await session.recover();
      logger.info(cfg.source, "recover", {
        action: report.action,
        from: report.from,
        prId: report.prId,
        reason: report.reason,
      });
      return report;
    },
    flushPending() {
      for (const e of governor.flushPending()) emit(e);
    },
    discardPending() {
      governor.discardPending();
    },
    async flush() {
      this.flushPending();
      await store.flush();
      await logger.flush();
    },
    async syncSession() {
      return session.syncFromDisk();
    },
    async persist() {
      await session.persist(governor.stats);
    },
    dispose() {
      governor.dispose();
    },
    publish(evt: CreditRawEvent) {
      const t0 = performance.now();
      try {
        // 1) raw 层：原始事件全量落盘（审计与重放基线，只追加）。
        //    与 behaviors 层共用启停判据（架构 §5.1-4）：非 recording 不落盘 ——
        //    否则"放弃本轮记录"之后，raw 层仍会留下无主数据（用一个兜底 prId 追加）。
        const cur = session.current;
        if (cur && cur.state === "recording") {
          store.appendRaw(cur.prId, evt);
        }

        // 2) agent 工具编辑登记（agentToolUse 含文件 target）
        if (evt.type === "agentToolUse") {
          const ts = (evt as { ts?: number }).ts ?? Date.now();
          agentEdits.recordFromToolUse((evt as { toolInput?: unknown }).toolInput, ts);
        }

        // 3) textChanged 回溯关联：近期被 agent 编辑过 → 强制 source=agent（actor=ai）
        let evtForNorm: CreditRawEvent = evt;
        if (
          evt.type === "textChanged" &&
          (evt as { source?: string }).source !== "agent" &&
          agentEdits.isAgentEdited(
            (evt as { uri?: string }).uri ?? "",
            (evt as { ts?: number }).ts ?? Date.now(),
          )
        ) {
          evtForNorm = { ...evt, source: "agent" } as CreditRawEvent;
        }

        // 4) 治理（合并/降噪/基线识别）→ 输出 Behavior
        for (const e of governor.push(evtForNorm)) emit(e);

        const cost = performance.now() - t0;
        if (cost > budgetMs) {
          logger.warn(cfg.source, "event over budget", {
            type: evt.type,
            costMs: Number(cost.toFixed(3)),
            budgetMs,
          });
        }
      } catch (e) {
        // core 内部异常不应冒泡到桥/事件源（§5）
        logger.error(cfg.source, "ingress failed", {
          type: (evt as { type?: string }).type,
          error: String(e),
        });
      }
    },
  };
}
