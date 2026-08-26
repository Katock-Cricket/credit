/**
 * @credit/core 公共入口。
 * 组合 ingress 归一化 + BehaviorStore + SessionManager + CreditLogger。
 * 桥只调用 createBridge().publish(evt)，异常自捕获在桥侧（§5 纪律）。
 */
import type { CreditRawEvent } from "@credit/protocol";
import { BehaviorStore, type StoreOptions } from "./store/jsonl-store.js";
import { SessionManager } from "./session/session-manager.js";
import { CreditLogger, type LoggerOptions } from "./logging/logger.js";
import {
  toBehavior,
  DEFAULT_INGRESS_CONFIG,
  type IngressConfig,
} from "./ingress/normalize.js";

export * from "./store/jsonl-store.js";
export * from "./session/session-manager.js";
export * from "./logging/logger.js";
export * from "./ingress/normalize.js";
export type { FsPort } from "./fs-port.js";

export interface BridgeOptions {
  store?: StoreOptions;
  logger?: LoggerOptions;
  ingress?: Partial<IngressConfig>;
  /** 单事件处理预算（ms），超限丢弃并计数告警（§7.2） */
  budgetMs?: number;
}

export interface BridgeSink {
  publish(evt: CreditRawEvent): void;
  readonly session: SessionManager;
  readonly store: BehaviorStore;
  readonly logger: CreditLogger;
  flush(): Promise<void>;
}

export function createBridge(opts: BridgeOptions = {}): BridgeSink {
  const logger = new CreditLogger(opts.logger);
  const store = new BehaviorStore(opts.store);
  const session = new SessionManager(store);
  const ingressCfg: IngressConfig = { ...DEFAULT_INGRESS_CONFIG, ...opts.ingress };
  const budgetMs = opts.budgetMs ?? 1;

  // —— agent 编辑回溯关联（§R-actor）——
  // 前端 textChanged 由 agent 写盘 → CodeEditor 异步 reload 触发，往往晚于 agentToolUse 事件，
  // 导致实时 source 判定失效。此处维护"agent 编辑过的文件 + 时间"，textChanged 到达时回溯
  // 窗口（AGENT_EDIT_LOOKUP_MS）匹配，命中则强制 source="agent"（actor=ai）。
  const AGENT_EDIT_LOOKUP_MS = 30_000;
  const recentAgentEdits = new Map<string, number[]>(); // normalizedUri -> [ts,...]
  const normUri = (u: string): string =>
    String(u ?? "")
      .replace(/^file:\/\//i, "")
      .replace(/\\/g, "/")
      .toLowerCase()
      .replace(/\/+$/, "");

  const recordAgentEdit = (uri: string, ts: number) => {
    const k = normUri(uri);
    if (!k) return;
    const arr = recentAgentEdits.get(k) ?? [];
    arr.push(ts);
    // 仅保留窗口内的记录
    const cutoff = ts - AGENT_EDIT_LOOKUP_MS;
    recentAgentEdits.set(
      k,
      arr.filter((t) => t >= cutoff),
    );
  };

  const isAgentEditedFile = (uri: string, ts: number): boolean => {
    const arr = recentAgentEdits.get(normUri(uri));
    if (!arr || arr.length === 0) return false;
    const cutoff = ts - AGENT_EDIT_LOOKUP_MS;
    return arr.some((t) => t >= cutoff);
  };

  return {
    session,
    store,
    logger,
    async flush() {
      await store.flush();
    },
    publish(evt: CreditRawEvent) {
      const t0 = performance.now();
      try {
        // 记录 agent 工具编辑的文件（agentToolUse 含文件 + ts），供后续 textChanged 回溯关联
        if (evt.type === "agentToolUse") {
          const inp = (evt as { toolInput?: any }).toolInput;
          const uriCandidates: string[] = [];
          if (inp && typeof inp === "object") {
            for (const k of [
              "file_path",
              "filePath",
              "filepath",
              "target_file",
              "targetFile",
              "path",
              "filename",
              "target",
              "file",
              "abs_path",
            ]) {
              const v = inp[k];
              if (typeof v === "string" && (v.includes("/") || v.includes("\\"))) {
                uriCandidates.push(v);
              }
            }
          }
          const ts = (evt as { ts?: number }).ts ?? Date.now();
          for (const u of uriCandidates) recordAgentEdit(u, ts);
        }

        // textChanged 回溯关联：若文件近期被 agent 编辑，强制 source=agent
        let evtForNorm: CreditRawEvent = evt;
        if (
          evt.type === "textChanged" &&
          (evt as { source?: string }).source !== "agent" &&
          isAgentEditedFile((evt as { uri?: string }).uri ?? "", (evt as { ts?: number }).ts ?? Date.now())
        ) {
          evtForNorm = { ...evt, source: "agent" } as CreditRawEvent;
        }

        if (!session.current) {
          // 未显式 start 时自动开一个会话（P0 容错）
          session.start(`pr-${new Date().toISOString().slice(0, 10)}`).catch(() => {});
        }
        const prId = session.prId;
        const seq = session.nextSeq();
        const behavior = toBehavior(evtForNorm, prId, seq, ingressCfg);
        store.append(prId, behavior);
        session.bumpCount(ingressCfg.source);
        const cost = performance.now() - t0;
        if (cost > budgetMs) {
          logger.warn(
            ingressCfg.source,
            `event over budget`,
            { type: evt.type, costMs: Number(cost.toFixed(3)), budgetMs },
          );
        }
      } catch (e) {
        // core 内部异常不应冒泡到桥/事件源（§5）
        logger.error(ingressCfg.source, "ingress failed", {
          type: (evt as { type?: string }).type,
          error: String(e),
        });
      }
    },
  };
}

