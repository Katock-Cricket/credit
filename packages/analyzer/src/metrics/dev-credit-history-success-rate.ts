/**
 * Dev_Credit·历史PR成功率（P3，算法 §5.3 修订版 + 决策 D-036）。
 *
 * **只统计 git-remote 来源**：分子 = 他人仓库 merged PR 数，分母 = 他人仓库发起的
 * 全部 PR（search API total_count）。本地 committed PR 既不入分子也不入分母
 * （本地无法观测 merged/revert）。
 *
 * `totalPrCount = 0` → `excluded_no_evidence`，历史PR组内重分配（只剩近N次平均）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult } from "../credit/types.js";
import { okR, noEvidenceR } from "./helpers.js";
import { pct } from "./helpers.js";

export async function devCreditHistorySuccessRate(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const profile = ctx.profile;
  if (!profile) return noEvidenceR(id, "无 Dev_Profile");

  const gs = profile.gitStats;
  if (!gs || gs.totalPrCount <= 0) {
    return noEvidenceR(id, "无 git 旁路 PR 数据（未同步或无他人仓库 PR）—— 本地 committed PR 不参与本指标（D-036）");
  }

  const score = pct(gs.mergedPrCount / gs.totalPrCount);
  return okR(
    id,
    score,
    `他人仓库 PR：${gs.mergedPrCount}/${gs.totalPrCount} merged（git 旁路 ${gs.lastSyncAt?.slice(0, 10) || "?"} 同步）`,
    [
      // P3 简化：不逐 PR 查 revert commit（成本不成比例），证据中明示口径
      { kind: "note", text: "口径：search API is:merged 计成功；revert 后续检测未做（revert-not-checked）" },
    ],
  );
}
