/**
 * 过程建模可调配置（AGENTS §9：阈值/规则不硬编码）。
 */

/** 测试命令识别模式（算法 §2.6 表） */
export const DEFAULT_TEST_CMD_PATTERNS: readonly string[] = [
  "npm test",
  "npx jest",
  "npx vitest",
  "yarn test",
  "pnpm test",
  "pytest",
  "python -m pytest",
  "go test",
  "mvn test",
  "gradle test",
  "cargo test",
  "make test",
  "dotnet test",
  "bun test",
  "deno test",
];

/** Review 子会话 id 特征（L1 强信号） */
export const DEFAULT_REVIEW_SESSION_PATTERN = "review_child_review";
/** Review 提交工具名（L1 强信号） */
export const DEFAULT_REVIEW_TOOL_NAMES: readonly string[] = ["submit_code_review"];
/** Dev Prompt 中的审阅语义词（L2 中信号） */
export const DEFAULT_REVIEW_PROMPT_WORDS: readonly string[] = [
  "review",
  "审查",
  "审阅",
  "评审",
  "代码评审",
  "adversarial",
];
/**
 * AI 消息中的 finding 结构化输出特征（L3 弱信号）。
 *
 * **刻意收紧**：初版含"严重/阻塞/问题 1"等泛词，在 P1 样例中造成 3 处误判
 * （普通技术讨论里"严重"很常见）。此处只保留**结构化**输出才有的特征词。
 * 且 L3 只能补充已有 session，不能单独发起（见 review.ts）。
 */
export const DEFAULT_FINDING_PATTERNS: readonly string[] = [
  "severity",
  "blocking",
  "must fix",
  "## 问题",
  "finding",
  "建议修改",
  "review finding",
];

/**
 * SPEC 工程语义词（需求澄清 / 边界划定 / 方案选择 / 调研）。
 *
 * **为何需要**：P1 样例中用户先让 Agent 调研、再讨论、再定方案、再生成 SPEC ——
 * 这一整段都属 SPEC 工程，但初版规则只认"SPEC 文件的 edit"，而样例里 SPEC 文件
 * **全程只有阅读没有编辑**（用户审阅），导致 T2–T5 全部被误标为代码生成。
 */
export const DEFAULT_SPEC_WORDS: readonly string[] = [
  "SPEC",
  "规格",
  "需求",
  "边界",
  "范围",
  "划定",
  "按方案",
  "方案A",
  "方案B",
  "方案一",
  "方案二",
  "调研",
  "探索现有",
  "可行性",
  "验收标准",
  "scope",
  "requirement",
];

/**
 * 测试**准备**语义词（编写/补充测试用例，区别于"执行测试"）。
 *
 * **为何需要**：初版规则 3 依赖 `role=test`，但 Rust 的测试是源码内的
 * `#[cfg(test)] mod tests`，路径不含 `test` 字样 → 永远识别不到。
 * 从 Prompt 语义判定是更可靠的路径。
 */
export const DEFAULT_TEST_PLAN_WORDS: readonly string[] = [
  "测试用例",
  "测试方案",
  "测试计划",
  "测试验收",
  "验收用例",
  "编写测试",
  "写测试",
  "补充测试",
  "增加.*用例",
  "边界用例",
  "异常用例",
  "测试驱动",
  "测试音频",
  "测试数据",
  "test case",
  "test plan",
];

/** 人工验证语义词（manual-verification，算法 §3.6） */
export const DEFAULT_MANUAL_VERIFY_WORDS: readonly string[] = [
  "人工验证",
  "人工复测",
  "人工测试",
  "手动验证",
  "手动测试",
  "我试了",
  "我测了",
  "实测",
  "实际操作",
  "dev验证",
  "manual test",
  "manually verified",
  "i tested",
  "i tried",
];

/** 修复语义词（ai-fix，算法 §3.5） */
export const DEFAULT_FIX_WORDS: readonly string[] = [
  "修复",
  "修一下",
  "报错",
  "解决这个",
  "失败原因",
  "还是不行",
  "仍然失败",
  "诊断",
  "原因",
  "依然",
  "remediation",
  "fix",
  "error",
  "failed",
  "not working",
  "still broken",
];

export interface TaskConfig {
  /** S2：时间空档阈值（ms），超过即切分 */
  idleGapMs: number;
  /** 噪声抑制：Behavior 数 < 此值的碎片并入相邻簇 */
  minClusterSize: number;
  /** S5：文件聚簇的"久未触及"阈值（ms） */
  fileIdleMs: number;
  /**
   * S5 是否启用。
   *
   * **默认关闭**：P1 样例数据实测，Agent 会在短时间内编辑大量不同文件，
   * 每个新文件都触发切点 → 产生大量 3–5 条行为的碎片 Task（35 个 Task 中
   * 有 8 个是"阅读 N 文件"的碎片）。文件切换在真实操作中的噪声远大于信号，
   * 故默认关闭；实现保留，待有更精确的"注意力转移"判据后再启用。
   */
  enableFileSwitch: boolean;
  /** L3/L4 降级 Desc 的最大字符数 */
  descMaxChars: number;
  /** 喂给 LLM 的 prompt 原文最大字符数 */
  descMaxInputChars: number;
  /** 单次批量 LLM 调用的 Task 数上限 */
  maxTasksPerBatch: number;
  testCmdPatterns: string[];
  reviewSessionPattern: string;
  reviewToolNames: string[];
  reviewPromptWords: string[];
  findingPatterns: string[];
  manualVerifyWords: string[];
  fixWords: string[];
  specWords: string[];
  testPlanWords: string[];
}

export const DEFAULT_TASK_CONFIG: TaskConfig = {
  idleGapMs: 1_800_000, // 30min
  minClusterSize: 3,
  fileIdleMs: 600_000, // 10min
  enableFileSwitch: false,
  descMaxChars: 80,
  descMaxInputChars: 1200,
  maxTasksPerBatch: 30,
  testCmdPatterns: [...DEFAULT_TEST_CMD_PATTERNS],
  reviewSessionPattern: DEFAULT_REVIEW_SESSION_PATTERN,
  reviewToolNames: [...DEFAULT_REVIEW_TOOL_NAMES],
  reviewPromptWords: [...DEFAULT_REVIEW_PROMPT_WORDS],
  findingPatterns: [...DEFAULT_FINDING_PATTERNS],
  manualVerifyWords: [...DEFAULT_MANUAL_VERIFY_WORDS],
  fixWords: [...DEFAULT_FIX_WORDS],
  specWords: [...DEFAULT_SPEC_WORDS],
  testPlanWords: [...DEFAULT_TEST_PLAN_WORDS],
};

export function mergeTaskConfig(override?: Partial<TaskConfig> | null): TaskConfig {
  return override ? { ...DEFAULT_TASK_CONFIG, ...override } : { ...DEFAULT_TASK_CONFIG };
}

/** 命令是否匹配测试模式 */
export function isTestCommand(cmd: string | undefined | null, patterns: string[]): boolean {
  if (!cmd) return false;
  const c = String(cmd).toLowerCase();
  return patterns.some((p) => c.includes(p.toLowerCase()));
}
