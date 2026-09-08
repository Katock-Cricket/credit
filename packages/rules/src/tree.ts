/**
 * 指标树（rules v2，P2）。
 *
 * 结构见算法方案 §1「PR_Credit 结构总览」；各指标算法见 §3。
 * 叶子共 38 个：32 个实现 + 6 个外部工具桩（stub）。
 */
import type { RuleNode, RuleSet } from "./types.js";

export const RULESET_VERSION = "2.0";

/**
 * `RuleNode.id` → 计算器文件名（不含扩展名）。
 * 例：`spec.aiDecisionRatio` → `spec-ai-decision-ratio`；`testPlan.tc.l1` → `testplan-tc-l1`。
 */
export function calculatorFile(id: string): string {
  return id
    .split(".")
    .map((seg) => seg.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase())
    .join("-");
}

/** 叶子指标定义（供计算器分发与测试用例遍历） */
const leaf = (
  id: string,
  zh: string,
  en: string,
  level: "L4" | "L5",
  metric: RuleNode["metric"],
): RuleNode => ({ id, name: { "zh-CN": zh, "en-US": en }, level, metric });

const stub = (
  id: string,
  zh: string,
  en: string,
  level: "L4" | "L5",
  provider: string,
  tool: string,
): RuleNode => ({ id, name: { "zh-CN": zh, "en-US": en }, level, stub: { provider, tool } });

// ─────────────── L3 组：SPEC工程 ───────────────
const specGroup: RuleNode = {
  id: "spec",
  name: { "zh-CN": "SPEC工程", "en-US": "SPEC Engineering" },
  level: "L3",
  prerequisite: "specDocs",
  children: [
    leaf("spec.aiDecisionRatio", "AI对SPEC决策影响占比", "AI Decision Influence", "L4", {
      type: "percent",
      higherIsBetter: false,
      requires: ["specDocs", "prompts"],
    }),
    leaf("spec.review", "审阅SPEC", "SPEC Review", "L4", {
      type: "binary",
      requires: ["specDocs", "reading"],
    }),
    leaf("spec.boundary", "SPEC边界把控", "Boundary Control", "L4", {
      type: "ordinal",
      ordinalKey: "threeTier",
      requires: ["prompts"],
    }),
    leaf("spec.constraint", "约束注入", "Constraint Injection", "L4", {
      type: "binary",
      requires: ["prompts"],
    }),
    {
      id: "spec.quality",
      name: { "zh-CN": "SPEC质量", "en-US": "SPEC Quality" },
      level: "L4",
      children: [
        leaf("spec.quality.completeness", "完整性", "Completeness", "L5", {
          type: "number",
          requires: ["specDocs"],
        }),
        leaf("spec.quality.consistency", "一致性", "Consistency", "L5", {
          type: "number",
          requires: ["specDocs"],
        }),
        leaf("spec.quality.unambiguity", "无歧义性", "Unambiguity", "L5", {
          type: "number",
          requires: ["specDocs"],
        }),
        leaf("spec.quality.verifiability", "可验证性", "Verifiability", "L5", {
          type: "number",
          requires: ["specDocs", "rtm"],
        }),
        leaf("spec.quality.traceability", "可追踪性", "Traceability", "L5", {
          type: "number",
          requires: ["rtm", "coreDiff"],
        }),
      ],
    },
  ],
};

// ─────────────── L3 组：测试方案准备 ───────────────
const testPlanGroup: RuleNode = {
  id: "testPlan",
  name: { "zh-CN": "测试方案准备", "en-US": "Test Planning" },
  level: "L3",
  prerequisite: "testArtifacts",
  children: [
    leaf("testPlan.specCoverage", "测试对SPEC覆盖率", "SPEC Coverage by Tests", "L4", {
      type: "percent",
      requires: ["rtm"],
    }),
    leaf("testPlan.review", "审阅测试方案", "Test Plan Review", "L4", {
      type: "binary",
      requires: ["reading"],
    }),
    leaf("testPlan.askImprove", "要求完善测试用例", "Ask to Improve Tests", "L4", {
      type: "binary",
      requires: ["prompts"],
    }),
    {
      id: "testPlan.tc",
      name: { "zh-CN": "测试完备度", "en-US": "Test Completeness" },
      level: "L4",
      children: [
        leaf("testPlan.tc.l1", "TC-L1 需求/规格覆盖", "TC-L1 Requirement Coverage", "L5", {
          type: "percent",
          requires: ["rtm"],
        }),
        stub("testPlan.tc.l2", "TC-L2 结构覆盖", "TC-L2 Structural Coverage", "L5", "coverage-structural", "Istanbul/JaCoCo/Coverage.py"),
        stub("testPlan.tc.l3", "TC-L3 变异杀死率", "TC-L3 Mutation Score", "L5", "mutation", "PIT/Stryker/mutmut"),
        stub("testPlan.tc.l4", "TC-L4 风险/边界覆盖", "TC-L4 Risk/Boundary Coverage", "L5", "risk-boundary", "静态分析 + 复杂度"),
        leaf("testPlan.tc.l5", "TC-L5 过程行为参与", "TC-L5 Process Involvement", "L5", {
          type: "number",
          requires: ["tasks", "coreDiff"],
        }),
      ],
    },
  ],
};

// ─────────────── L3 组：AI代码生成 ───────────────
const genGroup: RuleNode = {
  id: "gen",
  name: { "zh-CN": "AI代码生成", "en-US": "AI Code Generation" },
  level: "L3",
  prerequisite: "codeGen",
  children: [
    leaf("gen.staged", "大型修改分阶段施行", "Staged Implementation", "L4", {
      type: "binary",
      requires: ["coreDiff"],
    }),
    leaf("gen.planFirst", "先审计划再授权生成", "Review Plan Before Authorize", "L4", {
      type: "binary",
      requires: ["prompts"],
    }),
    /**
     * ~~`gen.acceptLines` 单次Accept行数~~ —— **已退出 CREDIT 分数框架（2026-09-08 决策）**。
     *
     * 原因：真实 `userAccept` 事件在桌面端未实测触发（遗留 A-001），`diffStats` 依赖
     * core `GitPort` 事后补齐，指标长期处于 `degraded` 保守分，不具备判别力。
     *
     * **数据层保留**：`userAccept` 的采集、`diffStats` 补齐、以及 `gen-accept-lines.ts`
     * 的计算实现**全部保留**（不删），仅供离线分析/未来复用；此处只是**不注册**，
     * 故不参与分数聚合。恢复只需把 leaf 加回来。
     */
    leaf("gen.alignment", "生成与SPEC对齐度", "Generation–SPEC Alignment", "L4", {
      type: "percent",
      requires: ["tasks", "rtm", "coreDiff"],
    }),
    {
      id: "gen.verify",
      name: { "zh-CN": "核心Diff即时验视", "en-US": "Core Diff Verification" },
      level: "L4",
      prerequisite: "coreDiff",
      children: [
        leaf("gen.verify.readPr", "阅读覆盖 PR", "Read Coverage (PR)", "L5", {
          type: "percent",
          requires: ["coreDiff", "reading"],
        }),
        leaf("gen.verify.editPe", "编辑覆盖 PE", "Edit Coverage (PE)", "L5", {
          type: "percent",
          requires: ["coreDiff"],
        }),
        leaf("gen.verify.cursorNc", "光标游走 NC", "Cursor Walk (NC)", "L5", {
          type: "percent",
          requires: ["coreDiff", "reading"],
        }),
      ],
    },
  ],
};

// ─────────────── L3 组：AI软件测试 ───────────────
const testGroup: RuleNode = {
  id: "test",
  name: { "zh-CN": "AI软件测试", "en-US": "AI Testing" },
  level: "L3",
  prerequisite: "testRuns",
  children: [
    leaf("test.devTrigger", "亲自触发/重跑测试", "Dev-Triggered Test Run", "L4", {
      type: "binary",
      requires: ["testRuns"],
    }),
    leaf("test.passRate", "自动测试最终通过率", "Final Automated Pass Rate", "L4", {
      type: "percent",
      requires: ["testRuns"],
    }),
    leaf("test.reviewFailure", "审阅失败日志/断言细节", "Failure Log Review", "L4", {
      type: "binary",
      requires: ["testRuns", "reading"],
    }),
    stub("test.keypath", "关键路径测试覆盖率", "Critical Path Coverage", "L4", "coverage-keypath", "覆盖率工具 + 圈复杂度"),
  ],
};

// ─────────────── L3 组：AI代码修复 ───────────────
const fixGroup: RuleNode = {
  id: "fix",
  name: { "zh-CN": "AI代码修复", "en-US": "AI Fix" },
  level: "L3",
  prerequisite: "fixPhase",
  children: [
    leaf("fix.issueQuality", "问题描述质量", "Issue Description Quality", "L4", {
      type: "ordinal",
      ordinalKey: "threeTier",
      requires: ["prompts"],
    }),
    leaf("fix.reproCase", "提供失败用例/复现步骤", "Repro Case Provided", "L4", {
      type: "binary",
      requires: ["prompts", "testRuns"],
    }),
    leaf("fix.rootCause", "审阅修复Diff并区分根因", "Root-Cause Aware Fix Review", "L4", {
      type: "ordinal",
      ordinalKey: "threeTier",
      requires: ["reading"],
    }),
  ],
};

// ─────────────── L3 组：人工补测与验证 ───────────────
const manualGroup: RuleNode = {
  id: "manual",
  name: { "zh-CN": "人工补测与验证", "en-US": "Manual Verification" },
  level: "L3",
  children: [
    leaf("manual.passRate", "人工测试最终通过率", "Final Manual Pass Rate", "L4", {
      type: "percent",
      requires: ["prompts"],
    }),
    leaf("manual.boundary", "主动构造边界/异常补测", "Proactive Boundary Testing", "L4", {
      type: "binary",
      requires: ["prompts"],
    }),
  ],
};

// ─────────────── L3 组：AI Review ───────────────
const reviewGroup: RuleNode = {
  id: "review",
  name: { "zh-CN": "AI Review", "en-US": "AI Review" },
  level: "L3",
  children: [
    leaf("review.decision", "修哪些问题的决策方式", "Fix Decision Mode", "L4", {
      type: "ordinal",
      ordinalKey: "threeTier",
      requires: ["prompts"],
    }),
    stub("review.firstViolation", "首轮Review规约违规比例", "First-Round Violations", "L4", "lint", "ESLint/SonarQube/PMD"),
    stub("review.finalViolation", "最终交付规约违规比例", "Final Violations", "L4", "lint", "ESLint/SonarQube/PMD"),
    leaf("review.rounds", "Review所用轮数", "Review Rounds", "L4", {
      type: "ordinal",
      ordinalKey: "reviewRounds",
    }),
    leaf("review.disposition", "Review意见处置", "Finding Disposition", "L4", {
      type: "ordinal",
      ordinalKey: "threeTier",
      requires: ["prompts"],
    }),
  ],
};

// ─────────────── 组装整树 ───────────────
export const PR_CREDIT_TREE: RuleNode = {
  id: "prCredit",
  name: { "zh-CN": "PR_Credit", "en-US": "PR_Credit" },
  level: "L0",
  children: [
    {
      id: "procCredits",
      name: { "zh-CN": "本次 PR 过程可信质量", "en-US": "Process Credits" },
      level: "L1",
      children: [
        {
          id: "prep",
          name: { "zh-CN": "准备阶段", "en-US": "Preparation" },
          level: "L2",
          children: [specGroup, testPlanGroup],
        },
        {
          id: "impl",
          name: { "zh-CN": "实施阶段", "en-US": "Implementation" },
          level: "L2",
          children: [genGroup],
        },
        {
          id: "verify",
          name: { "zh-CN": "验证阶段", "en-US": "Verification" },
          level: "L2",
          children: [testGroup, fixGroup, manualGroup, reviewGroup],
        },
      ],
    },
    {
      id: "devCredit",
      name: { "zh-CN": "程序员历史信用", "en-US": "Dev Credit" },
      level: "L1",
      prerequisite: "devProfile",
      children: [
        {
          id: "devCredit.profile",
          name: { "zh-CN": "个人画像", "en-US": "Profile" },
          level: "L2",
          children: [
            leaf("devCredit.profile.proficiency", "主领域熟练度", "Domain Proficiency", "L4", {
              type: "number",
            }),
            leaf("devCredit.profile.collabLines", "累计AI协作行数档", "Collab Lines Tier", "L4", {
              type: "ordinal",
              ordinalKey: "collabLinesTier",
            }),
          ],
        },
        {
          id: "devCredit.history",
          name: { "zh-CN": "历史PR", "en-US": "History" },
          level: "L2",
          children: [
            leaf("devCredit.history.successRate", "历史PR成功率", "Historical Success Rate", "L4", {
              type: "percent",
            }),
            leaf("devCredit.history.recentAvg", "近N次平均PR_Credit", "Recent Avg PR_Credit", "L4", {
              type: "number",
            }),
          ],
        },
      ],
    },
  ],
};

export const RULESET: RuleSet = { v: RULESET_VERSION, tree: PR_CREDIT_TREE };

// ─────────────── 遍历工具 ───────────────

/** 深度优先列出全部节点 */
export function walk(node: RuleNode, visit: (n: RuleNode, depth: number) => void, depth = 0): void {
  visit(node, depth);
  for (const c of node.children ?? []) walk(c, visit, depth + 1);
}

/** 全部叶子（含 stub） */
export function leaves(node: RuleNode = PR_CREDIT_TREE): RuleNode[] {
  const out: RuleNode[] = [];
  walk(node, (n) => {
    if (!n.children || n.children.length === 0) out.push(n);
  });
  return out;
}

/** 按 id 查节点 */
export function findNode(id: string, node: RuleNode = PR_CREDIT_TREE): RuleNode | null {
  let hit: RuleNode | null = null;
  walk(node, (n) => {
    if (n.id === id) hit = n;
  });
  return hit;
}
