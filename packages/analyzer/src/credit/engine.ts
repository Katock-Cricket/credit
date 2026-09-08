/**
 * 指标引擎（P2）。
 *
 * **后序遍历**：先算叶子，再由聚合器自底向上算 group。
 *
 * 三条纪律：
 * 1. **错误隔离** —— 单个计算器抛异常只让该指标 `error`，不影响兄弟节点与整树
 *    （架构 §3.3 单指标错误隔离）；
 * 2. **组级前置先行** —— 前置不满足则整组 excluded，子节点**不再计算**
 *    （避免"无 SPEC 却去调 LLM 评估 SPEC 质量"这种浪费与误导）；
 * 3. **桩不伪造** —— stub 节点走 toolProxy，恒返回 pending（D-029）。
 */
import type { RuleNode } from "@credit/rules";
import { calculatorFile } from "@credit/rules";
import type { MetricContext } from "./context.js";
import type { Evidence, MetricResult, ResultNode } from "./types.js";
import { aggregateGroup, aggregateRoot } from "./aggregate.js";
import { CALCULATORS } from "../metrics/index.js";

export type Calculator = (ctx: MetricContext, node: RuleNode) => Promise<MetricResult>;

/** 组级前置判定（算法 §3 各组） */
async function prerequisiteMet(
  ctx: MetricContext,
  p: NonNullable<RuleNode["prerequisite"]>,
): Promise<{ met: boolean; detail: string }> {
  switch (p) {
    case "specDocs": {
      const docs = await ctx.specDocs();
      return docs.length > 0
        ? { met: true, detail: `${docs.length} 份 SPEC 文档` }
        : { met: false, detail: "本次 PR 无 SPEC 文档，整组不适用" };
    }
    case "testArtifacts": {
      const uris = ctx.testUris();
      return uris.length > 0
        ? { met: true, detail: `${uris.length} 个测试相关文件` }
        : { met: false, detail: "无测试文件且无测试方案文档，整组不适用" };
    }
    case "codeGen": {
      const hasAccept = ctx.behaviors.some((b) => b.action === "accept");
      const hasGenTool = ctx.behaviors.some(
        (b) =>
          b.action === "agent.tool" &&
          /^(write|edit|multiedit|create_file|apply_patch)$/i.test(String(b.context?.toolName ?? "")),
      );
      return hasAccept || hasGenTool
        ? { met: true, detail: hasAccept ? "存在 userAccept" : "存在代码生成类工具调用" }
        : { met: false, detail: "无 userAccept 且无代码生成类工具调用，整组不适用" };
    }
    case "testRuns": {
      const runs = ctx.testRuns();
      return runs.length > 0
        ? { met: true, detail: `${runs.length} 次测试运行` }
        : { met: false, detail: "Dev 与 AI 均未运行测试，整组不适用" };
    }
    case "fixPhase": {
      const runs = ctx.testRuns().filter((r) => (r.failed ?? 0) > 0);
      const hasFix = ctx.tasks().some((t) => t.stage === "ai-fix" || t.spans.some((s) => s.stage === "ai-fix"));
      return runs.length > 0 && hasFix
        ? { met: true, detail: `${runs.length} 次失败运行 + 修复环节` }
        : { met: false, detail: "无失败测试后的修复环节，整组不适用" };
    }
    case "coreDiff": {
      const cd = ctx.coreDiff();
      return cd.totalCoreNew > 0
        ? { met: true, detail: `${cd.totalCoreNew} 行核心新增` }
        : { met: false, detail: "无核心新增行，整组不适用" };
    }
    case "devProfile":
      // P2：profile 恒 null（决策 D-028/D-032），本组恒不适用
      return { met: false, detail: "Dev_Profile 未接入（P3），整组不适用" };
    default:
      return { met: true, detail: "" };
  }
}

/** 整组标记 excluded（子节点不计算） */
function markExcluded(node: RuleNode, detail: string): ResultNode {
  const children = (node.children ?? []).map((c: RuleNode) => markExcluded(c, detail));
  return {
    node,
    result: {
      id: node.id,
      status: "excluded",
      score: null,
      weight: node.metric?.weight ?? 1,
      detail,
      evidence: [],
    },
    children: children.length > 0 ? children : undefined,
  };
}

async function runLeaf(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const file = node.stub ? "tool-proxy" : calculatorFile(node.id);
  const calc = CALCULATORS[file];
  if (!calc) {
    return {
      id: node.id,
      status: "error",
      score: 0,
      weight: node.metric?.weight ?? 1,
      detail: `未找到计算器：${file}`,
      evidence: [],
    };
  }
  try {
    const r = await calc(ctx, node);
    // 兜底：计算器返回值的 score 必须在 0–100 或 null
    if (r.score != null && (r.score < 0 || r.score > 100)) {
      return { ...r, score: Math.max(0, Math.min(100, r.score)) };
    }
    return r;
  } catch (e) {
    return {
      id: node.id,
      status: "error",
      score: 0,
      weight: node.metric?.weight ?? 1,
      detail: `计算异常：${String((e as Error)?.message ?? e)}`,
      evidence: [],
    };
  }
}

export async function runEngine(ctx: MetricContext, node: RuleNode): Promise<ResultNode> {
  // 根节点特殊处理（PR_Credit = proc/dev 加权）
  if (node.level === "L0") {
    const children: ResultNode[] = [];
    for (const c of node.children ?? []) children.push(await runEngine(ctx, c));
    return { node, result: aggregateRoot(node, children, ctx.config.aggregation), children };
  }

  // group
  if (node.children && node.children.length > 0) {
    if (node.prerequisite) {
      const p = await prerequisiteMet(ctx, node.prerequisite);
      if (!p.met) return markExcluded(node, p.detail);
    }
    const children: ResultNode[] = [];
    for (const c of node.children) children.push(await runEngine(ctx, c));
    return { node, result: aggregateGroup(node, children), children };
  }

  // leaf
  return { node, result: await runLeaf(ctx, node) };
}

// ─────────────── 诊断 ───────────────

export function collectDiagnostics(root: ResultNode): {
  statusDist: Record<string, number>;
  errorIds: string[];
  pendingIds: string[];
  degradedIds: string[];
} {
  const statusDist: Record<string, number> = {};
  const errorIds: string[] = [];
  const pendingIds: string[] = [];
  const degradedIds: string[] = [];

  const walk = (n: ResultNode) => {
    const s = n.result.status;
    statusDist[s] = (statusDist[s] ?? 0) + 1;
    if (s === "error") errorIds.push(n.node.id);
    if (s === "pending") pendingIds.push(n.node.id);
    if (s === "degraded") degradedIds.push(n.node.id);
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  return { statusDist, errorIds, pendingIds, degradedIds };
}

/** 收集全部证据（UI 按 id 索引） */
export function collectEvidence(n: ResultNode): Evidence[] {
  return [...(n.result.evidence ?? []), ...(n.children ?? []).flatMap(collectEvidence)];
}
