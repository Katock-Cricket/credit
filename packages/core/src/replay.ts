/**
 * raw 层重放（P2-pre T2，决策 D-013）。
 *
 * **为何需要**：P1 采集时把 `sessionId`/`toolName`/`toolInput` 丢弃或错放进了 `object.uri`
 * （见架构 §5.2.1）。由于 `raw/<prId>.jsonl` 是**原始事件全量**，修好归一化层后从 raw 重跑
 * 即可让三个字段**原生恢复** —— 比对 `behaviors/` 打补丁只能救回前两者，`toolInput` 永远不可恢复。
 *
 * **核心要求**：重放必须与实时采集走**完全相同的**归一化 + 治理逻辑，否则重放结果不可信。
 * 为此 `createBridge()` 与 `replayRaw()` 共用 `IngressGovernor`、`toBehavior`、
 * `createAgentEditTracker` 三件套，仅"是否落盘 / 是否检查会话状态"不同。
 *
 * **已知限制**：治理层的兜底滞留（`editMaxHoldMs` / `scrollMaxHoldMs` / `cursorMaxHoldMs`）
 * 依赖真实时钟。重放是同步快进，兜底不会被触发 —— 正常路径（失焦驱动）不受影响，
 * 若某段数据当初是靠兜底结算的，重放会按"注意力转移"重新结算，可能略有差异。
 */
import type { Behavior, CreditRawEvent } from "@credit/protocol";
import { PROTOCOL_VERSION } from "@credit/protocol";
import { IngressGovernor, type EmittedEvent } from "./ingress/governor.js";
import { toBehavior } from "./ingress/normalize.js";
import { createAgentEditTracker } from "./ingress/agent-edit-tracker.js";
import { DEFAULT_CREDIT_CONFIG, mergeConfig, type CreditConfig } from "./config.js";
import { nullGitPort, type GitPort } from "./git-port.js";

export interface ReplayStats {
  /** 读入的 raw 事件数（有效行） */
  input: number;
  /** 产出的 Behavior 数 */
  emitted: number;
  /** D-019：空 cmd 的 terminalCommand 丢弃数 */
  droppedEmptyCmd: number;
  /** 治理层折叠掉的事件数（merged） */
  merged: number;
  /** 治理层识别的基线事件数（D-007：不产出 Behavior） */
  baseline: number;
}

export interface ReplayResult {
  prId: string;
  behaviors: Behavior[];
  stats: ReplayStats;
}

export interface ReplayOptions {
  prId: string;
  /** 原始事件（顺序任意，内部按 ts 升序稳定排序） */
  events: CreditRawEvent[];
  /** 配置覆盖（默认 `DEFAULT_CREDIT_CONFIG`） */
  config?: Partial<CreditConfig> | null;
  /** accept 行数兜底 Port；默认 `nullGitPort`（不兜底） */
  gitPort?: GitPort;
}

/**
 * 从原始事件重放产出 Behavior 流。
 *
 * 与 `createBridge().publish()` 的差异（仅此三项）：
 * 1. 不检查会话状态（重放不受"启停语义"约束）；
 * 2. 不落盘（结果以数组返回，由调用方决定写入方式）；
 * 3. 不做单事件耗时预算告警。
 */
export function replayRaw(opts: ReplayOptions): ReplayResult {
  const cfg = mergeConfig(DEFAULT_CREDIT_CONFIG, opts.config ?? {});
  const prId = opts.prId;
  const git = opts.gitPort ?? nullGitPort;

  // 稳定排序：仅按 ts 升序，同 ts 保持输入顺序（与实时采集的到达顺序一致）
  const events = [...opts.events].sort((a, b) => {
    const ta = (a as { ts?: number }).ts ?? 0;
    const tb = (b as { ts?: number }).ts ?? 0;
    return ta - tb;
  });

  const behaviors: Behavior[] = [];
  const agentEdits = createAgentEditTracker(cfg);
  const stats: ReplayStats = {
    input: events.length,
    emitted: 0,
    droppedEmptyCmd: 0,
    merged: 0,
    baseline: 0,
  };
  let seq = 0;

  const emit = ({ evt, mergedCount }: EmittedEvent): void => {
    // accept 行数兜底（与 createBridge.emit 一致；默认 nullGitPort 时不生效）
    let out: CreditRawEvent = evt;
    if (evt.type === "userAccept") {
      const acc = evt as { diffStats?: unknown; fileUris?: string[] };
      if (!acc.diffStats) {
        const num = git.diffNumstat(acc.fileUris ?? []);
        if (num) out = { ...evt, diffStats: num } as CreditRawEvent;
      }
    }

    // 先探测再取 seq：被归一化层丢弃的事件不消耗序号，避免 id 空洞
    const probe = toBehavior(out, prId, 0, cfg);
    if (!probe) {
      stats.droppedEmptyCmd++;
      return;
    }
    seq++;
    probe.id = `${prId}-${seq}`;
    if (mergedCount > 1) probe.context.mergedCount = mergedCount;
    behaviors.push(probe);
    stats.emitted++;
  };

  const governor = new IngressGovernor({
    cfg,
    onFlush: (evts: EmittedEvent[]) => {
      for (const e of evts) emit(e);
    },
  });

  try {
    for (const evt of events) {
      // 1) agent 工具编辑登记（供 textChanged 回溯标 ai）
      if (evt.type === "agentToolUse") {
        agentEdits.recordFromToolUse(
          (evt as { toolInput?: unknown }).toolInput,
          (evt as { ts?: number }).ts ?? Date.now(),
        );
      }

      // 2) textChanged 回溯关联
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

      // 3) 治理 → 输出
      for (const e of governor.push(evtForNorm)) emit(e);
    }

    // 4) 冲刷尾部暂存（实时采集由 finish/flush 触发）
    for (const e of governor.flushPending()) emit(e);
  } finally {
    governor.dispose();
  }

  stats.merged = governor.stats.merged;
  stats.baseline = governor.stats.baseline;

  return { prId, behaviors, stats };
}

/**
 * 序列化为 behaviors jsonl 文本，行格式与 `BehaviorStore.append()` 保持一致
 * （每条追加 `v: PROTOCOL_VERSION`）。
 */
export function toBehaviorsJsonl(behaviors: Behavior[]): string {
  if (behaviors.length === 0) return "";
  return behaviors.map((b) => JSON.stringify({ ...b, v: PROTOCOL_VERSION })).join("\n") + "\n";
}
