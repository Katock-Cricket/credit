/**
 * AI Review 语义反推（P2-pre T5，决策 D-015）。
 *
 * **为何反推而不新建 `review-bridge`**：用户未必使用 Bitfun 内置 review 子 agent，
 * 也可能以自定义规则与主 agent 交互完成审阅 —— 只认内置形态会漏判后者。
 *
 * **三级置信度**（SPEC §6）：
 * - L1 强：会话 id 具 review 子会话特征 / 工具名为 `submit_code_review`
 * - L2 中：Dev Prompt 含审阅语义词
 * - L3 弱：AI 消息含 finding 结构化输出
 *
 * **产出落 `tasks/<prId>.json`，不回写 `behaviors/`** —— 采集层是证据、分析层是推断，
 * 二者不得混流（架构 §1.1 单向数据流）。
 */
import type { Behavior } from "@credit/protocol";
import { mergeTaskConfig, type TaskConfig } from "./config.js";
import type { ReviewSession } from "./types.js";

type Level = "L1" | "L2" | "L3";
const LEVEL_CONFIDENCE: Record<Level, number> = { L1: 0.9, L2: 0.6, L3: 0.3 };
const LEVEL_RANK: Record<Level, number> = { L1: 3, L2: 2, L3: 1 };

/**
 * 最后一枚锚点之后的"执行窗口"：覆盖 AI 真正执行 review 的那段时间
 * （读代码、分析、产出 finding），但止于 review 之后的按意见修复。
 */
const EXEC_WINDOW_MS = 180_000; // 3min

function hasAny(text: string | undefined | null, words: string[]): boolean {
  if (!text) return false;
  const t = String(text).toLowerCase();
  return words.some((w) => t.includes(String(w).toLowerCase()));
}

export interface ReviewSignal {
  level: Level;
  /**
   * 是否为**锚点**（能发起一轮 review）。
   *
   * 关键区分：初版只要 sessionId 是 review 子会话就判 L1，导致该会话下的
   * **每一条** AI 消息/工具调用都成锚点 —— 结果"按 Review 意见修复"的整段执行
   * 被算进 review 会话（P1 样例中第 2 轮吞掉 99 条行为、跨度 17 分钟）。
   * 现只有**发起性行为**（Dev prompt / review 专用工具）才算锚点。
   */
  anchor: boolean;
}

/** 单条 behavior 的 review 信号（无命中返回 null） */
export function reviewSignalOf(b: Behavior, cfg: TaskConfig): ReviewSignal | null {
  const sid = b.context?.sessionId ?? "";
  const tool = b.context?.toolName ?? "";
  const isReviewSid =
    !!cfg.reviewSessionPattern &&
    sid.toLowerCase().includes(cfg.reviewSessionPattern.toLowerCase());
  const isReviewTool = cfg.reviewToolNames.some(
    (n) => tool.toLowerCase() === n.toLowerCase(),
  );

  // L1 锚点：review 子会话下的 Dev prompt，或 review 专用工具
  if ((isReviewSid && b.action === "prompt.submit") || isReviewTool) {
    return { level: "L1", anchor: true };
  }

  // L2 锚点：非 review 子会话，但 Dev prompt 含审阅语义
  // （覆盖"用主 agent + 自定义规则做 review"的形态，决策 D-015）
  if (b.action === "prompt.submit") {
    const text = b.context?.promptText ?? "";
    if (hasAny(text, cfg.reviewPromptWords)) return { level: "L2", anchor: true };
  }

  // L1 补充：review 子会话下的其他行为（AI 消息 / 工具调用）—— 不算锚点
  if (isReviewSid) return { level: "L1", anchor: false };

  // L3 补充：AI 消息含 finding 结构化输出 —— 不算锚点
  if (b.action === "agent.message") {
    const text = typeof b.context?.after === "string" ? b.context.after : "";
    if (hasAny(text, cfg.findingPatterns)) return { level: "L3", anchor: false };
  }

  return null;
}

/** 单条 behavior 是否属于 review（供 S4 切分信号与阶段归类共用） */
export function isReviewBehavior(b: Behavior, cfgIn?: Partial<TaskConfig>): boolean {
  return reviewSignalOf(b, mergeTaskConfig(cfgIn)) !== null;
}

/** 从 prompt 文本判别处置语义（算法 §3.7.5） */
function detectDisposition(behaviors: Behavior[]): { disposition: string | null; evidence: string } {
  for (const b of behaviors) {
    if (b.action !== "prompt.submit") continue;
    const t = String(b.context?.promptText ?? "");
    if (!t) continue;
    const low = t.toLowerCase();
    if (/selected\s+review\s+findings|selected\s+findings|remediation\s+for\s+selected/i.test(low)) {
      return { disposition: "selected", evidence: b.id };
    }
    if (/dismiss|won'?t\s*fix|不修|忽略/i.test(low)) {
      return { disposition: "dismissed", evidence: b.id };
    }
    if (/all\s+findings|fix\s+all|全部修复|全部采纳/i.test(low)) {
      return { disposition: "all", evidence: b.id };
    }
  }
  return { disposition: null, evidence: "" };
}

/**
 * 识别 Review 会话。
 *
 * 分组：按 `sessionId` 聚组；同组内若间隔超过 `idleGapMs` 则拆为多轮
 * （用户用主 agent 做 review 时，多轮 review 会落在同一 sessionId 下）。
 */
export function detectReviewSessions(
  behaviors: Behavior[],
  cfgOverride?: Partial<TaskConfig>,
): ReviewSession[] {
  const cfg = mergeTaskConfig(cfgOverride);

  // 1) 收集命中 signal 的行为
  const hits: Array<{ b: Behavior; level: Level }> = [];
  for (const b of behaviors) {
    const sig = reviewSignalOf(b, cfg);
    if (sig) hits.push({ b, level: sig.level });
  }
  if (hits.length === 0) return [];

  // 2) **只有锚点能发起一轮 review**。
  //    L1 补充（review 会话下的 AI 消息/工具）与 L3（finding 结构）都只作补充 ——
  //    初版允许它们单独发起，在 P1 样例中造成 3 处误判。
  const anchors = hits.filter((h) => reviewSignalOf(h.b, cfg)?.anchor);
  if (anchors.length === 0) return [];

  // 3) 锚点按 sessionId 分组，组内再按空档切轮次
  const groups = new Map<string, Array<{ b: Behavior; level: Level }>>();
  for (const h of anchors) {
    const key = h.b.context?.sessionId || "anon";
    const arr = groups.get(key) ?? [];
    arr.push(h);
    groups.set(key, arr);
  }

  const rounds: Array<{ sid: string; items: Array<{ b: Behavior; level: Level }> }> = [];
  for (const [sid, items] of groups) {
    items.sort((x, y) => x.b.ts - y.b.ts);
    let cur: Array<{ b: Behavior; level: Level }> = [];
    for (const it of items) {
      const prev = cur[cur.length - 1];
      if (prev && it.b.ts - prev.b.ts > cfg.idleGapMs && cur.length > 0) {
        rounds.push({ sid, items: cur });
        cur = [];
      }
      cur.push(it);
    }
    if (cur.length > 0) rounds.push({ sid, items: cur });
  }

  if (rounds.length === 0) return [];
  rounds.sort((a, b) => (a.items[0]?.b.ts ?? 0) - (b.items[0]?.b.ts ?? 0));

  // 4) 组装。**时间范围 = 锚点区间 + 执行窗口，且不越过下一轮起点**。
  //    - 不延伸：review 之后"按意见修复"的执行会被吞进 review（初版吞掉 99 条行为）；
  //    - 不只用锚点：只有 1 个锚点的轮次（如 P1 样例第 1 轮）会丢掉 AI 执行 review 的行为。
  const starts = rounds.map((r) => r.items[0]!.b.ts);
  const sessions: ReviewSession[] = rounds.map((r, i) => {
    const bs = r.items.map((x) => x.b);
    const startTs = starts[i]!;
    const lastAnchorTs = bs[bs.length - 1]!.ts;
    const nextStart = starts[i + 1];
    const endTs = Math.min(
      nextStart ?? Number.POSITIVE_INFINITY,
      lastAnchorTs + EXEC_WINDOW_MS,
    );

    // 落在 [startTs, endTs] 内的全部 review 信号行为（含 AI 执行 review 的过程），
    // 而非只有锚点本身 —— 阶段标注靠这个集合判定"某窗口是否属于 review"。
    const all = hits
      .filter((h) => h.b.ts >= startTs && h.b.ts <= endTs)
      .map((h) => h.b)
      .sort((a, b) => a.ts - b.ts);

    const level = r.items.reduce<Level>(
      (acc, x) => (LEVEL_RANK[x.level] > LEVEL_RANK[acc] ? x.level : acc),
      "L3",
    );
    const { disposition, evidence } = detectDisposition(all);

    return {
      id: `review-${i + 1}`,
      sessionId: r.sid,
      level,
      confidence: LEVEL_CONFIDENCE[level],
      startTs,
      endTs,
      behaviorIds: all.map((x) => x.id),
      roundIndex: i + 1,
      disposition,
      evidence,
    };
  });

  return sessions;
}
