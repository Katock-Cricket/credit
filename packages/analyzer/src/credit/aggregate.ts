/**
 * 聚合器（算法 §6.1）。
 *
 * ```
 * groupScore = Σ(w_i × score_i) / Σ(w_i)   over status ∈ {ok, degraded}
 * 非计分子节点（pending / excluded / excluded_no_evidence / error）→ 权重不进分母 = 重分配
 * ```
 *
 * 组内全部非计分 → 组状态向上传递（优先级 pending > error > excluded），同层继续重分配。
 */
import type { MetricStatus, RuleNode } from "@credit/rules";
import type { Evidence, MetricResult, ResultNode } from "./types.js";

/** 会进入加权平均的状态（算法 §6.1） */
const SCORING: ReadonlySet<MetricStatus> = new Set<MetricStatus>(["ok", "degraded"]);

export function aggregateGroup(node: RuleNode, children: ResultNode[]): MetricResult {
  let sumW = 0;
  let sumWS = 0;
  const statuses = new Set<MetricStatus>();
  const evidence: Evidence[] = [];

  for (const c of children) {
    const r = c.result;
    statuses.add(r.status);
    if (SCORING.has(r.status) && r.score != null) {
      const w = r.weight || 1;
      sumW += w;
      sumWS += w * r.score;
    }
  }

  for (const c of children) {
    if (c.result.status === "error") {
      evidence.push({ kind: "note", text: `${c.node.name["zh-CN"]}：计算异常，已排除` });
    }
  }

  if (sumW === 0) {
    // 全组无计分子节点 → 状态向上传递
    const status: MetricStatus = statuses.has("pending")
      ? "pending"
      : statuses.has("error")
        ? "error"
        : statuses.has("excluded_no_evidence")
          ? "excluded_no_evidence"
          : "excluded";
    return {
      id: node.id,
      status,
      score: null,
      weight: node.metric?.weight ?? 1,
      detail: status === "pending" ? "子节点均待外部工具接入" : "子节点均不适用，不计分",
      evidence,
    };
  }

  const excluded = [...statuses].filter((s) => !SCORING.has(s));
  const detail =
    excluded.length > 0
      ? `由 ${children.filter((c) => SCORING.has(c.result.status)).length}/${children.length} 个计分子节点加权平均（其余已重分配）`
      : `由 ${children.length} 个子节点加权平均`;

  return {
    id: node.id,
    status: "ok",
    score: Number((sumWS / sumW).toFixed(2)),
    weight: node.metric?.weight ?? 1,
    detail,
    evidence,
  };
}

/**
 * 顶层：PR_Credit = procWeight × Proc + devWeight × Dev；Dev 缺失 → PR = Proc（决策 D-028）。
 */
export function aggregateRoot(
  root: RuleNode,
  children: ResultNode[],
  cfg: { procWeight: number; devWeight: number },
): MetricResult {
  const proc = children.find((c) => c.node.id === "procCredits");
  const dev = children.find((c) => c.node.id === "devCredit");

  const procScore = proc?.result.score ?? null;
  const devScore = dev?.result.status === "ok" ? dev.result.score : null;

  let score: number;
  let detail: string;
  if (procScore == null) {
    return {
      id: root.id,
      status: "excluded",
      score: null,
      weight: 1,
      detail: "过程分不可用",
      evidence: [],
    };
  }
  if (devScore == null) {
    score = procScore;
    detail = "Dev_Credit 缺失（P3 接入），PR_Credit = Proc_Credits";
  } else {
    score = cfg.procWeight * procScore + cfg.devWeight * devScore;
    detail = `PR_Credit = ${cfg.procWeight} × ${procScore} + ${cfg.devWeight} × ${devScore}`;
  }

  return {
    id: root.id,
    status: "ok",
    score: Number(score.toFixed(2)),
    weight: 1,
    detail,
    evidence: [],
  };
}

/** 四档映射（算法 §6.2） */
export function bandOf(score: number): {
  band: "blind" | "selective" | "verified" | "mastered";
  label: { "zh-CN": string; "en-US": string };
} {
  if (score < 40)
    return { band: "blind", label: { "zh-CN": "盲目放行", "en-US": "Blind Trust" } };
  if (score < 60)
    return { band: "selective", label: { "zh-CN": "选择性关注", "en-US": "Selective Attention" } };
  if (score < 80)
    return { band: "verified", label: { "zh-CN": "主动验证", "en-US": "Active Verification" } };
  return { band: "mastered", label: { "zh-CN": "完全掌控", "en-US": "Full Control" } };
}
