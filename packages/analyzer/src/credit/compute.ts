/**
 * P2 计算主入口。
 *
 * **调用链（需求 2：计算时机在 Task 之后）**：
 * ```
 * behaviors → [P2-pre] buildTaskGraph → TaskGraph → [P2] computeCredit → CreditResult
 * ```
 * `TaskGraph` 是**必填输入**，不得绕过 Task 直接读 behaviors 计算指标。
 */
import { RULESET } from "@credit/rules";
import type { TaskGraph } from "../task/types.js";
import type { TestRun } from "../task/testrun.js";
import { detectTestRuns } from "../task/testrun.js";
import type { LlmPort } from "../llm/port.js";
import type { Behavior } from "@credit/protocol";
import { createContext, type CreateContextOptions } from "./context.js";
import { runEngine, collectDiagnostics } from "./engine.js";
import { bandOf } from "./aggregate.js";
import { profileStamp } from "../profile/types.js";
import type { CreditResult, GitDiffSnapshot, FsPort, GitPort } from "./types.js";
import type { CreditConfig } from "./config.js";

export interface ComputeCreditOptions {
  prId: string;
  behaviors: Behavior[];
  taskGraph: TaskGraph;
  llm: LlmPort;
  gitDiff?: GitDiffSnapshot;
  testRuns?: TestRun[];
  git?: GitPort | null;
  fs?: FsPort | null;
  config?: Partial<CreditConfig>;
  /** P3：Dev_Profile（null = Dev_Credit 不适用，行为与 P2 一致） */
  profile?: import("../profile/types.js").DevProfile | null;
  /** 覆盖 llmModel（用于 generator 记录） */
  llmModel?: string | null;
}

/**
 * **计算逻辑版本** —— 改动任何计算器 / 共享产物的判定逻辑后**必须 bump**。
 *
 * 它被纳入 `inputFingerprint`：否则"改了算法但输入数据没变"时缓存照样命中，
 * 用户看到的是**旧结果**。2026-09-08 实际踩到 —— 「大型修改分阶段施行」改版后，
 * 原型仍显示旧文案"仅 1 次提交，未分阶段"，因为行为数 / Task 数 / git 摘要都没变。
 */
// 2026-09-09.3：指纹的画像戳由 profile.updatedAt 改为 profileStamp（排除当前 PR）
export const CALC_VERSION = "2026-09-09.3";

/** 输入指纹：决定"是否需要重算" */
export function inputFingerprint(opts: {
  behaviors: Behavior[];
  taskGraph: TaskGraph;
  gitDiff?: GitDiffSnapshot;
  /**
   * P3：画像状态参与指纹 —— 否则初始化/同步后旧缓存仍显示无 Dev_Credit。
   * 取 `profileStamp(profile, prId)`：**排除当前 PR**（它不参与自己的评分），
   * 且用内容摘要而非 `updatedAt`（后者会被结算后的写回戳掉，导致每次重算）。
   */
  profile?: import("../profile/types.js").DevProfile | null;
  prId?: string;
}): string {
  const parts = [
    CALC_VERSION,
    String(opts.behaviors.length),
    opts.taskGraph.v ?? "0",
    String(opts.taskGraph.tasks.length),
    String(opts.taskGraph.generatedAt ?? 0),
    opts.gitDiff?.available ? `${opts.gitDiff.head ?? ""}..${opts.gitDiff.base ?? ""}` : "nogit",
    String(opts.gitDiff?.files?.length ?? 0),
    profileStamp(opts.profile ?? null, opts.prId),
  ];
  return parts.join("|");
}

export async function computeCredit(opts: ComputeCreditOptions): Promise<CreditResult> {
  const testRuns = opts.testRuns ?? detectTestRuns(opts.behaviors);

  const ctx: ReturnType<typeof createContext> = createContext({
    prId: opts.prId,
    behaviors: opts.behaviors,
    taskGraph: opts.taskGraph,
    gitDiff: opts.gitDiff,
    testRuns,
    llm: opts.llm,
    git: opts.git ?? null,
    fs: opts.fs ?? null,
    config: opts.config,
    profile: opts.profile ?? null,
  } satisfies CreateContextOptions);

  const tree = await runEngine(ctx, RULESET.tree);
  const diag = collectDiagnostics(tree);

  // P3 增量更新数据源（D-041/D-042）：关键词只在 profile 存在时才可能被提取过
  let profileKeywords: string[] | null = null;
  if (opts.profile) {
    try {
      profileKeywords = await ctx.profileKeywords();
    } catch {
      profileKeywords = null;
    }
  }
  const cd = ctx.coreDiff();
  const aiCollabLines = Object.values(cd.aiLines).reduce((a, lines) => a + lines.length, 0);

  const procNode = tree.children?.find((c) => c.node.id === "procCredits");
  const devNode = tree.children?.find((c) => c.node.id === "devCredit");
  const band = bandOf(tree.result.score ?? 0);

  return {
    v: "1.0",
    prId: opts.prId,
    generatedAt: Date.now(),
    generator: {
      rulesetVersion: RULESET.v,
      llmModel: opts.llmModel ?? null,
      llmCalls: ctx.stats.llmCalls,
      inputFingerprint: inputFingerprint({
        behaviors: opts.behaviors,
        taskGraph: opts.taskGraph,
        gitDiff: opts.gitDiff,
        profile: opts.profile,
        prId: opts.prId,
      }),
    },
    tree,
    profileFeed: { profileKeywords, aiCollabLines },
    summary: {
      prCredit: tree.result.score ?? 0,
      procCredits: procNode?.result.score ?? 0,
      devCredit: devNode?.result.status === "ok" ? devNode.result.score : null,
      band: band.band,
      bandLabel: band.label,
      overallComment: tree.result.detail,
    },
    diagnostics: {
      statusDist: diag.statusDist,
      llmFallbackCount: ctx.stats.llmFallback,
      errorIds: diag.errorIds,
      pendingIds: diag.pendingIds,
      degradedIds: diag.degradedIds,
      gitDiffAvailable: opts.gitDiff?.available ?? false,
    },
  };
}
