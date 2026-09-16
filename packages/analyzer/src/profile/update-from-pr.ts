/**
 * F2 本地增量更新（决策 D-041 / D-042）。
 *
 * **与 PR_Credit 重算完全解耦**：本模块只消费已落盘的 `pr_credit/<prId>.json`，
 * 不触发任何重算。宿主可任选时机调用（credit 落盘后 hook / 调试端点手动触发）。
 *
 * **幂等**（D-041）：`upsertHistoryTask` 以 prId + creditFingerprint 判重，
 * 重复触发返回 skipped，绝不重复累计。
 */
import {
  ensureKeywordEntries,
  upsertHistoryTask,
  type DevProfile,
  type HistoryTask,
} from "./types.js";
import { isInitialized } from "./types.js";

/** pr_credit/<prId>.json 中 P3 增量更新消费的字段（compute.ts 产出） */
export interface ProfileFeed {
  /** 本次 PR 关键词（D-042：计算期共享提取，缺失时宿主补提） */
  profileKeywords: string[] | null;
  /** 本次 AI 协作行数（coreDiff.aiLines 总行数） */
  aiCollabLines: number;
}

export interface ApplyPrResultInput {
  prId: string;
  /** pr_credit.generatedAt */
  ts: number;
  repo?: string;
  prCredit: number;
  /** pr_credit.generator.inputFingerprint（幂等锚点） */
  creditFingerprint?: string;
  feed: Partial<ProfileFeed>;
  /** feed.profileKeywords 缺失时由宿主补提后传入（D-042） */
  keywords?: string[] | null;
}

export interface ApplyPrResultOutcome {
  changed: boolean;
  reason: "added" | "updated" | "skipped" | "not-initialized" | "no-keywords";
  profile: DevProfile;
}

/**
 * 将一次 PR_Credit 结果应用进画像。**不回填当前次**的近N次平均语义：
 * 本条目进入 historyTasks 后，从下一次计算开始参与（避免自指）。
 */
export function applyPrResult(p: DevProfile, input: ApplyPrResultInput): ApplyPrResultOutcome {
  if (!isInitialized(p)) {
    return { changed: false, reason: "not-initialized", profile: p };
  }

  const keywords = input.keywords ?? input.feed.profileKeywords ?? [];
  if (keywords.length === 0) {
    // 关键词全缺（Task 无描述且无 git diff）—— 条目仍 upsert（prCredit 参与近N次平均），
    // 但不产生关键词触达
  }

  const task: HistoryTask = {
    prId: input.prId,
    ts: input.ts,
    repo: input.repo,
    keywords,
    aiCollabLines: Math.max(0, Number(input.feed.aiCollabLines ?? 0) || 0),
    prCredit: Math.max(0, Number(input.prCredit ?? 0) || 0),
    creditFingerprint: input.creditFingerprint,
    status: "committed",
    source: "local",
  };

  const up = upsertHistoryTask(p, task);
  if (!up.changed) {
    return { changed: false, reason: "skipped", profile: p };
  }
  ensureKeywordEntries(p, keywords, "local");
  return { changed: true, reason: up.reason, profile: p };
}
