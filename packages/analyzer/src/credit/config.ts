/**
 * 计算侧参数（P2，算法 §7 参数汇总表）。
 * 一律可调，**禁止在计算器里硬编码阈值**（AGENTS §9）。
 */
export interface CreditConfig {
  aggregation: { procWeight: number; devWeight: number; defaultStrategy: string };
  reading: { readDwellMs: number; scrollSampleMs: number };
  review: {
    coverageRatio: number;
    dwellMs: number;
    testCoverageRatio: number;
    testDwellMs: number;
  };
  spec: { filePatterns: string[]; excludePatterns: string[]; minContentChars: number };
  diff: { largeChangeThreshold: number; acceptMaxLines: number; coreFileExcludePatterns: string[] };
  test: { cmdPatterns: string[]; failureReviewWindowMs: number; fixPhaseWindowMs: number };
  planReview: { dwellMs: number };
  /**
   * 「大型修改分阶段施行」的判据参数（2026-09-08 改版：不再看 commit 数）。
   * `todoTools` 做成表是为了兼容不同 Agent 平台的 TODO/计划工具命名。
   */
  stagedPlan: {
    /** 视为"TODO/计划类"工具的 toolName（大小写不敏感、前缀匹配） */
    todoTools: string[];
    /** 至少拆成几步才算"拆解" */
    minSteps: number;
    /** 至少要有几个不同的 TODO 快照，才算"分批推进"（而非一次性全勾） */
    minSnapshots: number;
    /** 最终至少完成几步，才算真的按步骤走完 */
    minCompleted: number;
  };
  manualTest: { tailWindowRatio: number; minPrompts: number };
  decisionAttribution: { minDecisions: number };
  /**
   * Dev_Credit 计分参数（P3，SPEC P3 §8）。
   * **单轨口径（D-043）**：熟练度只看**行数** —— git 来源为该用户 commit 的 diff 增量行数
   * （自有/组织/他人仓），未同步 git 时退到本地 PR 的 AI 协作行数。
   * `scale: "log"` 为默认：git 行数量级可达数十万（实测单账号 ~73 万行），
   * 线性归一几乎人人满分、丧失判别力，故取对数标定。
   */
  profile: {
    proficiency: { scale: "log" | "linear"; fullMarkLines: number };
    collabTiers: [number, number, number];
    recentN: number;
  };
  ordinal: { threeTier: number[]; reviewRounds: number[]; collabLinesTier: number[] };
  degraded: { conservativeScore: number };
}

export const DEFAULT_CREDIT_CONFIG: CreditConfig = {
  aggregation: { procWeight: 0.8, devWeight: 0.2, defaultStrategy: "equal" },
  reading: { readDwellMs: 500, scrollSampleMs: 200 },
  review: { coverageRatio: 0.3, dwellMs: 10_000, testCoverageRatio: 0.1, testDwellMs: 5_000 },
  spec: {
    filePatterns: ["**/SPEC*.md", "**/*spec*.md", "**/*需求*.md", "**/*规格*.md", "**/spec/**"],
    excludePatterns: ["node_modules/**", "dist/**"],
    minContentChars: 200,
  },
  diff: {
    largeChangeThreshold: 100,
    acceptMaxLines: 800,
    coreFileExcludePatterns: [
      "**/*.lock",
      "**/*.min.*",
      "**/dist/**",
      "**/build/**",
      "**/*.generated.*",
      "**/*.snap",
      "**/assets/**",
    ],
  },
  test: { cmdPatterns: [], failureReviewWindowMs: 900_000, fixPhaseWindowMs: 1_800_000 },
  planReview: { dwellMs: 10_000 },
  stagedPlan: {
    todoTools: [
      "TodoWrite",
      "todo_write",
      "todo_update",
      "update_todo",
      "write_todos",
      "create_todo",
      "todo",
      "plan",
    ],
    minSteps: 2,
    minSnapshots: 2,
    minCompleted: 2,
  },
  manualTest: { tailWindowRatio: 0.25, minPrompts: 10 },
  decisionAttribution: { minDecisions: 3 },
  profile: {
    // log：score = 100 × log10(1+L) / log10(1+500000) —— 1k≈53、10k≈70、10万≈88、50万=100
    proficiency: { scale: "log", fullMarkLines: 500_000 },
    collabTiers: [1_000, 10_000, 50_000],
    recentN: 10,
  },
  ordinal: { threeTier: [0, 50, 100], reviewRounds: [0, 60, 80, 100], collabLinesTier: [10, 40, 70, 100] },
  degraded: { conservativeScore: 50 },
};

export function mergeCreditConfig(over?: Partial<CreditConfig>): CreditConfig {
  if (!over) return { ...DEFAULT_CREDIT_CONFIG };
  return {
    ...DEFAULT_CREDIT_CONFIG,
    ...over,
    aggregation: { ...DEFAULT_CREDIT_CONFIG.aggregation, ...over.aggregation },
    reading: { ...DEFAULT_CREDIT_CONFIG.reading, ...over.reading },
    review: { ...DEFAULT_CREDIT_CONFIG.review, ...over.review },
    spec: { ...DEFAULT_CREDIT_CONFIG.spec, ...over.spec },
    diff: { ...DEFAULT_CREDIT_CONFIG.diff, ...over.diff },
    test: { ...DEFAULT_CREDIT_CONFIG.test, ...over.test },
    manualTest: { ...DEFAULT_CREDIT_CONFIG.manualTest, ...over.manualTest },
    ordinal: { ...DEFAULT_CREDIT_CONFIG.ordinal, ...over.ordinal },
    planReview: { ...DEFAULT_CREDIT_CONFIG.planReview, ...over.planReview },
    stagedPlan: { ...DEFAULT_CREDIT_CONFIG.stagedPlan, ...over.stagedPlan },
    decisionAttribution: {
      ...DEFAULT_CREDIT_CONFIG.decisionAttribution,
      ...over.decisionAttribution,
    },
    profile: { ...DEFAULT_CREDIT_CONFIG.profile, ...over.profile },
    degraded: { ...DEFAULT_CREDIT_CONFIG.degraded, ...over.degraded },
  };
}
