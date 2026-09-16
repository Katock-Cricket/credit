/**
 * Dev_Credit·近N次平均PR_Credit（P3，算法 §5.4，纯本地来源）。
 *
 * 最近 `N=10`（recentN）次 History_Tasks 的 prCredit 算术平均；
 * <3 次仍 ok（样本量标注在证据）。空 → `excluded_no_evidence`（组内重分配）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult } from "../credit/types.js";
import { okR, noEvidenceR } from "./helpers.js";

export async function devCreditHistoryRecentAvg(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const profile = ctx.profile;
  if (!profile) return noEvidenceR(id, "无 Dev_Profile");

  // 排除当前 PR 自身（算法 §5.4「不含当前次」）：结算后本 PR 条目才写入，
  // 若计入则本 PR 的下一轮计算会被自己抬高
  const tasks = profile.historyTasks.filter((t) => t.prId !== ctx.prId);
  if (tasks.length === 0) {
    return noEvidenceR(id, "无本地历史 PR（刚跑完 git 旁路尚未有本地结算）");
  }

  const n = Math.max(1, ctx.config.profile.recentN);
  const recent = [...tasks].sort((a, b) => b.ts - a.ts).slice(0, n);
  const avg = recent.reduce((a, t) => a + t.prCredit, 0) / recent.length;

  const sampleNote = tasks.length < 3 ? `（样本量 n=${tasks.length}，偏小）` : `（n=${recent.length}）`;
  return okR(
    id,
    avg,
    `最近 ${recent.length} 次本地 PR 的 PR_Credit 平均 ${avg.toFixed(1)}${sampleNote}`,
    [
      {
        kind: "note",
        text: `最近条目：${recent.slice(0, 3).map((t) => `${t.prId.slice(0, 20)}=${t.prCredit.toFixed(0)}`).join("、")}`,
      },
    ],
  );
}
