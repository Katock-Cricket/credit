/**
 * P3 画像层：`dev_profile.json` schema v1 与**纯合并逻辑**
 * （SPEC `P3-画像层.md` §2，决策 D-036 / D-037 / D-041 / D-042）。
 *
 * **纯函数模块**：本文件不做任何 I/O —— 读写由宿主（原型 server / P4 Worker）负责，
 * 本模块只提供对 `DevProfile` 对象的规范化与合并操作，保证全离线可单测。
 *
 * **状态管理核心决策（D-041「避免重复计算」）**：
 * - 本地轨的唯一事实源是 `historyTasks`（以 prId upsert、`creditFingerprint` 幂等）；
 * - `Tech_Domain.keywords` 的本地行数**不再冗余存储**，由 `localLinesOf()` 按
 *   historyTasks 现算。SPEC 原案"每关键词累计行数 += 本次行数"在重复触发 /
 *   同 prId 重算时无法幂等；改为派生值后**天然幂等**，且语义等价（对齐算法 §5.5）。
 * - git 侧（`gitLines` / `gitStats` / `syncState`）只能由 git 旁路写入，
 *   本地更新永不触碰 —— 互不覆盖（D-037）。
 *
 * **单轨口径（D-043）**：熟练度只看**行数**。git 侧存 `gitLines`（该用户 commit 的 diff
 * 增量行数，含自有 / 组织 / 他人仓库）；本地 PR 的 AI 协作行数**不另存** —— 它 commit 后
 * 本就会进入 git 历史，单轨下相加即重复计数。仅当**从未同步过 git** 时，
 * 才由 `localLinesOf()` 派生的本地行数作为近似来源。
 */

/**
 * Tech_Domain 关键词条目。`gitLines` 仅 git 旁路可写（D-043）。
 */
export interface KeywordEntry {
  name: string;
  /**
   * git 来源：该关键词关联仓库内，**该用户** commit 的 diff 增量行数
   * （`additions + deletions`，含自有 / 组织 / 他人仓库）。
   */
  gitLines: number;
  /** 最近一次触达日期（YYYY-MM-DD） */
  lastSeen: string;
  /** 最近一次触达来源 */
  source: "local" | "git" | "merged";
}

/** 本地历史 PR 条目（F2 产出；source 恒为 local） */
export interface HistoryTask {
  prId: string;
  ts: number;
  /** 仓库名（可缺省） */
  repo?: string;
  /** 本次 PR 关键词（来自 pr_credit.profileFeed，D-042） */
  keywords: string[];
  /** 本次 AI 协作行数（coreDiff.aiLines 总行数） */
  aiCollabLines: number;
  prCredit: number;
  /** 幂等锚点 = pr_credit 的 inputFingerprint（D-041） */
  creditFingerprint?: string;
  status: "committed";
  source: "local";
}

/** git 旁路产出的 PR 统计（D-036：成功率的唯一数据源） */
export interface GitStats {
  /** 他人仓库发起的 PR 总数（search total_count） */
  totalPrCount: number;
  /** 其中 merged 数 */
  mergedPrCount: number;
  /** 贡献过的他人仓库（ fullName 列表，增量累积） */
  reposContributed: string[];
  lastSyncAt: string;
}

export interface RepoSyncState {
  /** 该仓已同步到的最新 commit 时间（ISO）——增量游标 */
  lastCommitAt?: string;
}

export interface SyncState {
  user?: string;
  lastSyncAt?: string;
  repos: Record<string, RepoSyncState>;
}

export interface DevProfile {
  version: 1;
  updatedAt: string;
  /** 旁路绑定的主页 login（初始化后固定） */
  gitUser: string | null;
  techDomain: { keywords: KeywordEntry[] };
  historyTasks: HistoryTask[];
  gitStats: GitStats | null;
  syncState: SyncState;
}

/** 草稿（D-039）：**永不参与计分**，用户确认后才落正式文件 */
export interface ProfileDraft {
  createdAt: string;
  gitUser: string;
  profile: DevProfile;
  /** LLM 输入实际字符数（预算审计用） */
  digestChars: number;
  /** 本轮 git 请求次数 */
  requests: number;
}

// ───────────────────── 构造 / 规范化 ─────────────────────

export function emptyProfile(now = new Date()): DevProfile {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    gitUser: null,
    techDomain: { keywords: [] },
    historyTasks: [],
    gitStats: null,
    syncState: { repos: {} },
  };
}

export function todayStr(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** 关键词归一：trim + 小写（匹配口径统一走这里） */
export function kwNorm(name: string): string {
  return String(name ?? "").trim().toLowerCase();
}

/**
 * 从磁盘 JSON 规范化为 DevProfile；结构不合法返回 null（宿主按"未初始化"处理）。
 * 刻意宽松：缺字段补默认值，而不是拒绝 —— 画像文件由多来源增量写，字段演进要向前兼容。
 */
export function normalizeProfile(raw: unknown): DevProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const tech = (r.techDomain ?? {}) as Record<string, unknown>;
  const keywords = Array.isArray(tech.keywords) ? tech.keywords : [];
  const tasks = Array.isArray(r.historyTasks) ? r.historyTasks : [];
  const sync = (r.syncState ?? {}) as Record<string, unknown>;
  const gs = (r.gitStats ?? null) as Record<string, unknown> | null;
  return {
    version: 1,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
    gitUser: typeof r.gitUser === "string" ? r.gitUser : null,
    techDomain: {
      keywords: keywords
        .filter((k) => k && typeof k === "object")
        .map((k) => {
          const e = k as Record<string, unknown>;
          return {
            name: String(e.name ?? "").trim(),
            // D-043 单轨：gitCommits 已废弃；旧文件按 0 处理（避免静默错用旧口径）
            gitLines: Number(e.gitLines ?? 0) || 0,
            lastSeen: typeof e.lastSeen === "string" ? e.lastSeen : "",
            source: (["local", "git", "merged"] as const).includes(e.source as never)
              ? (e.source as KeywordEntry["source"])
              : "local",
          };
        })
        .filter((k) => k.name),
    },
    historyTasks: tasks
      .filter((t) => t && typeof t === "object")
      .map((t) => {
        const e = t as Record<string, unknown>;
        return {
          prId: String(e.prId ?? ""),
          ts: Number(e.ts ?? 0) || 0,
          repo: typeof e.repo === "string" ? e.repo : undefined,
          keywords: Array.isArray(e.keywords) ? e.keywords.map(String) : [],
          aiCollabLines: Number(e.aiCollabLines ?? 0) || 0,
          prCredit: Number(e.prCredit ?? 0) || 0,
          creditFingerprint: typeof e.creditFingerprint === "string" ? e.creditFingerprint : undefined,
          status: "committed" as const,
          source: "local" as const,
        };
      })
      .filter((t) => t.prId),
    gitStats:
      gs && Number(gs.totalPrCount ?? 0) >= 0
        ? {
            totalPrCount: Number(gs.totalPrCount ?? 0) || 0,
            mergedPrCount: Number(gs.mergedPrCount ?? 0) || 0,
            reposContributed: Array.isArray(gs.reposContributed) ? gs.reposContributed.map(String) : [],
            lastSyncAt: typeof gs.lastSyncAt === "string" ? gs.lastSyncAt : "",
          }
        : null,
    syncState: {
      user: typeof sync.user === "string" ? sync.user : undefined,
      lastSyncAt: typeof sync.lastSyncAt === "string" ? sync.lastSyncAt : undefined,
      repos:
        sync.repos && typeof sync.repos === "object" && !Array.isArray(sync.repos)
          ? (sync.repos as SyncState["repos"])
          : {},
    },
  };
}

/** 画像是否可用（参与计分的前置，算法 §5 可用性判定） */
export function isInitialized(p: DevProfile | null): boolean {
  if (!p) return false;
  return p.techDomain.keywords.length > 0 || p.historyTasks.length > 0;
}

// ───────────────────── 本地增量（F2）─────────────────────

export type UpsertReason = "added" | "updated" | "skipped";

/**
 * 按 prId upsert 本地历史条目（幂等，D-041）：
 * - 同 prId 且指纹相同 → skip（重复触发/重入）；
 * - 同 prId 指纹不同（重算后）→ 替换条目（行数/分数字段属条目本身，替换天然不重复累计）；
 * - 新 prId → 追加。
 */
export function upsertHistoryTask(
  p: DevProfile,
  task: HistoryTask,
  now = new Date(),
): { changed: boolean; reason: UpsertReason } {
  const idx = p.historyTasks.findIndex((t) => t.prId === task.prId);
  if (idx >= 0) {
    const old = p.historyTasks[idx]!;
    if (old.creditFingerprint && task.creditFingerprint && old.creditFingerprint === task.creditFingerprint) {
      return { changed: false, reason: "skipped" };
    }
    p.historyTasks[idx] = { ...task };
    p.updatedAt = now.toISOString();
    return { changed: true, reason: "updated" };
  }
  p.historyTasks.push({ ...task });
  p.historyTasks.sort((a, b) => a.ts - b.ts);
  p.updatedAt = now.toISOString();
  return { changed: true, reason: "added" };
}

/** 确保 keywords 都有条目（本地轨：gitLines 不动），并刷新 lastSeen */
export function ensureKeywordEntries(
  p: DevProfile,
  names: string[],
  source: KeywordEntry["source"],
  now = new Date(),
): void {
  const day = todayStr(now);
  const byKey = new Map(p.techDomain.keywords.map((k) => [kwNorm(k.name), k]));
  for (const raw of names) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    const key = kwNorm(name);
    const cur = byKey.get(key);
    if (cur) {
      cur.lastSeen = day;
      cur.source = cur.gitLines > 0 && source === "local" ? "merged" : source;
    } else {
      const entry: KeywordEntry = { name, gitLines: 0, lastSeen: day, source };
      p.techDomain.keywords.push(entry);
      byKey.set(key, entry);
    }
  }
  p.updatedAt = now.toISOString();
}

// ───────────────────── 派生量（计分输入）─────────────────────

/**
 * 某关键词的本地累计行数 = 含该关键词的历史任务的 aiCollabLines 之和。
 * **同一任务只计一次**（即使它贡献了多个匹配词），避免单次计算内重复累计。
 *
 * `excludePrId`：**当前 PR 不参与自己的评分**（算法 §5.4「近N次不含当前次」同理）。
 * 若计入，则"结算后写回本 PR 条目"会让本 PR 的熟练度/近N次被自己抬高，
 * 也会让本 PR 的缓存指纹随自己的写入而变化 —— 自指 + 自戳缓存。
 */
export function localLinesOf(p: DevProfile, keywordName: string, excludePrId?: string): number {
  const key = kwNorm(keywordName);
  const seen = new Set<string>();
  let total = 0;
  for (const t of p.historyTasks) {
    if (excludePrId && t.prId === excludePrId) continue;
    if (seen.has(t.prId)) continue;
    if (t.keywords.some((k) => kwNorm(k) === key)) {
      seen.add(t.prId);
      total += t.aiCollabLines;
    }
  }
  return total;
}

/** 与当前 PR 关键词匹配的画像条目（精确 + 归一匹配，算法 §5.1 步骤2） */
export function matchedKeywords(p: DevProfile, currentKeywords: string[]): KeywordEntry[] {
  const cur = new Set(currentKeywords.map(kwNorm).filter(Boolean));
  return p.techDomain.keywords.filter((k) => cur.has(kwNorm(k.name)));
}

/**
 * 画像**影响计分的内容摘要**（供 `inputFingerprint` 使用）。
 *
 * **刻意不用 `updatedAt`**：那是纯记账字段，而 profile 会在 credit 计算**之后**被
 * 本地增量 hook 写入 —— 用它做指纹会让"本次算完写回 profile"立刻戳掉本次的缓存，
 * 表现为**每次重启都重算**（实为自戳缓存）。改为内容摘要后：
 * - 写回**当前 PR 自己的条目** → 摘要不变（已 `excludePrId` 排除）→ 缓存稳定；
 * - git 同步 / 手动编辑等**真实变化** → 摘要变 → 重算（这才是期望行为）。
 */
export function profileStamp(p: DevProfile | null, excludePrId?: string): string {
  if (!p) return "p:none";
  const others = p.historyTasks.filter((t) => t.prId !== excludePrId);
  const kw = p.techDomain.keywords
    .map((k) => `${kwNorm(k.name)}:${k.gitLines}`)
    .sort()
    .join(",");
  const gs = p.gitStats;
  const aiLines = others.reduce((a, t) => a + t.aiCollabLines, 0);
  const credits = others.reduce((a, t) => a + t.prCredit, 0);
  return `p:${p.gitUser ?? ""}|${gs ? `${gs.totalPrCount}/${gs.mergedPrCount}/${gs.lastSyncAt}` : "-"}|${kw}|n${others.length}:ai${aiLines}:c${credits}`;
}

/**
 * 是否已同步过 git 行数（D-043 单轨的来源选择依据）。
 * 有任意关键词的 `gitLines > 0` 即视为 git 侧可信 —— 熟练度走 git 行数；
 * 否则回退到本地 PR 的 AI 协作行数（从未同步 git 的用户）。
 */
export function hasGitLines(p: DevProfile): boolean {
  return p.techDomain.keywords.some((k) => k.gitLines > 0);
}

// ───────────────────── git 旁路合并（F3）─────────────────────

/**
 * git 侧合并（D-037/D-040）：只写 gitLines / gitStats / syncState，
 * **永不触碰 historyTasks**（算法 §5.5「本地增量不覆盖 git-remote 来源」）。
 */
export function mergeGitData(
  p: DevProfile,
  data: {
    /** 单轨：行数（初始化为全量，增量同步为本周期增量） */
    keywords: Array<{ name: string; lines: number }>;
    gitStats: { totalPrCount: number; mergedPrCount: number; reposContributed: string[] };
    repoCursors: Record<string, string | undefined>;
    user?: string;
  },
  now = new Date(),
): void {
  const day = todayStr(now);
  const byKey = new Map(p.techDomain.keywords.map((k) => [kwNorm(k.name), k]));
  for (const { name, lines } of data.keywords) {
    const key = kwNorm(name);
    if (!key) continue;
    const inc = Math.max(0, Number(lines ?? 0) || 0);
    const cur = byKey.get(key);
    if (cur) {
      // 增量语义：调用方保证传入的是**增量行数**（本周期）或全量（初始化）
      cur.gitLines += inc;
      cur.lastSeen = day;
      cur.source = cur.source === "local" ? "merged" : "git";
    } else {
      const entry: KeywordEntry = { name, gitLines: inc, lastSeen: day, source: "git" };
      p.techDomain.keywords.push(entry);
      byKey.set(key, entry);
    }
  }

  // gitStats：search total_count 是权威值，直接覆盖（非累加）
  const prev = p.gitStats;
  p.gitStats = {
    totalPrCount: data.gitStats.totalPrCount,
    mergedPrCount: data.gitStats.mergedPrCount,
    reposContributed: [...new Set([...(prev?.reposContributed ?? []), ...data.gitStats.reposContributed])],
    lastSyncAt: now.toISOString(),
  };

  // 游标推进（D-041：成功才推进）
  for (const [repo, at] of Object.entries(data.repoCursors)) {
    if (at) p.syncState.repos[repo] = { lastCommitAt: at };
  }
  if (data.user) p.syncState.user = data.user;
  p.syncState.lastSyncAt = now.toISOString();
  p.gitUser = p.gitUser ?? data.user ?? null;
  p.updatedAt = now.toISOString();
}
