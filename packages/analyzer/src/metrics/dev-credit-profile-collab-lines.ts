/**
 * Dev_Credit·累计AI协作行数档（P3，算法 §5.2，纯本地来源）。
 *
 * 主域匹配子集（Task 关键词 ∩ 当前 PR 关键词）的 aiCollabLines 之和分档：
 * `<1k→10 | 1k–10k→40 | 10k–50k→70 | >50k→100`（collabTiers，含边界）。
 * History_Tasks 为空（git-only 画像）→ **按 git 行数分档**（D-043：与本地行数同单位，
 * 直接复用 `collabTiers`，不再另设 commit 档位表）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult } from "../credit/types.js";
import { kwNorm, matchedKeywords } from "../profile/types.js";
import { okR, noEvidenceR } from "./helpers.js";
import { ordinal } from "./helpers.js";

function tierIndex(total: number, tiers: readonly [number, number, number]): number {
  if (total > tiers[2]) return 3;
  if (total > tiers[1]) return 2;
  if (total > tiers[0]) return 1;
  return 0;
}

export async function devCreditProfileCollabLines(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const profile = ctx.profile;
  if (!profile) return noEvidenceR(id, "无 Dev_Profile");

  const currentKeywords = await ctx.profileKeywords();

  // 本地轨：主域匹配子集
  const cur = new Set(currentKeywords.map(kwNorm).filter(Boolean));
  // 排除当前 PR 自身：它不参与自己的评分（算法 §5.4 同旨）
  const subset = profile.historyTasks.filter(
    (t) => t.prId !== ctx.prId && t.keywords.some((k) => cur.has(kwNorm(k))),
  );
  if (subset.length > 0) {
    const total = subset.reduce((a, t) => a + t.aiCollabLines, 0);
    const idx = tierIndex(total, ctx.config.profile.collabTiers);
    return okR(
      id,
      ordinal(ctx, "collabLinesTier", idx),
      `主域匹配 ${subset.length} 次历史 PR，累计 AI 协作 ${total} 行 → 第 ${idx + 1} 档`,
      [{ kind: "note", text: `画像历史 PR 共 ${profile.historyTasks.length} 条` }],
    );
  }

  // git 兜底：History_Tasks 空（git-only 画像）→ 用 git 行数按**同一套档位**分档（D-043 同单位）
  if (profile.historyTasks.length === 0) {
    const gitLines = matchedKeywords(profile, currentKeywords).reduce((a, k) => a + k.gitLines, 0);
    const idx = tierIndex(gitLines, ctx.config.profile.collabTiers);
    return okR(
      id,
      ordinal(ctx, "collabLinesTier", idx),
      `无本地历史 PR，按 git 行数 ${gitLines} 行分档 → 第 ${idx + 1} 档`,
      [{ kind: "note", text: "AI 协作行数仅本地可观测；git 侧只能以该用户 commit 的改动行数近似" }],
    );
  }

  // 有本地历史但无主域匹配（新领域）→ 第 1 档（语义：新领域无协作积累）
  return okR(id, ordinal(ctx, "collabLinesTier", 0), "有本地历史但与当前 PR 无主域交集（新领域）→ 最低档");
}
