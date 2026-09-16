/**
 * git 主页旁路（F3，决策 D-038 / D-039 / D-040）。
 *
 * **高效低成本设计**（SPEC P3 §4）：
 * - 成功率只取 search API 的 `total_count`（2 个请求），**不翻 PR 明细**；
 * - commit 只取 message 首行（截断），**不取 diff / patch**；
 * - README 只取头部（≤1500 字符 × 前 3 主仓）；
 * - LLM 输入为**本地聚合摘要**（目标 ≤6,000 字符，硬上限 12,000），
 *   调用前打点实际长度 —— 无任何原始 diff / log 进 prompt（延续 P2 审计结论）。
 *
 * **纯依赖注入**：fetch 与 LlmPort 均由调用方注入，全离线可单测；
 * token 由宿主从环境变量取（D-038：不落盘、不进日志、不进 prompt）。
 */
import { llmJson } from "../shared/llm-json.js";
import type { LlmPort } from "../llm/port.js";
import {
  emptyProfile,
  mergeGitData,
  type DevProfile,
  type ProfileDraft,
} from "./types.js";

// ───────────────────── 参数 ─────────────────────

export interface GitBypassParams {
  maxRepos: number;
  maxCommitsPerRepo: number;
  /**
   * 单个 commit 计入的行数上限（additions+deletions）。
   * 防"一次性 vendor 导入 / 批量删除"这类超大 commit 主导整个画像（实测单仓曾出现
   * 单批 +242k/−454k）。封顶后该 commit 仍计 1 次、只按上限计行。
   */
  maxLinesPerCommit: number;
  /** commit message 抽样只取活跃度前 N 仓 */
  sampleRepos: number;
  sampleMessagesPerRepo: number;
  msgMaxChars: number;
  readmeRepos: number;
  readmeHeadChars: number;
  /** LLM 输入目标预算（超限先裁掉可选段） */
  digestBudgetChars: number;
  /** 硬上限（与 llm-json MAX_INPUT_CHARS 一致，超限截断） */
  maxDigestChars: number;
}

export const DEFAULT_BYPASS_PARAMS: GitBypassParams = {
  maxRepos: 30,
  maxCommitsPerRepo: 100,
  maxLinesPerCommit: 20_000,
  sampleRepos: 5,
  sampleMessagesPerRepo: 30,
  msgMaxChars: 120,
  readmeRepos: 3,
  readmeHeadChars: 1500,
  digestBudgetChars: 6000,
  maxDigestChars: 12_000,
};

// ───────────────────── GitHub 访问 ─────────────────────

/** 注入式 fetch（命名避开 `llm` 的 FetchLike；宿主传 globalThis.fetch 即可） */
export type GithubFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

const GH_API = "https://api.github.com";
const GH_GRAPHQL = "https://api.github.com/graphql";

export interface RawRepo {
  fullName: string;
  description: string;
  language: string;
  topics: string[];
  pushAt: string;
  fork: boolean;
  /** 窗口内 commit 数（增量=新增数，初始化=最近 N 条数，上限 maxCommitsPerRepo） */
  commitCount: number;
  /**
   * 该用户在此仓**发起的 commit 的 diff 增量行数**（`additions + deletions` 之和）。
   * 单轨口径（D-043）：熟练度只看行数，自有仓 / 组织仓 / 他人仓一视同仁。
   */
  gitLines: number;
  messages: string[];
  languages: Record<string, number>;
  readmeHead?: string;
  lastCommitAt?: string;
  /** 空仓库（窗口内无 commit，GitHub 对无 commit 仓返回 409/404）—— 摘要标注，避免 LLM 幻觉 */
  empty?: boolean;
}

export interface RawOverview {
  login: string;
  bio: string;
  repos: RawRepo[];
  prTotal: number;
  prMerged: number;
  /** 实际发出的请求数（预算审计） */
  requests: number;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** 空仓库 / 无内容的仓库：GitHub 对这些资源返回的"正常"错误码，不应中断整轮拉取 */
const TOLERATED_STATUS = new Set([404, 409, 422]);

async function ghJson(
  fetchLike: GithubFetch,
  path: string,
  token: string | null,
  headers: Record<string, string> = {},
): Promise<unknown> {
  if (!path.startsWith(GH_API)) throw new GitHubError(`非白名单域名：${path}`, 0);
  const res = await fetchLike(path, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "credit-prototype",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const detail =
      res.status === 403 || res.status === 429
        ? "（GitHub 限流：请检查 GITHUB_TOKEN 或稍后重试）"
        : "";
    throw new GitHubError(`GitHub API ${res.status} ${path} ${detail}`, res.status);
  }
  return res.json();
}

/**
 * 次要请求（某仓的 languages / commits）失败时**容忍空仓库**，返回 null。
 *
 * **为何必须容忍**：GitHub 对**无 commit 的仓库**返回 `409 Conflict`
 * （实测 `Katock-Cricket.github.io` 即此情形），它不代表请求写错，也不代表限流；
 * 若让它冒泡，一个空仓库就会让整轮初始化失败 —— 用户看到的是无关的错误。
 *
 * **403/429 仍必须冒泡**：限流时继续拉只会拿到更多 403，且游标不应在部分数据上推进。
 */
async function ghJsonTolerant(
  fetchLike: GithubFetch,
  path: string,
  token: string | null,
): Promise<unknown | null> {
  try {
    return await ghJson(fetchLike, path, token);
  } catch (e) {
    if (e instanceof GitHubError && TOLERATED_STATUS.has(e.status)) return null;
    throw e;
  }
}

/**
 * GitHub GraphQL（v4）调用。
 *
 * **为什么必须用 GraphQL 而不是 REST（D-043 的关键前提）**：单轨口径要统计
 * 「用户在**所有**仓库（自有 + 组织 + 他人）发起的 commit 的 diff 行数」。
 * - REST：commit 行数量在**单个 commit 详情**里（`GET /repos/{o}/{r}/commits/{sha}` 返回
 *   `stats.additions/deletions`），即**每 commit 一个请求** —— 30 仓 × 100 commit = 3000 请求，
 *   即便认证 5000/h 也不可行；且 REST **没有**"我贡献过的仓库"列表接口。
 * - GraphQL：`repositoriesContributedTo(includeUserRepositories: true)` **一次拿到全部三类仓库**，
 *   且 `Commit.additions/deletions` 可**随 history 内联返回**，行数与 commit 同一查询得出。
 *   实测单查询即可覆盖（8 仓 → 1 请求），成本从"每 commit 1 请求"降到"整体 3–4 请求"。
 *
 * GraphQL 强制要求认证 —— 无 token 直接抛错，不静默降级成别的口径。
 */
async function ghGraphQL<T>(
  fetchLike: GithubFetch,
  query: string,
  variables: Record<string, unknown>,
  token: string | null,
): Promise<T> {
  if (!token) throw new GitHubError("GraphQL 需要 GITHUB_TOKEN（行数统计无法匿名进行）", 401);
  const res = await fetchLike(GH_GRAPHQL, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "credit-prototype",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new GitHubError(
      `GitHub GraphQL ${res.status}` +
        (res.status === 401 ? "（token 无效或已过期）" : res.status === 403 ? "（限流或权限不足）" : ""),
      res.status,
    );
  }
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) {
    throw new GitHubError(`GitHub GraphQL 错误：${body.errors.map((e) => e.message).join("；")}`, 400);
  }
  if (!body.data) throw new GitHubError("GitHub GraphQL 返回无 data", 400);
  return body.data;
}

interface GhUserQuery {
  user: { id: string; bio: string | null; login: string } | null;
  prTotal: { issueCount: number };
  prMerged: { issueCount: number };
}

interface GhRepoQuery {
  user: {
    repositoriesContributedTo: {
      nodes: Array<{
        nameWithOwner: string;
        description: string | null;
        pushedAt: string | null;
        primaryLanguage: { name: string } | null;
        languages?: { nodes: Array<{ name: string }> } | null;
        defaultBranchRef: {
          target: {
            history: {
              nodes: Array<{
                additions: number;
                deletions: number;
                committedDate: string;
                messageHeadline: string;
              }>;
            };
          } | null;
        } | null;
      }>;
    } | null;
  } | null;
}

const Q_USER = `query($login: String!, $prAll: String!, $prMerged: String!) {
  user(login: $login) { id login bio }
  prTotal: search(query: $prAll, type: ISSUE) { issueCount }
  prMerged: search(query: $prMerged, type: ISSUE) { issueCount }
}`;

/** 一次取全部三类仓库（自有 / 组织 / 他人）+ 每个仓内**该用户**的 commit 行数 */
const Q_REPOS = `query($login: String!, $uid: ID!, $first: Int!, $perRepo: Int!, $since: GitTimestamp) {
  user(login: $login) {
    repositoriesContributedTo(
      first: $first, includeUserRepositories: true,
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      nodes {
        nameWithOwner
        description
        pushedAt
        primaryLanguage { name }
        languages(first: 5) { nodes { name } }
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: $perRepo, author: { id: $uid }, since: $since) {
                nodes { additions deletions committedDate messageHeadline }
              }
            }
          }
        }
      }
    }
  }
}`;

/**
 * 拉取用户概览（GraphQL，D-043 单轨行数口径）。
 * `since`（ISO）为增量游标：只统计该时间点之后的 commit。
 * 任何一步失败都整体抛出 —— **游标由调用方在成功后才推进**（D-041）。
 */
export async function fetchGithubOverview(opts: {
  user: string;
  token: string | null;
  fetchLike: GithubFetch;
  params?: Partial<GitBypassParams>;
  since?: string;
}): Promise<RawOverview> {
  const p = { ...DEFAULT_BYPASS_PARAMS, ...opts.params };
  let requests = 0;
  const step = async <T>(fn: () => Promise<T>): Promise<T> => {
    requests++;
    return fn();
  };

  // 1. 用户信息 + PR 统计（1 次 GraphQL；search issueCount 即成功率口径，D-036）
  const user = (await step(() =>
    ghGraphQL<GhUserQuery>(opts.fetchLike, Q_USER, {
      login: opts.user,
      prAll: `author:${opts.user} type:pr`,
      prMerged: `author:${opts.user} type:pr is:merged`,
    }, opts.token),
  )) as GhUserQuery;
  const uid = user?.user?.id ?? null;
  if (!uid) throw new GitHubError(`GraphQL 查不到用户：${opts.user}`, 404);

  // 2. 仓库池 + 每仓该用户的 commit 行数（1 次 GraphQL 覆盖自有/组织/他人三类仓库）
  const repoData = (await step(() =>
    ghGraphQL<GhRepoQuery>(opts.fetchLike, Q_REPOS, {
      login: opts.user,
      uid,
      first: Math.min(p.maxRepos, 50),
      perRepo: p.maxCommitsPerRepo,
      since: opts.since ?? null,
    }, opts.token),
  )) as GhRepoQuery;

  const repos: RawRepo[] = (repoData.user?.repositoriesContributedTo?.nodes ?? []).map((n) => {
    const history = n.defaultBranchRef?.target?.history?.nodes ?? [];
    // 单次 commit 行数封顶：防"一次性导入/删除 vendor 大块"让单个 commit 主导整个画像
    const lines = history.reduce(
      (sum, c) => sum + Math.min(p.maxLinesPerCommit, (c.additions ?? 0) + (c.deletions ?? 0)),
      0,
    );
    return {
      fullName: n.nameWithOwner,
      description: String(n.description ?? "").slice(0, 200),
      language: n.primaryLanguage?.name ?? "",
      topics: (n.languages?.nodes ?? []).map((l) => l.name),
      pushAt: String(n.pushedAt ?? ""),
      fork: false,
      commitCount: history.length,
      gitLines: lines,
      lastCommitAt: history[0]?.committedDate || undefined,
      empty: history.length === 0,
      messages: history
        .slice(0, p.sampleMessagesPerRepo)
        .map((c) => String(c.messageHeadline ?? "").slice(0, p.msgMaxChars))
        .filter(Boolean),
      languages: {}, // GraphQL 只取语言名列表（topics 承载），不再需要字节分布
    };
  });

  // 3. README 头部（前 readmeRepos 仓；空仓库跳过 —— 它必然 404）
  for (const repo of repos.filter((r) => !r.empty).slice(0, p.readmeRepos)) {
    try {
      requests++;
      const res = await opts.fetchLike(`${GH_API}/repos/${repo.fullName}/readme`, {
        headers: {
          accept: "application/vnd.github.raw+json",
          "user-agent": "credit-prototype",
          ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        },
      });
      if (res.ok) repo.readmeHead = (await res.text()).slice(0, p.readmeHeadChars);
    } catch {
      /* README 缺失不致命 */
    }
  }

  return {
    login: String(user?.user?.login ?? opts.user),
    bio: String(user?.user?.bio ?? "").slice(0, 300),
    repos,
    prTotal: Number(user?.prTotal?.issueCount ?? 0) || 0,
    prMerged: Number(user?.prMerged?.issueCount ?? 0) || 0,
    requests,
  };
}

// ───────────────────── 聚合摘要（LLM 输入）─────────────────────

/**
 * 构建紧凑摘要。**无 diff / 无原始 log**；超预算时先裁 README、再裁 commit 样本，
 * 最后硬截断到 maxDigestChars。返回实际长度（打点审计用）。
 */
export function buildDigest(
  overview: RawOverview,
  params?: Partial<GitBypassParams>,
  existing?: DevProfile,
): { text: string; chars: number } {
  const p = { ...DEFAULT_BYPASS_PARAMS, ...params };

  const sections: Array<{ priority: number; text: string }> = [];
  sections.push({
    priority: 0,
    text:
      `GitHub 用户：${overview.login}${overview.bio ? `（${overview.bio}）` : ""}\n` +
      `PR 统计（他人仓库贡献）：总 PR ${overview.prTotal}，其中 merged ${overview.prMerged}`,
  });
  sections.push({
    priority: 1,
    text:
      `\n== 活跃仓库（按最近推送，最多 ${p.maxRepos}）==\n` +
      overview.repos
        .map((r) => {
          const langs = Object.entries(r.languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([l, n]) => l)
            .join("/");
          const base =
            `- ${r.fullName}${r.empty ? "（无贡献）" : ""}${r.language ? ` [${r.language}]` : ""}` +
            `${r.description ? ` 描述: ${r.description}` : ""}` +
            `${r.topics.length ? ` 主题: ${r.topics.join(",")}` : ""}` +
            ` commit ${r.commitCount}、改动 ${r.gitLines} 行` +
            `${langs ? `；语言: ${langs}` : ""}`;
          return base;
        })
        .join("\n"),
  });

  // 可选段：commit message 样本（priority 2）、README（priority 3）
  const msgSection =
    `\n== commit 摘要样本（前 ${p.sampleRepos} 仓）==\n` +
    overview.repos
      .slice(0, p.sampleRepos)
      .filter((r) => r.messages.length > 0)
      .map((r) => `- ${r.fullName}: ${r.messages.join(" | ")}`)
      .join("\n");
  if (msgSection.includes("- ")) sections.push({ priority: 2, text: msgSection });

  const readmeSection = overview.repos
    .slice(0, p.readmeRepos)
    .filter((r) => r.readmeHead)
    .map((r) => `- ${r.fullName} README: ${r.readmeHead!.replace(/\s+/g, " ").slice(0, p.readmeHeadChars)}`)
    .join("\n");
  if (readmeSection) sections.push({ priority: 3, text: `\n== README 摘要 ==\n${readmeSection}` });

  if (existing && (existing.techDomain.keywords.length > 0 || existing.historyTasks.length > 0)) {
    sections.push({
      priority: 1,
      text:
        `\n== 现有画像关键词（增量更新，请基于它增量归纳）==\n` +
        existing.techDomain.keywords.map((k) => k.name).join("、"),
    });
  }

  // 超预算 → 按优先级从高往低丢弃可选段
  let picked = sections.filter((s) => s.priority <= 1);
  let text = picked.map((s) => s.text).join("\n");
  if (text.length > p.digestBudgetChars) {
    picked = sections.filter((s) => s.priority <= 1 && !s.text.startsWith("\n== 现有画像"));
    text = picked.map((s) => s.text).join("\n");
  }
  for (const s of [...sections].sort((a, b) => b.priority - a.priority)) {
    if (text.length <= p.digestBudgetChars) break;
    if (s.priority <= 1) continue;
    text = text.replace(s.text, "");
  }
  if (text.length > p.maxDigestChars) text = text.slice(0, p.maxDigestChars);

  return { text, chars: text.length };
}

// ───────────────────── LLM 归纳 ─────────────────────

const SUMMARIZE_SYS = `你是开发者画像归纳助手。根据给定的 GitHub 活动摘要，归纳该开发者的技术领域关键词，
并**指出每个关键词由哪些仓库支撑**。

要求：
1. keywords：8–15 个最能代表其技术领域的词（框架/语言/领域，如 "TypeScript" "前端工程" "区块链"）；
2. repos：**必须填摘要中真实出现的仓库全名**（owner/name），该关键词由这些仓支撑；
   一个仓可支撑多个关键词；
3. **不要输出行数/数字** —— 行数由系统按仓库精确累加，模型不估算；
4. 不要编造摘要中不存在的领域；通用词（"开发" "编程"）不要。

只输出 json，字段名必须严格如下：
{"keywords":[{"name":"TypeScript","repos":["owner/repo-a","owner/repo-b"]}]}`;

export interface KeywordDraft {
  name: string;
  /** 支撑该关键词的仓库全名（行数由代码按仓累加，不由模型估算） */
  repos: string[];
  /** 兼容：模型仍返回数值时的兜底（直接当行数用） */
  lines?: number;
}

export async function summarizeProfileKeywords(opts: {
  digest: string;
  llm: LlmPort;
}): Promise<{ ok: boolean; keywords: KeywordDraft[]; rationale: string }> {
  const r = await llmJson<{ keywords?: Array<{ name?: unknown; commits?: unknown }> }>(opts.llm, {
    metricId: "dev-profile",
    templateId: "dev-profile-v1",
    system: SUMMARIZE_SYS,
    user: opts.digest,
    schema: { type: "object" },
  });
  if (!r.ok || !r.data) return { ok: false, keywords: [], rationale: r.rationale };

  const list = Array.isArray((r.data as { keywords?: unknown }).keywords)
    ? ((r.data as { keywords: unknown[] }).keywords ?? [])
    : [];
  const keywords: KeywordDraft[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const o = (item ?? {}) as Record<string, unknown>;
    const name = String(o.name ?? "").trim().slice(0, 24);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const repos = Array.isArray(o.repos) ? o.repos.map(String) : [];
    const lines = o.lines ?? o.commits ?? o.gitLines; // 兼容旧/变体字段名
    keywords.push({ name, repos, lines: Math.max(0, Number(lines ?? 0) || 0) });
    if (keywords.length >= 15) break;
  }
  return {
    ok: keywords.length > 0,
    keywords,
    rationale: keywords.length > 0 ? "LLM 归纳完成" : "LLM 返回为空",
  };
}

/**
 * 把 LLM 的「关键词 ↔ 仓库」映射换算成**精确行数**（D-043：行数由代码算，不靠模型估）。
 * 模型若直接给了数字（兜底字段）则沿用；两者都没有则该关键词记 0 行。
 */
export function resolveKeywordLines(keywords: KeywordDraft[], repos: RawRepo[]): KeywordDraft[] {
  const byRepo = new Map(repos.map((r) => [r.fullName.toLowerCase(), r.gitLines]));
  return keywords.map((k) => {
    const sum = k.repos.reduce((acc, n) => acc + (byRepo.get(n.toLowerCase()) ?? 0), 0);
    return { ...k, lines: sum > 0 ? sum : k.lines ?? 0 };
  });
}

// ───────────────────── 编排：初始化 / 增量同步 ─────────────────────

export interface BypassOutcome {
  ok: boolean;
  error?: string;
  requests?: number;
  digestChars?: number;
}

/** F3a 初始化：产出**草稿**（D-039），调用方确认后才落正式文件 */
export async function initProfileFromGit(opts: {
  homeUrl: string;
  token: string | null;
  fetchLike: GithubFetch;
  llm: LlmPort;
  params?: Partial<GitBypassParams>;
  now?: Date;
}): Promise<BypassOutcome & { draft?: ProfileDraft }> {
  const login = parseHomeUrl(opts.homeUrl);
  if (!login) return { ok: false, error: `无法从地址解析用户名：${opts.homeUrl}` };
  const now = opts.now ?? new Date();

  let overview: RawOverview;
  try {
    overview = await fetchGithubOverview({ user: login, token: opts.token, fetchLike: opts.fetchLike, params: opts.params });
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }

  const digest = buildDigest(overview, opts.params);
  const sum = await summarizeProfileKeywords({ digest: digest.text, llm: opts.llm });
  if (!sum.ok) return { ok: false, error: `LLM 归纳失败：${sum.rationale}`, requests: overview.requests };

  const profile = emptyProfile(now);
  mergeGitData(
    profile,
    {
      // 行数由代码按仓精确累加（D-043），LLM 只负责"关键词 ↔ 仓库"的语义映射
      keywords: resolveKeywordLines(sum.keywords, overview.repos).map((k) => ({
        name: k.name,
        lines: k.lines ?? 0,
      })),
      gitStats: {
        totalPrCount: overview.prTotal,
        mergedPrCount: overview.prMerged,
        reposContributed: [],
      },
      repoCursors: Object.fromEntries(overview.repos.map((r) => [r.fullName, r.lastCommitAt])),
      user: overview.login,
    },
    now,
  );

  return {
    ok: true,
    requests: overview.requests,
    digestChars: digest.chars,
    draft: {
      createdAt: now.toISOString(),
      gitUser: overview.login,
      profile,
      digestChars: digest.chars,
      requests: overview.requests,
    },
  };
}

/** F3b 增量同步（D-040）：基于游标拉增量，直接合并返回（调用方落盘） */
export async function syncProfileFromGit(opts: {
  profile: DevProfile;
  token: string | null;
  fetchLike: GithubFetch;
  llm: LlmPort;
  params?: Partial<GitBypassParams>;
  now?: Date;
}): Promise<BypassOutcome & { profile?: DevProfile; changes?: string }> {
  const user = opts.profile.syncState.user ?? opts.profile.gitUser;
  if (!user) return { ok: false, error: "profile 未绑定 git 用户（未初始化）" };
  const now = opts.now ?? new Date();
  const since = opts.profile.syncState.lastSyncAt;

  let overview: RawOverview;
  try {
    overview = await fetchGithubOverview({
      user,
      token: opts.token,
      fetchLike: opts.fetchLike,
      params: opts.params,
      since,
    });
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }

  const digest = buildDigest(overview, opts.params, opts.profile);
  const sum = await summarizeProfileKeywords({ digest: digest.text, llm: opts.llm });
  if (!sum.ok) return { ok: false, error: `LLM 归纳失败：${sum.rationale}`, requests: overview.requests };

  const next = structuredClone(opts.profile);
  const before = next.techDomain.keywords.reduce((a, k) => a + k.gitLines, 0);
  mergeGitData(
    next,
    {
      // 增量语义：只有 since 之后的 commit 被统计，故此处都是**增量行数**
      keywords: resolveKeywordLines(sum.keywords, overview.repos).map((k) => ({
        name: k.name,
        lines: k.lines ?? 0,
      })),
      gitStats: {
        totalPrCount: overview.prTotal,
        mergedPrCount: overview.prMerged,
        reposContributed: [],
      },
      repoCursors: Object.fromEntries(overview.repos.map((r) => [r.fullName, r.lastCommitAt])),
      user,
    },
    now,
  );
  const after = next.techDomain.keywords.reduce((a, k) => a + k.gitLines, 0);

  return {
    ok: true,
    requests: overview.requests,
    digestChars: digest.chars,
    profile: next,
    changes: `关键词 ${before === after ? "无变化" : `行数累计 ${before}→${after}`}，PR 统计 ${overview.prMerged}/${overview.prTotal}`,
  };
}

/** 从主页 URL 解析 login（支持 github.com/<user> 与以 / 结尾、?tab 形态） */
export function parseHomeUrl(url: string): string | null {
  try {
    const u = new URL(String(url ?? "").trim());
    if (!/^www\./.test(u.hostname) ? u.hostname !== "github.com" : u.hostname !== "www.github.com") {
      if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    }
    const seg = u.pathname.split("/").filter(Boolean);
    return seg[0] ?? null;
  } catch {
    return null;
  }
}
