/**
 * Dev_Credit·主领域熟练度（P3，算法 §5.1 + 决策 D-043 单轨行数口径）。
 *
 * **单轨**：熟练度只看**行数**。
 * - 同步过 git → 用 `gitLines`（该用户 commit 的 diff 增量行数，含自有/组织/他人仓）；
 * - 从未同步 git → 退到本地 PR 的 AI 协作行数（`localLinesOf` 派生）。
 * 二者**不相加**：本地 PR 的行数 commit 后本就进入 git 历史，相加即重复计数。
 *
 * **对数标定**：git 行数量级可达数十万（实测单账号 ~73 万行），线性归一会
 * 人人满分、丧失判别力，故 `score = 100 × log10(1+L) / log10(1+fullMarkLines)`；
 * scale 可切 `linear`（有意为之的直观看法，参数可调 —— 不硬编码阈值）。
 *
 * 消费共享关键词槽 `ctx.profileKeywords()`（D-042，每 PR 只提取一次）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult } from "../credit/types.js";
import { hasGitLines, localLinesOf, matchedKeywords } from "../profile/types.js";
import { okR, degradedR, excludedR } from "./helpers.js";

/** 单轨归一分：log 或 linear（config.profile.proficiency.scale） */
export function scoreOfLines(lines: number, scale: "log" | "linear", fullMark: number): number {
  const L = Math.max(0, lines);
  if (scale === "linear") return Math.min(100, (L / Math.max(1, fullMark)) * 100);
  // log10(1+L)/log10(1+fullMark)，L=0 → 0，L=fullMark → 100
  return Math.min(100, (Math.log10(1 + L) / Math.log10(1 + Math.max(1, fullMark))) * 100);
}

export async function devCreditProfileProficiency(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const profile = ctx.profile;
  if (!profile) return excludedR(id, "无 Dev_Profile"); // 前置已保证，防御

  const currentKeywords = await ctx.profileKeywords();
  if (currentKeywords.length === 0) {
    return degradedR(ctx, id, "当前 PR 关键词提取失败（无 Task 描述且无 git diff）");
  }

  const matched = matchedKeywords(profile, currentKeywords);
  if (matched.length === 0) {
    return okR(id, 0, `当前 PR 关键词（${currentKeywords.slice(0, 3).join("、")}…）在画像中无历史记录（新领域）`, [
      { kind: "note", text: `画像关键词 ${profile.techDomain.keywords.length} 个，匹配 0 个` },
    ]);
  }

  const cfg = ctx.config.profile.proficiency;
  const useGit = hasGitLines(profile);
  const names = matched.map((k) => k.name);
  const lines = useGit
    ? matched.reduce((a, k) => a + k.gitLines, 0)
    : names.reduce((a, n) => a + localLinesOf(profile, n, ctx.prId), 0);

  const score = scoreOfLines(lines, cfg.scale, cfg.fullMarkLines);
  const source = useGit ? "git commit diff 行数" : "本地 PR 的 AI 协作行数（未同步 git）";

  return okR(
    id,
    score,
    `匹配 ${names.length} 个画像关键词；累计 ${lines} 行（来源：${source}；` +
      `${cfg.scale === "log" ? "对数" : "线性"}标定，满 Mark ${cfg.fullMarkLines} 行）`,
    [
      {
        kind: "note",
        text: `匹配词：${names.slice(0, 6).join("、")}${names.length > 6 ? "…" : ""}` +
          `；当前 PR 关键词：${currentKeywords.slice(0, 6).join("、")}`,
      },
    ],
  );
}
