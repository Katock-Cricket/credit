/**
 * F1+F2 单测：Dev_Profile schema 与纯合并逻辑（按功能点拆分，SPEC P3 §8）。
 *
 * 覆盖：规范化 / 本地 upsert 幂等（D-041）/ 关键词触达 / git 侧合并双轨隔离（D-037）/
 * 派生行数 / applyPrResult 全路径。
 */
import { describe, expect, it } from "vitest";
import {
  emptyProfile,
  ensureKeywordEntries,
  isInitialized,
  kwNorm,
  localLinesOf,
  matchedKeywords,
  mergeGitData,
  normalizeProfile,
  applyPrResult,
  upsertHistoryTask,
  type HistoryTask,
} from "./index.js";

function mkTask(over: Partial<HistoryTask> = {}): HistoryTask {
  return {
    prId: "pr-test-1",
    ts: 1_000,
    keywords: ["TypeScript"],
    aiCollabLines: 100,
    prCredit: 60,
    creditFingerprint: "fp-1",
    status: "committed",
    source: "local",
    ...over,
  };
}

describe("F1 · normalizeProfile", () => {
  it("空 profile 判定未初始化", () => {
    const p = emptyProfile();
    expect(isInitialized(p)).toBe(false);
  });

  it("非法输入返回 null；缺字段宽松补默认", () => {
    expect(normalizeProfile(null)).toBeNull();
    expect(normalizeProfile("x")).toBeNull();
    expect(normalizeProfile([])).toBeNull();
    const p = normalizeProfile({ techDomain: { keywords: [{ name: "Rust" }] } })!;
    expect(p.techDomain.keywords[0]!.name).toBe("Rust");
    expect(p.techDomain.keywords[0]!.gitLines).toBe(0);
    expect(p.historyTasks).toEqual([]);
    expect(p.syncState.repos).toEqual({});
  });

  it("roundtrip：normalize(normalize 的输出) 稳定", () => {
    const p = emptyProfile();
    ensureKeywordEntries(p, ["TypeScript"], "local");
    mergeGitData(p, {
      keywords: [{ name: "TypeScript", lines: 10 }],
      gitStats: { totalPrCount: 3, mergedPrCount: 2, reposContributed: [] },
      repoCursors: { "a/b": "2026-01-01T00:00:00Z" },
      user: "u",
    });
    const again = normalizeProfile(JSON.parse(JSON.stringify(p)))!;
    expect(again.techDomain.keywords[0]!.gitLines).toBe(10);
    expect(again.syncState.repos["a/b"]!.lastCommitAt).toBe("2026-01-01T00:00:00Z");
  });
});

describe("F2 · upsertHistoryTask 幂等（D-041）", () => {
  it("同 prId 同指纹 → skipped，不重复累计", () => {
    const p = emptyProfile();
    expect(upsertHistoryTask(p, mkTask()).reason).toBe("added");
    expect(upsertHistoryTask(p, mkTask()).reason).toBe("skipped");
    expect(p.historyTasks).toHaveLength(1);
  });

  it("同 prId 不同指纹（重算后）→ 替换，不产生第二条", () => {
    const p = emptyProfile();
    upsertHistoryTask(p, mkTask());
    const out = upsertHistoryTask(p, mkTask({ creditFingerprint: "fp-2", prCredit: 70 }));
    expect(out.reason).toBe("updated");
    expect(p.historyTasks).toHaveLength(1);
    expect(p.historyTasks[0]!.prCredit).toBe(70);
  });

  it("不同 prId → 追加且按 ts 排序", () => {
    const p = emptyProfile();
    upsertHistoryTask(p, mkTask({ ts: 100 }));
    upsertHistoryTask(p, mkTask({ prId: "pr-test-2", ts: 200 }));
    expect(p.historyTasks.map((t) => t.ts)).toEqual([100, 200]);
  });
});

describe("F2 · 关键词触达与派生行数", () => {
  it("ensureKeywordEntries 只建条目不动 gitLines；local 触达 git 条目 → merged", () => {
    const p = emptyProfile();
    mergeGitData(p, {
      keywords: [{ name: "Rust", lines: 5 }],
      gitStats: { totalPrCount: 0, mergedPrCount: 0, reposContributed: [] },
      repoCursors: {},
    });
    ensureKeywordEntries(p, ["rust"], "local"); // 归一命中
    const rust = p.techDomain.keywords.find((k) => kwNorm(k.name) === "rust")!;
    expect(rust.gitLines).toBe(5); // 本地触达不动 git 轨
    expect(rust.source).toBe("merged");
  });

  it("localLinesOf：同任务贡献多个匹配词只计一次（防重复累计）", () => {
    const p = emptyProfile();
    p.historyTasks.push(mkTask({ keywords: ["TypeScript", "React"], aiCollabLines: 100 }));
    p.historyTasks.push(mkTask({ prId: "pr-2", keywords: ["TypeScript"], aiCollabLines: 50 }));
    expect(localLinesOf(p, "typescript")).toBe(150);
    expect(localLinesOf(p, "react")).toBe(100);
  });

  it("matchedKeywords 归一匹配", () => {
    const p = emptyProfile();
    ensureKeywordEntries(p, ["TypeScript"], "local");
    expect(matchedKeywords(p, ["typescript", "Rust"])).toHaveLength(1);
  });
});

describe("F3 合并侧 · mergeGitData 双轨隔离（D-037）", () => {
  it("不触碰 historyTasks；gitStats 直接覆盖；游标推进", () => {
    const p = emptyProfile();
    p.historyTasks.push(mkTask());
    mergeGitData(p, {
      keywords: [{ name: "Go", lines: 7 }],
      gitStats: { totalPrCount: 10, mergedPrCount: 8, reposContributed: ["x/y"] },
      repoCursors: { "x/y": "2026-06-01T00:00:00Z" },
      user: "katock",
    });
    expect(p.historyTasks).toHaveLength(1);
    expect(p.gitStats).toMatchObject({ totalPrCount: 10, mergedPrCount: 8 });
    expect(p.syncState.repos["x/y"]!.lastCommitAt).toBe("2026-06-01T00:00:00Z");
    expect(p.gitUser).toBe("katock");
  });

  it("二次合并 reposContributed 去重累积", () => {
    const p = emptyProfile();
    const gs = { totalPrCount: 1, mergedPrCount: 1, reposContributed: ["a/b"] };
    mergeGitData(p, { keywords: [], gitStats: gs, repoCursors: {} });
    mergeGitData(p, { keywords: [], gitStats: { ...gs, reposContributed: ["a/b", "c/d"] }, repoCursors: {} });
    expect(p.gitStats!.reposContributed).toEqual(["a/b", "c/d"]);
  });
});

describe("F2 · applyPrResult 全路径", () => {
  it("正常路径：条目 + 关键词触达", () => {
    const p = emptyProfile();
    ensureKeywordEntries(p, ["TypeScript"], "local");
    const out = applyPrResult(p, {
      prId: "pr-x",
      ts: 5,
      prCredit: 66,
      creditFingerprint: "fp-x",
      feed: { profileKeywords: ["TypeScript", "LLM"], aiCollabLines: 120 },
    });
    expect(out.reason).toBe("added");
    expect(localLinesOf(p, "LLM")).toBe(120);
    expect(p.historyTasks[0]!.prCredit).toBe(66);
  });

  it("重复触发 → skipped 且不落盘变更", () => {
    const p = emptyProfile();
    ensureKeywordEntries(p, ["TypeScript"], "local");
    const input = {
      prId: "pr-x",
      ts: 5,
      prCredit: 66,
      creditFingerprint: "fp-x",
      feed: { profileKeywords: ["TypeScript"], aiCollabLines: 10 } as const,
    };
    applyPrResult(p, input);
    const linesBefore = localLinesOf(p, "TypeScript");
    const out = applyPrResult(p, input);
    expect(out.reason).toBe("skipped");
    expect(localLinesOf(p, "TypeScript")).toBe(linesBefore); // 行数派生自 tasks，天然不变
  });

  it("未初始化 → not-initialized", () => {
    const out = applyPrResult(emptyProfile(), {
      prId: "pr-x",
      ts: 1,
      prCredit: 50,
      feed: { profileKeywords: ["a"], aiCollabLines: 1 },
    });
    expect(out.reason).toBe("not-initialized");
  });

  it("关键词缺失仍 upsert 条目（prCredit 参与近N次平均）", () => {
    const p = emptyProfile();
    ensureKeywordEntries(p, ["TypeScript"], "local");
    const out = applyPrResult(p, {
      prId: "pr-y",
      ts: 2,
      prCredit: 40,
      creditFingerprint: "fp-y",
      feed: { profileKeywords: null, aiCollabLines: 0 },
      keywords: [],
    });
    expect(out.reason).toBe("added");
    expect(p.historyTasks[0]!.keywords).toEqual([]);
  });
});
