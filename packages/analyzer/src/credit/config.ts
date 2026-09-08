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
    degraded: { ...DEFAULT_CREDIT_CONFIG.degraded, ...over.degraded },
  };
}
