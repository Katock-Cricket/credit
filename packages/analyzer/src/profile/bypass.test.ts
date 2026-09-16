/**
 * F3 单测：git 主页旁路（fetch 全程 stub，零网络消耗；SPEC P3 §4 / §8，决策 D-043）。
 *
 * 覆盖：**GraphQL 单查询拿到自有/组织/他人三类仓 + 每仓该用户 commit 的 diff 行数** /
 * 单 commit 行数封顶 / 无 token 拒绝 / GraphQL errors 冒泡 / digest 预算与无 diff /
 * 关键词行数由代码按仓累加（不靠模型估算）/ 初始化草稿（D-039）/ 增量同步游标（D-041）。
 */
import { describe, expect, it } from "vitest";
import {
  buildDigest,
  fetchGithubOverview,
  GitHubError,
  initProfileFromGit,
  parseHomeUrl,
  resolveKeywordLines,
  syncProfileFromGit,
  type GithubFetch,
  type RawOverview,
} from "./index.js";
import { emptyProfile } from "./types.js";
import type { LlmPort, LlmResult } from "../llm/port.js";

// ───────────────────── stub 基建 ─────────────────────

interface RepoStub {
  nameWithOwner: string;
  description?: string;
  pushedAt?: string;
  language?: string;
  languages?: string[];
  /** 该用户在此仓的 commit（additions/deletions 即 diff 行数） */
  commits?: Array<{ additions: number; deletions: number; committedDate: string; messageHeadline: string }>;
}

function gql(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ data }), text: async () => JSON.stringify(data) };
}

/**
 * GraphQL stub：按 query 内容路由（user 查询 / repos 查询），REST 只用于 README。
 * 记录全部调用（url + body）以便断言"请求数"与"是否走了 GraphQL"。
 */
function mkGhStub(opts: {
  repos?: RepoStub[];
  prTotal?: number;
  prMerged?: number;
  readme?: string;
  graphqlStatus?: number;
} = {}) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetch: GithubFetch = async (url, init) => {
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    calls.push({ url, body });
    if (url.endsWith("/graphql")) {
      if (opts.graphqlStatus && opts.graphqlStatus !== 200) {
        return { ok: false, status: opts.graphqlStatus, json: async () => ({}), text: async () => "" };
      }
      const q = String(body.query ?? "");
      if (q.includes("prTotal")) {
        return gql({
          user: { id: "UID-1", login: "katock", bio: "dev" },
          prTotal: { issueCount: opts.prTotal ?? 34 },
          prMerged: { issueCount: opts.prMerged ?? 27 },
        });
      }
      return gql({
        user: {
          repositoriesContributedTo: {
            nodes: (opts.repos ?? []).map((r) => ({
              nameWithOwner: r.nameWithOwner,
              description: r.description ?? "",
              pushedAt: r.pushedAt ?? "2026-09-01T00:00:00Z",
              primaryLanguage: r.language ? { name: r.language } : null,
              languages: { nodes: (r.languages ?? []).map((n) => ({ name: n })) },
              defaultBranchRef: {
                target: {
                  history: {
                    nodes: r.commits ?? [],
                  },
                },
              },
            })),
          },
        },
      });
    }
    // README（REST raw）
    return { ok: true, status: 200, json: async () => null, text: async () => opts.readme ?? "# readme" };
  };
  return { fetch, calls };
}

function commit(additions: number, deletions: number, date: string, msg: string) {
  return { additions, deletions, committedDate: date, messageHeadline: msg };
}

const REPOS: RepoStub[] = [
  {
    nameWithOwner: "me/repo-a",
    description: "web framework",
    language: "TypeScript",
    languages: ["TypeScript", "JavaScript"],
    commits: [
      commit(120, 30, "2026-08-30T00:00:00Z", "feat: a1"),
      commit(10, 5, "2026-08-20T00:00:00Z", "fix: a2"),
    ],
  },
  {
    // 他人仓库（贡献者视角）—— D-043 要求纳入统计
    nameWithOwner: "other/repo-x",
    description: "someone else's repo",
    language: "Vue",
    languages: ["Vue"],
    commits: [commit(200, 50, "2026-07-01T00:00:00Z", "chore: x1")],
  },
  {
    nameWithOwner: "me/empty",
    description: "",
    commits: [],
  },
];

/** 可编程 LLM stub：返回「关键词 ↔ 仓库」映射 */
function mkLlm(keywords: Array<{ name: string; repos?: string[]; lines?: number }>): LlmPort {
  return {
    id: "null",
    isAvailable: async () => true,
    complete: async (): Promise<LlmResult> => ({ ok: true, json: { keywords }, model: "mock", cached: false }),
  };
}

// ───────────────────── fetchGithubOverview（GraphQL）─────────────────────

describe("F3 · fetchGithubOverview（D-043 单轨行数）", () => {
  it("自有 + 他人 + 组织仓一并统计：commit 行数 = Σ(additions+deletions)", async () => {
    const { fetch, calls } = mkGhStub({ repos: REPOS, readme: "# repo-a docs" });
    const ov = await fetchGithubOverview({ user: "katock", token: "t0k", fetchLike: fetch });

    expect(ov.login).toBe("katock");
    expect(ov.prTotal).toBe(34);
    expect(ov.prMerged).toBe(27);
    expect(ov.repos).toHaveLength(3);

    const a = ov.repos.find((r) => r.fullName === "me/repo-a")!;
    expect(a.commitCount).toBe(2);
    expect(a.gitLines).toBe(120 + 30 + 10 + 5); // 165
    expect(a.messages).toEqual(["feat: a1", "fix: a2"]);
    expect(a.lastCommitAt).toBe("2026-08-30T00:00:00Z");

    // 他人仓计入，且行数独立
    const x = ov.repos.find((r) => r.fullName === "other/repo-x")!;
    expect(x.gitLines).toBe(250);

    // 空仓标记
    expect(ov.repos.find((r) => r.fullName === "me/empty")!.empty).toBe(true);

    // 成本：**2 次 GraphQL**（用户+PR统计 / 全部仓库+行数）取代了 REST 时代逐仓逐 commit 的请求
    expect(calls.filter((c) => c.url.endsWith("/graphql"))).toHaveLength(2);
    // 另加非空仓的 README（REST raw）：repo-a 与 other/repo-x 共 2 次
    expect(calls.filter((c) => c.url.includes("/readme"))).toHaveLength(2);
    expect(calls.length).toBe(4);
  });

  it("单次 commit 行数封顶（防 vendor 大块导入主导画像）", async () => {
    const { fetch } = mkGhStub({
      repos: [{ nameWithOwner: "me/big", commits: [commit(300_000, 400_000, "2026-08-01T00:00:00Z", "vendor dump")] }],
    });
    const ov = await fetchGithubOverview({
      user: "katock",
      token: "t0k",
      fetchLike: fetch,
      params: { maxLinesPerCommit: 20_000 },
    });
    expect(ov.repos[0]!.gitLines).toBe(20_000);
  });

  it("无 token 直接拒绝（GraphQL 必须认证，不静默降级）", async () => {
    const { fetch } = mkGhStub({ repos: [] });
    await expect(fetchGithubOverview({ user: "katock", token: null, fetchLike: fetch })).rejects.toThrow(
      /GITHUB_TOKEN/,
    );
  });

  it("GraphQL errors 冒泡（非 200 也带明确提示）", async () => {
    const { fetch } = mkGhStub({ repos: [], graphqlStatus: 403 });
    await expect(
      fetchGithubOverview({ user: "katock", token: "bad", fetchLike: fetch }),
    ).rejects.toThrow(GitHubError);
  });

  it("增量：since 传入 GraphQL 变量（只统计新增 commit）", async () => {
    const { fetch, calls } = mkGhStub({ repos: REPOS });
    await fetchGithubOverview({ user: "katock", token: "t0k", fetchLike: fetch, since: "2026-08-01T00:00:00Z" });
    const repoQuery = calls.find((c) => String(c.body.query ?? "").includes("repositoriesContributedTo"))!;
    expect((repoQuery.body.variables as { since?: string }).since).toBe("2026-08-01T00:00:00Z");
  });
});

// ───────────────────── digest / 行数换算 ─────────────────────

function mkOverview(over: Partial<RawOverview> = {}): RawOverview {
  return {
    login: "katock",
    bio: "dev",
    repos: [
      {
        fullName: "me/repo-a",
        description: "d",
        language: "TypeScript",
        topics: ["t"],
        pushAt: "2026-09-01",
        fork: false,
        commitCount: 50,
        gitLines: 12_345,
        messages: Array.from({ length: 30 }, (_, i) => `feat: change ${i}`),
        languages: { TypeScript: 1 },
      },
    ],
    prTotal: 34,
    prMerged: 27,
    requests: 3,
    ...over,
  };
}

describe("F3 · buildDigest 预算控制", () => {
  it("含行数、不含 diff / patch 字样；长度打点准确", () => {
    const d = buildDigest(mkOverview());
    expect(d.text).toContain("12,345".replace(",", ""));
    expect(d.text).not.toMatch(/diff|patch/i);
    expect(d.chars).toBe(d.text.length);
  });

  it("超预算：先裁 README / commit 样本，硬上限兜底", () => {
    const big = mkOverview({
      repos: [
        {
          ...mkOverview().repos[0]!,
          readmeHead: "R".repeat(20_000),
          messages: Array.from({ length: 30 }, (_, i) => `m${i} ${"x".repeat(200)}`),
        },
      ],
    });
    const d = buildDigest(big, { digestBudgetChars: 2000, maxDigestChars: 4000 });
    expect(d.chars).toBeLessThanOrEqual(4000);
    expect(d.text).toContain("PR 统计");
    expect(d.text).toContain("me/repo-a");
  });
});

describe("F3 · resolveKeywordLines（行数由代码算，不由模型估）", () => {
  it("按仓库映射累加精确行数", () => {
    const out = resolveKeywordLines(
      [
        { name: "TypeScript", repos: ["me/repo-a", "other/repo-x"] },
        { name: "Vue", repos: ["other/repo-x"] },
      ],
      mkOverview({
        repos: [
          { ...mkOverview().repos[0]!, fullName: "me/repo-a", gitLines: 100 },
          { ...mkOverview().repos[0]!, fullName: "other/repo-x", gitLines: 250 },
        ],
      }).repos,
    );
    expect(out[0]!.lines).toBe(350);
    expect(out[1]!.lines).toBe(250);
  });

  it("模型没给仓库 → 退回其自报数字；都没给 → 0", () => {
    const repos = mkOverview().repos;
    const out = resolveKeywordLines(
      [
        { name: "A", repos: [], lines: 42 },
        { name: "B", repos: [] },
      ],
      repos,
    );
    expect(out[0]!.lines).toBe(42);
    expect(out[1]!.lines).toBe(0);
  });
});

// ───────────────────── 编排：初始化 / 增量同步 ─────────────────────

describe("F3 · initProfileFromGit（D-039 草稿）", () => {
  it("草稿写入 gitLines（单轨行数），不产生本地任务", async () => {
    const { fetch } = mkGhStub({ repos: REPOS });
    const out = await initProfileFromGit({
      homeUrl: "https://github.com/katock",
      token: "t0k",
      fetchLike: fetch,
      llm: mkLlm([
        { name: "TypeScript", repos: ["me/repo-a"] },
        { name: "Vue", repos: ["other/repo-x"] },
      ]),
    });
    expect(out.ok).toBe(true);
    const p = out.draft!.profile;
    expect(p.historyTasks).toEqual([]);
    expect(p.techDomain.keywords.find((k) => k.name === "TypeScript")!.gitLines).toBe(165);
    expect(p.techDomain.keywords.find((k) => k.name === "Vue")!.gitLines).toBe(250);
    expect(p.gitStats).toMatchObject({ totalPrCount: 34, mergedPrCount: 27 });
  });

  it("LLM 失败 → ok:false 并带原因", async () => {
    const { fetch } = mkGhStub({ repos: REPOS });
    const llm: LlmPort = {
      id: "null",
      isAvailable: async () => true,
      complete: async () => ({ ok: false, reason: "invalid-json", message: "bad" }),
    };
    const out = await initProfileFromGit({
      homeUrl: "https://github.com/katock",
      token: "t0k",
      fetchLike: fetch,
      llm,
    });
    expect(out.ok).toBe(false);
    expect(out.error).toContain("LLM 归纳失败");
  });

  it("非 GitHub 地址 → 解析失败", async () => {
    const out = await initProfileFromGit({
      homeUrl: "https://gitlab.com/x",
      token: "t0k",
      fetchLike: mkGhStub().fetch,
      llm: mkLlm([]),
    });
    expect(out.ok).toBe(false);
  });
});

describe("F3 · syncProfileFromGit（D-040 增量）", () => {
  async function prepare() {
    const { fetch } = mkGhStub({ repos: REPOS });
    const init = await initProfileFromGit({
      homeUrl: "https://github.com/katock",
      token: "t0k",
      fetchLike: fetch,
      llm: mkLlm([{ name: "TypeScript", repos: ["me/repo-a"] }]),
    });
    return init.draft!.profile;
  }

  it("同步成功：行数增量累加、游标推进（写入返回的克隆，原对象不变）", async () => {
    const profile = await prepare();
    const { fetch } = mkGhStub({ repos: REPOS });
    const out = await syncProfileFromGit({
      profile,
      token: "t0k",
      fetchLike: fetch,
      llm: mkLlm([{ name: "TypeScript", repos: ["me/repo-a"] }]),
      now: new Date("2026-09-02T00:00:00Z"),
    });
    expect(out.ok).toBe(true);
    expect(out.profile!.techDomain.keywords.find((k) => k.name === "TypeScript")!.gitLines).toBe(330); // 165×2
    expect(out.profile!.syncState.lastSyncAt).toBe("2026-09-02T00:00:00.000Z");
    expect(profile.syncState.lastSyncAt).not.toBe("2026-09-02T00:00:00.000Z");
  });

  it("git 失败 → 游标不推进、原 profile 不变", async () => {
    const profile = await prepare();
    const before = JSON.stringify(profile);
    const { fetch } = mkGhStub({ repos: [], graphqlStatus: 403 });
    const out = await syncProfileFromGit({ profile, token: "bad", fetchLike: fetch, llm: mkLlm([]) });
    expect(out.ok).toBe(false);
    expect(JSON.stringify(profile)).toBe(before);
  });
});

describe("F3 · parseHomeUrl", () => {
  it("接受 github.com/<user> 形态，拒绝其他域", () => {
    expect(parseHomeUrl("https://github.com/Katock-Cricket")).toBe("Katock-Cricket");
    expect(parseHomeUrl("https://github.com/Katock-Cricket/?tab=repositories")).toBe("Katock-Cricket");
    expect(parseHomeUrl("https://gitlab.com/x")).toBeNull();
    expect(parseHomeUrl("not a url")).toBeNull();
  });
});

void emptyProfile;
