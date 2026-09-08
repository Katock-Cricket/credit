/**
 * 指标树测试（P2 T1）。
 *
 * 最关键的一条是**计算器映射**：遍历每个待实现叶子，断言
 * `analyzer/src/metrics/<calculatorFile(id)>.ts` 存在 —— 防止漏实现
 * （指标树加了节点但计算器没写，聚合时会静默少算一路）。
 */
import { describe, it, expect } from "vitest";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET,
  PR_CREDIT_TREE,
  leaves,
  walk,
  findNode,
  calculatorFile,
  type RuleNode,
} from "./index.js";

const METRICS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "analyzer",
  "src",
  "metrics",
);

const procTree = PR_CREDIT_TREE.children!.find((c) => c.id === "procCredits")!;
const devTree = PR_CREDIT_TREE.children!.find((c) => c.id === "devCredit")!;

describe("指标树结构", () => {
  // 37 = 38 − 1：`gen.acceptLines` 于 2026-09-08 退出分数框架（D-030）
  it("Proc_Credits 含 37 个叶子；全树 41（另含 Dev 4 项，留 P3）", () => {
    expect(leaves(procTree)).toHaveLength(37);
    expect(leaves()).toHaveLength(41);
  });

  it("六个外部工具桩标记正确（D-029）", () => {
    const stubs = leaves(procTree).filter((n) => n.stub);
    expect(stubs.map((s) => s.id).sort()).toEqual([
      "review.finalViolation",
      "review.firstViolation",
      "test.keypath",
      "testPlan.tc.l2",
      "testPlan.tc.l3",
      "testPlan.tc.l4",
    ]);
    // 桩必须声明 provider（用于未来注册表查找），且不能有 metric 定义
    for (const s of stubs) {
      expect(s.stub!.provider).toBeTruthy();
      expect(s.metric).toBeUndefined();
    }
    // 实现 = 37 - 6 = 31
    expect(leaves(procTree).filter((n) => !n.stub)).toHaveLength(31);
  });

  it("id 全树唯一", () => {
    const ids: string[] = [];
    walk(PR_CREDIT_TREE, (n) => ids.push(n.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每个非 stub 叶子都有合法 metric 定义", () => {
    for (const n of leaves()) {
      if (n.stub) continue;
      expect(n.metric, `${n.id} 缺 metric`).toBeDefined();
      expect(
        ["binary", "ordinal", "percent", "number"],
        `${n.id} 类型非法`,
      ).toContain(n.metric!.type);
      if (n.metric!.type === "ordinal") {
        expect(["threeTier", "reviewRounds", "collabLinesTier"]).toContain(n.metric!.ordinalKey);
      }
    }
  });

  it("组级前置只挂在 group 节点上", () => {
    walk(PR_CREDIT_TREE, (n) => {
      if (n.prerequisite) expect(n.children?.length ?? 0).toBeGreaterThan(0);
    });
  });

  it("Dev_Credit 子树存在且整体 prerequisite=devProfile（P3 接入点）", () => {
    expect(devTree.prerequisite).toBe("devProfile");
    expect(leaves(devTree)).toHaveLength(4);
  });

  it("findNode 可定位", () => {
    expect(findNode("spec.quality.completeness")?.name["zh-CN"]).toBe("完整性");
    expect(findNode("not-exist")).toBeNull();
  });

  it("版本号存在（变更即缓存失效）", () => {
    expect(RULESET.v).toBe("2.0");
  });
});

describe("calculatorFile 映射", () => {
  it("id → 文件名的转换规则", () => {
    expect(calculatorFile("spec.aiDecisionRatio")).toBe("spec-ai-decision-ratio");
    expect(calculatorFile("testPlan.tc.l1")).toBe("test-plan-tc-l1");
    expect(calculatorFile("gen.verify.readPr")).toBe("gen-verify-read-pr");
    expect(calculatorFile("review.rounds")).toBe("review-rounds");
  });

  it("**每个待实现叶子都有对应计算器文件**（防漏实现）", () => {
    const targets = leaves(procTree).filter((n) => !n.stub);
    const missing = targets.filter(
      (n) => !fsSync.existsSync(path.join(METRICS_DIR, `${calculatorFile(n.id)}.ts`)),
    );
    expect(
      missing.map((n: RuleNode) => `${n.id} → ${calculatorFile(n.id)}.ts`),
    ).toEqual([]);
  });

  it("六个桩共用一个 toolProxy 计算器文件", () => {
    expect(fsSync.existsSync(path.join(METRICS_DIR, "tool-proxy.ts"))).toBe(true);
  });
});
