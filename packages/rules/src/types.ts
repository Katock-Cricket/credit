/**
 * 指标树契约（rules v2，P2）。
 *
 * **设计原则：数据不是代码** —— 指标树（层级、名称、类型、权重、档位引用、
 * 前置条件）全部以数据形式定义于此包，`@credit/analyzer` 只承载引擎与计算器。
 * 新增/调权/改档位 = 改数据，不改引擎。
 *
 * **命名纪律**（AGENTS §9）：`RuleNode.id` 与 `analyzer/src/metrics/<kebab-case>.ts`
 * 一一对应（如 `spec.aiDecisionRatio` ↔ `metrics/spec-ai-decision-ratio.ts`），
 * 由 `rules.test.ts` 的"遍历叶子断言计算器存在"用例强制。
 */

export type MetricType = "binary" | "ordinal" | "percent" | "number";

export type MetricStatus =
  | "ok"
  | "pending"
  | "excluded"
  | "excluded_no_evidence"
  | "degraded"
  | "error";

/** ordinal 档位表的键（引用 config.ordinal，避免树里硬编码分值） */
export type OrdinalKey = "threeTier" | "reviewRounds" | "collabLinesTier";

/** 组级前置：不满足则整组 excluded（算法 §3 各组的"组级前置"） */
export type Prerequisite =
  | "specDocs"
  | "testArtifacts"
  | "codeGen"
  | "testRuns"
  | "fixPhase"
  | "coreDiff"
  | "devProfile";

/** 共享组件懒加载键（C1/C2/C6 来自 P2-pre，C3/C4/C5/C7 为本阶段新建） */
export type SharedKey =
  | "stages"
  | "tasks"
  | "testRuns"
  | "specDocs"
  | "testPlanDocs"
  | "reading"
  | "coreDiff"
  | "rtm"
  | "prompts";

export interface MetricDef {
  type: MetricType;
  /** percent/number 的归一化方向：true = 越高越好 */
  higherIsBetter?: boolean;
  /** number 型归一化区间 */
  min?: number;
  max?: number;
  /** ordinal 型引用的档位表 */
  ordinalKey?: OrdinalKey;
  /** 权重（默认 1） */
  weight?: number;
  /** 依赖的共享组件（用于诊断与 skip 优化） */
  requires?: SharedKey[];
}

export interface RuleNode {
  id: string;
  name: { "zh-CN": string; "en-US": string };
  /** L0 = PR_Credit 根；L4/L5 为叶子为主 */
  level: "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
  children?: RuleNode[];
  /** 叶子节点：有 metric 或 stub */
  metric?: MetricDef;
  /**
   * 外部工具桩（算法 §4，决策 D-029）。
   * **计算器仍必须存在**，只是恒返回 pending —— 使未来接入工具 = 替换一个函数返回值。
   */
  stub?: { provider: string; tool: string };
  /** 组级前置（仅 group 节点） */
  prerequisite?: Prerequisite;
}

export interface RuleSet {
  v: string;
  tree: RuleNode;
}
