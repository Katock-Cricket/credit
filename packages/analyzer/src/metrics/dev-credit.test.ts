/**
 * F4 单测：Dev_Credit 四计算器 + 引擎前置激活 + 组聚合（SPEC P3 §3 / §8，决策 D-043）。
 *
 * 全离线：LLM 用可编程 stub，profile 直接构造 —— 按功能点独立验证，
 * 不依赖 pr_credit 重算也不依赖 git 拉取（用户调试粒度要求）。
 */
import { describe, expect, it } from "vitest";
import { findNode } from "@credit/rules";
import { createContext, type MetricContext } from "../credit/context.js";
import { runEngine } from "../credit/engine.js";
import type { DevProfile } from "../profile/types.js";
import type { LlmPort, LlmResult } from "../llm/port.js";
import type { TaskGraph } from "../task/types.js";
import { scoreOfLines } from "./dev-credit-profile-proficiency.js";

const TASK_GRAPH = { v: "0", generatedAt: 0, stages: [], tasks: [] } as unknown as TaskGraph;

/** 恒返回固定关键词的 LLM stub */
function mkLlm(keywords: string[]): LlmPort {
  return {
    id: "null",
    isAvailable: async () => true,
    complete: async (): Promise<LlmResult> => ({ ok: true, json: { keywords }, model: "mock", cached: false }),
  };
}

/** git 侧已同步行数的画像（D-043 单轨：熟练度走 gitLines） */
function mkProfile(over: Partial<DevProfile> = {}): DevProfile {
  return {
    version: 1,
    updatedAt: "2026-09-09T00:00:00.000Z",
    gitUser: "katock",
    techDomain: {
      keywords: [
        { name: "TypeScript", gitLines: 30_000, lastSeen: "2026-09-01", source: "merged" },
        { name: "React", gitLines: 0, lastSeen: "2026-09-01", source: "local" },
      ],
    },
    historyTasks: [
      { prId: "pr-1", ts: 1000, keywords: ["TypeScript"], aiCollabLines: 25_000, prCredit: 80, status: "committed", source: "local" },
      { prId: "pr-2", ts: 2000, keywords: ["React"], aiCollabLines: 25_000, prCredit: 60, status: "committed", source: "local" },
    ],
    gitStats: { totalPrCount: 20, mergedPrCount: 15, reposContributed: [], lastSyncAt: "2026-09-01" },
    syncState: { user: "katock", repos: {} },
    ...over,
  };
}

function mkCtx(profile: DevProfile | null, llm = mkLlm(["TypeScript", "React"])): MetricContext {
  return createContext({ prId: "pr-p3", behaviors: [], taskGraph: TASK_GRAPH, llm, profile });
}

const ID = {
  proficiency: "devCredit.profile.proficiency",
  collabLines: "devCredit.profile.collabLines",
  successRate: "devCredit.history.successRate",
  recentAvg: "devCredit.history.recentAvg",
};

describe("F4 · 主领域熟练度（D-043 单轨行数）", () => {
  it("已同步 git → 用 gitLines，不叠加本地行数（避免重复计数）", async () => {
    const ctx = mkCtx(mkProfile(), mkLlm(["TypeScript"]));
    const { devCreditProfileProficiency } = await import("./dev-credit-profile-proficiency.js");
    const r = await devCreditProfileProficiency(ctx, findNode(ID.proficiency)!);
    // 30,000 行 → log10(30001)/log10(500001) ≈ 82.6（本地 25,000 行不叠加）
    expect(r.score).toBeCloseTo(scoreOfLines(30_000, "log", 500_000), 2);
    expect(r.detail).toContain("git commit diff 行数");
  });

  it("从未同步 git（gitLines 全 0）→ 退到本地 PR 行数", async () => {
    const ctx = mkCtx(mkProfile({
      techDomain: { keywords: [{ name: "TypeScript", gitLines: 0, lastSeen: "", source: "local" }] },
    }), mkLlm(["TypeScript"]));
    const { devCreditProfileProficiency } = await import("./dev-credit-profile-proficiency.js");
    const r = await devCreditProfileProficiency(ctx, findNode(ID.proficiency)!);
    expect(r.score).toBeCloseTo(scoreOfLines(25_000, "log", 500_000), 2);
    expect(r.detail).toContain("未同步 git");
  });

  it("对数标定：1k≈53 / 10k≈70 / 10万≈88 / 50万=100", () => {
    const s = (l: number) => Math.round(scoreOfLines(l, "log", 500_000));
    expect(s(1_000)).toBe(53);
    expect(s(10_000)).toBe(70);
    expect(s(100_000)).toBe(88);
    expect(s(500_000)).toBe(100);
    expect(scoreOfLines(0, "log", 500_000)).toBe(0);
  });

  it("切线性标定仍可用（参数可调，不硬编码）", () => {
    expect(scoreOfLines(25_000, "linear", 50_000)).toBe(50);
    expect(scoreOfLines(80_000, "linear", 50_000)).toBe(100);
  });

  it("匹配 0 词 → ok score=0（新领域语义）", async () => {
    const ctx = mkCtx(mkProfile(), mkLlm(["Kubernetes"]));
    const { devCreditProfileProficiency } = await import("./dev-credit-profile-proficiency.js");
    const r = await devCreditProfileProficiency(ctx, findNode(ID.proficiency)!);
    expect(r.status).toBe("ok");
    expect(r.score).toBe(0);
  });
});

describe("F4 · 累计AI协作行数档（算法 §5.2）", () => {
  it("主域匹配子集 25000 行 → 第 3 档（70 分）", async () => {
    const ctx = mkCtx(mkProfile(), mkLlm(["TypeScript"])); // 只匹配 pr-1
    const { devCreditProfileCollabLines } = await import("./dev-credit-profile-collab-lines.js");
    const r = await devCreditProfileCollabLines(ctx, findNode(ID.collabLines)!);
    expect(r.score).toBe(70);
  });

  it("History_Tasks 空（git-only）→ 按 git 行数分档（同单位复用 collabTiers）", async () => {
    const ctx = mkCtx(mkProfile({
      historyTasks: [],
      techDomain: { keywords: [{ name: "TypeScript", gitLines: 12_000, lastSeen: "", source: "git" }] },
    }));
    const { devCreditProfileCollabLines } = await import("./dev-credit-profile-collab-lines.js");
    const r = await devCreditProfileCollabLines(ctx, findNode(ID.collabLines)!);
    expect(r.score).toBe(70); // 12,000 ∈ (10k, 50k]
    expect(r.detail).toContain("git 行数");
  });
});

describe("F4 · 历史PR成功率（D-036）", () => {
  it("gitStats 15/20 → 75 分，证据标注 revert-not-checked", async () => {
    const ctx = mkCtx(mkProfile());
    const { devCreditHistorySuccessRate } = await import("./dev-credit-history-success-rate.js");
    const r = await devCreditHistorySuccessRate(ctx, findNode(ID.successRate)!);
    expect(r.score).toBe(75);
    expect(r.evidence.some((e) => e.kind === "note" && e.text.includes("revert-not-checked"))).toBe(true);
  });

  it("未同步 git（gitStats null）→ excluded_no_evidence（本地 PR 不参与）", async () => {
    const ctx = mkCtx(mkProfile({ gitStats: null }));
    const { devCreditHistorySuccessRate } = await import("./dev-credit-history-success-rate.js");
    const r = await devCreditHistorySuccessRate(ctx, findNode(ID.successRate)!);
    expect(r.status).toBe("excluded_no_evidence");
    expect(r.detail).toContain("D-036");
  });
});

describe("F4 · 近N次平均PR_Credit", () => {
  it("两次 80/60 → 平均 70，小样本标注 n", async () => {
    const ctx = mkCtx(mkProfile());
    const { devCreditHistoryRecentAvg } = await import("./dev-credit-history-recent-avg.js");
    const r = await devCreditHistoryRecentAvg(ctx, findNode(ID.recentAvg)!);
    expect(r.score).toBe(70);
    expect(r.detail).toContain("n=2");
  });

  it("无本地历史 → excluded_no_evidence", async () => {
    const ctx = mkCtx(mkProfile({ historyTasks: [] }));
    const { devCreditHistoryRecentAvg } = await import("./dev-credit-history-recent-avg.js");
    const r = await devCreditHistoryRecentAvg(ctx, findNode(ID.recentAvg)!);
    expect(r.status).toBe("excluded_no_evidence");
  });
});

describe("F4 · 当前 PR 不参与自己的评分（防自指 + 防自戳缓存）", () => {
  /** 模拟"结算后 hook 把本 PR 写回画像"后的状态 */
  function withSelfEntry() {
    return mkProfile({
      historyTasks: [
        { prId: "pr-1", ts: 1000, keywords: ["TypeScript"], aiCollabLines: 25_000, prCredit: 80, status: "committed", source: "local" },
        { prId: "pr-p3", ts: 3000, keywords: ["TypeScript"], aiCollabLines: 9_999, prCredit: 100, status: "committed", source: "local" },
      ],
    });
  }

  it("近N次平均不含当前 PR（本 PR = pr-p3 被排除）", async () => {
    const ctx = mkCtx(withSelfEntry(), mkLlm(["TypeScript"]));
    const { devCreditHistoryRecentAvg } = await import("./dev-credit-history-recent-avg.js");
    const r = await devCreditHistoryRecentAvg(ctx, findNode(ID.recentAvg)!);
    expect(r.score).toBe(80); // 只算 pr-1，不受 pr-p3（100 分）影响
  });

  it("本地行数熟练度不含当前 PR 的行数", async () => {
    // 未同步 git 场景（gitLines 全 0）才会用本地行数
    const profile = withSelfEntry();
    profile.techDomain = { keywords: [{ name: "TypeScript", gitLines: 0, lastSeen: "", source: "local" }] };
    const ctx = mkCtx(profile, mkLlm(["TypeScript"]));
    const { devCreditProfileProficiency } = await import("./dev-credit-profile-proficiency.js");
    const r = await devCreditProfileProficiency(ctx, findNode(ID.proficiency)!);
    expect(r.score).toBeCloseTo(scoreOfLines(25_000, "log", 500_000), 2); // 不含 pr-p3 的 9999 行
  });

  it("行数档子集排除当前 PR", async () => {
    const ctx = mkCtx(withSelfEntry(), mkLlm(["TypeScript"]));
    const { devCreditProfileCollabLines } = await import("./dev-credit-profile-collab-lines.js");
    const r = await devCreditProfileCollabLines(ctx, findNode(ID.collabLines)!);
    expect(r.detail).toContain("1 次"); // 只匹配 pr-1
  });
});

describe("F4 · profileStamp（缓存指纹的画像戳）", () => {
  it("写回当前 PR 条目 → 戳不变（否则每次结算都自戳缓存 → 重启必重算）", async () => {
    const { profileStamp } = await import("../profile/types.js");
    const p = mkProfile();
    const before = profileStamp(p, "pr-p3");
    // 模拟 hook：追加**当前 PR** 自己的条目 + 刷新 updatedAt
    p.historyTasks.push({
      prId: "pr-p3", ts: 9999, keywords: ["TypeScript"], aiCollabLines: 5000,
      prCredit: 70, status: "committed", source: "local",
    });
    p.updatedAt = "2026-10-01T00:00:00.000Z";
    expect(profileStamp(p, "pr-p3")).toBe(before);
  });

  it("真实变化（git 同步 / 编辑 / 他人 PR 结算）→ 戳必须变", async () => {
    const { profileStamp } = await import("../profile/types.js");
    const p = mkProfile();
    const base = profileStamp(p, "pr-p3");
    p.techDomain.keywords[0]!.gitLines += 1000; // git 同步带来的行数变化
    expect(profileStamp(p, "pr-p3")).not.toBe(base);
  });

  it("无画像 → p:none", async () => {
    const { profileStamp } = await import("../profile/types.js");
    expect(profileStamp(null, "x")).toBe("p:none");
  });
});

describe("F4 · 引擎前置与组聚合（Dev 分支）", () => {
  it("profile 存在 → devCredit 子树计分；共享关键词槽只触发 1 次 LLM", async () => {
    const ctx = mkCtx(mkProfile(), mkLlm(["TypeScript"]));
    const tree = await runEngine(ctx, findNode("devCredit")!);
    expect(tree.result.status).toBe("ok");
    // 熟练度 log(30001)/log(500001)≈82.57、行数档 70 → 画像组 ≈76.28
    // 成功率 75、近N次 70 → 历史组 72.5；子树 ≈74.39
    expect(tree.result.score).toBeCloseTo(
      ((scoreOfLines(30_000, "log", 500_000) + 70) / 2 + (75 + 70) / 2) / 2,
      1,
    );
    expect(ctx.stats.llmCalls).toBe(1); // D-042 共享提取
  });

  it("profile 缺失 → 整组 excluded，子节点不计算", async () => {
    const ctx = mkCtx(null);
    const tree = await runEngine(ctx, findNode("devCredit")!);
    expect(tree.result.status).toBe("excluded");
    expect(tree.children?.every((c) => c.result.status === "excluded")).toBe(true);
    expect(ctx.stats.llmCalls).toBe(0); // 前置不满足，连关键词都不提
  });
});
