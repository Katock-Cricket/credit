/**
 * CREDIT MiniApp Worker（P4 · T3）。
 *
 * **宿主约定（源码确认，见 P4 SPEC 文首 A2）**：Bitfun 的 `worker_host.js` 用
 * **CJS `require()`** 加载本文件，取出「方法名字典」——键名即 `app.call('键名')`，
 * 故必须 `module.exports = { 'credit.xxx'(params) {...} }`（无 `onLoad`、无 default export）。
 *
 * **能力边界（A3）**：Worker 进程**没有** `app.*`（那是 iframe 侧 Bridge 的 API），
 * 只有原生 Node 能力 + `global.rpcEmit(event, data)`（单向推送）。因此：
 * - `FsPort` / `GitPort` → 原生 `fs` / `child_process`；
 * - `LlmPort` → **LLM 中继**（D-051）：`rpcEmit('credit:llm')` → iframe 调 `app.ai.complete`
 *   → `app.call('credit.__llmResult')` 回填。宿主 AI 无需 API Key，且数据不出端；
 * - `workspaceDir` → 由 iframe 经 transport 注入（Worker 只有 cwd = 应用目录）。
 *
 * **控制域不在本文件**：`credit.start/finish/end/getStatus/reset` 属于常驻主进程的采集桥，
 * 由 Bitfun 侧 `useMiniAppBridge` 直接转交（架构 §2.3 改动 ③ / D-053）。
 */
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const {
  buildTaskGraph,
  computeCredit,
  inputFingerprint,
  parseUnifiedDiff,
  RULESET,
  createDefaultAnalyticRegistry,
  createMemoryCache,
  DEFAULT_LLM_CONFIG,
  createBitfunLlmPort,
  normalizeProfile,
  isInitialized,
  ensureKeywordEntries,
  applyPrResult,
  initProfileFromGit,
  syncProfileFromGit,
} = require("@credit/analyzer");

const execFileAsync = promisify(execFile);

/** 数据面契约：`{home}/.bitfun/credit`（需规 §6.3，与主进程采集桥一致） */
const DATA_DIR = path.join(os.homedir(), ".bitfun", "credit");
const PROFILE_FILE = path.join(DATA_DIR, "dev_profile.json");
const DRAFT_FILE = path.join(DATA_DIR, "dev_profile.draft.json");

/** 提交 WARNING 阈值（与 UI 展示口径一致；真实来源为算法 config） */
const COMMIT_WARN_THRESHOLD = 40;

// ───────────────────────── LLM 中继（D-051，独立模块便于单测） ─────────────────────────

const { createRelayAi, resolveLlm } = require("./llm-relay.js");

/** 进度/告警推送（Worker → iframe）；异常自捕获，绝不影响计算 */
function emit(event, data) {
  try {
    if (typeof globalThis.rpcEmit === "function") globalThis.rpcEmit(event, data);
  } catch {
    /* 推送失败不影响计算 */
  }
}

const llmCache = createMemoryCache();

function createLlmPort() {
  return createBitfunLlmPort({
    ai: createRelayAi(),
    model: DEFAULT_LLM_CONFIG.bitfun.model,
    fallbackModel: DEFAULT_LLM_CONFIG.bitfun.fallbackModel,
    cache: llmCache,
  });
}

// ───────────────────────── 存储 IO ─────────────────────────

async function readJsonSafe(file) {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function writeJsonAtomic(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmp, file);
}

async function readBehaviors(prId) {
  try {
    const text = await fsp.readFile(path.join(DATA_DIR, "behaviors", `${prId}.jsonl`), "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null; // 坏行跳过（append-only 格式天然容错，架构 §7.5）
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 与原型一致：读正式画像；未初始化返回 null */
async function readProfile() {
  return normalizeProfile(await readJsonSafe(PROFILE_FILE));
}

// ───────────────────────── Git Port（原生） ─────────────────────────

function normUri(u) {
  const s = String(u ?? "").replace(/\\/g, "/");
  if (s.startsWith("a/") || s.startsWith("b/")) return s.slice(2);
  return s;
}

async function git(args, cwd) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

/** `git diff --numstat` → { uri: {added, deleted} } */
function parseNumstat(out) {
  const map = new Map();
  for (const line of String(out).split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const added = parts[0] === "-" ? 0 : Number(parts[0]) || 0;
    const deleted = parts[1] === "-" ? 0 : Number(parts[1]) || 0;
    // 重命名形如 `old => new` 或 `dir/{a => b}/f`，取最终新路径
    let uri = parts.slice(2).join("\t");
    const arrow = uri.indexOf(" => ");
    if (arrow >= 0) uri = uri.replace(/\{[^}]*=> ([^}]*)\}/, "$1").split(" => ").pop();
    map.set(normUri(uri), { added, deleted });
  }
  return map;
}

/**
 * analyzer 的 `GitPort`（`packages/analyzer/src/credit/types.ts`）：
 * `diff({cwd,base,head})` → `GitDiffSnapshot`；`commitCount({cwd})` → number。
 * `available:false` 表示 git 不可用/非仓库 —— 下游据此降级（架构 §7.5）。
 */
const gitPort = {
  async diff({ cwd, base, head }) {
    const range = [base, head].filter(Boolean).join("..");
    const args = (extra) => (range ? ["diff", ...extra, range] : ["diff", ...extra]);
    try {
      const [numstatOut, patchOut, headOut, logOut] = await Promise.all([
        git(args(["--numstat"]), cwd),
        git(args(["-U0"]), cwd),
        git(["rev-parse", "HEAD"], cwd),
        git(["log", "--oneline"], cwd),
      ]);
      const numstat = parseNumstat(numstatOut);
      const patch = parseUnifiedDiff(patchOut);
      const patchByUri = new Map(patch.map((p) => [normUri(p.uri), p]));
      const files = [...numstat.entries()].map(([uri, s]) => {
        const p = patchByUri.get(uri);
        return {
          uri,
          added: s.added,
          deleted: s.deleted,
          addedLines: p?.addedLines ?? null,
          addedTexts: p?.addedTexts ?? null,
        };
      });
      return {
        available: true,
        files,
        commitCount: String(logOut).split("\n").filter(Boolean).length,
        base: base ?? undefined,
        head: headOut.trim(),
      };
    } catch {
      return { available: false, files: null, commitCount: 0 };
    }
  },
  async commitCount({ cwd, base, head }) {
    const range = [base, head].filter(Boolean).join("..");
    try {
      const out = await git(range ? ["log", "--oneline", range] : ["log", "--oneline"], cwd);
      return String(out).split("\n").filter(Boolean).length;
    } catch {
      return 0;
    }
  },
};

/** analyzer 的 `FsPort`：只读，用于 SPEC 文档等工件 */
const fsPort = {
  async readFile(uri) {
    try {
      return await fsp.readFile(uri, "utf8");
    } catch {
      return null;
    }
  },
};

// ───────────────────────── 过程建模 / 计算 ─────────────────────────

const analyticRegistry = createDefaultAnalyticRegistry();

async function loadTaskGraph(prId, { force = false } = {}) {
  const cacheFile = path.join(DATA_DIR, "tasks", `${prId}.json`);
  if (!force) {
    const cached = await readJsonSafe(cacheFile);
    if (cached) return { graph: cached, cached: true };
  }
  const behaviors = await readBehaviors(prId);
  if (behaviors.length === 0) return { graph: null, cached: false };
  const graph = await buildTaskGraph({ prId, behaviors, llm: createLlmPort() });
  await writeJsonAtomic(cacheFile, graph);
  return { graph, cached: false };
}

async function runCompute({ prId, workspaceDir, force = false }) {
  const behaviors = await readBehaviors(prId);
  if (behaviors.length === 0) return { ok: false, error: `无行为数据：${prId}` };

  const { graph } = await loadTaskGraph(prId, { force: false }); // 与 credit 解耦（D-049）
  if (!graph) return { ok: false, error: `Task 建模失败：${prId}` };

  const gitDiff = workspaceDir
    ? await gitPort.diff({ cwd: workspaceDir })
    : { available: false, files: null, commitCount: 0 };
  const profile = await readProfile();
  const fp = inputFingerprint({ behaviors, taskGraph: graph, gitDiff, profile, prId });

  const cacheFile = path.join(DATA_DIR, "pr_credit", `${prId}.json`);
  let cacheMiss = null;
  if (!force) {
    const cached = await readJsonSafe(cacheFile);
    /**
     * **已结算 PR 以缓存为准（D-055）**：结果一旦算出即为该 PR 的**定稿快照**。
     *
     * 旧逻辑拿"活的 git 工作区"比对指纹，只要用户继续编辑 / 提交，
     * `gitDiff.head` 与 `gitDiff.files.length` 就会漂移 —— 表现为
     * **"本地明明有缓存却每次重算"**（且重算含 LLM，代价高）。
     * 现在：有缓存直接命中；**重算必须显式 force**（UI 的「重新计算」按钮）。
     * 指纹仍照常计算并写入结果，供诊断与（将来）增量判定使用。
     */
    if (cached) {
      // 诊断：即使命中缓存，也把"旧指纹 vs 当前输入指纹"透出，便于回答"为什么以前会重算"
      emit("credit:progress", {
        phase: "cache",
        hit: true,
        fpStored: cached.generator?.inputFingerprint ?? null,
        fpCurrent: fp,
        fpEqual: cached.generator?.inputFingerprint === fp,
      });
      return { ok: true, result: cached, cached: true, cacheNote: "snapshot（已结算 PR 以缓存为准）" };
    }
  }

  const result = await computeCredit({
    prId,
    behaviors,
    taskGraph: graph,
    llm: createLlmPort(),
    gitDiff,
    git: gitPort,
    fs: fsPort,
    profile,
    onProgress: (p) => emit("credit:progress", p),
  });
  await writeJsonAtomic(cacheFile, result);

  // 结算后 best-effort 本地增量更新画像（D-041；失败不影响返回）
  if (profile && !force) {
    try {
      await applyProfileFromCredit(result);
    } catch (e) {
      emit("credit:progress", { warn: `画像增量更新失败：${String(e?.message ?? e)}` });
    }
  }
  return { ok: true, result, cached: false, cacheMiss };
}

/** 由已落盘的 pr_credit 结果更新画像（幂等；D-041/D-042） */
async function applyProfileFromCredit(result) {
  const profile = await readProfile();
  if (!profile) return { changed: false, reason: "no-profile" };
  const prId = result.prId;
  let keywords = result.profileFeed?.profileKeywords ?? null;
  if (!keywords || keywords.length === 0) {
    keywords = [];
  }
  const out = applyPrResult(profile, {
    prId,
    ts: result.generatedAt ?? Date.now(),
    prCredit: result.summary?.prCredit ?? 0,
    creditFingerprint: result.generator?.inputFingerprint,
    feed: { profileKeywords: keywords, aiCollabLines: result.profileFeed?.aiCollabLines ?? 0 },
    keywords,
  });
  if (out.changed) await writeJsonAtomic(PROFILE_FILE, out.profile);
  return out;
}

// ───────────────────────── 方法表 ─────────────────────────

function ok(data) {
  return { ok: true, ...data };
}
function fail(error) {
  return { ok: false, error: String(error) };
}

module.exports = {
  /** LLM 中继回填（iframe → Worker；见 D-051） */
  "credit.__llmResult"(params) {
    return resolveLlm(params);
  },

  /** 指标树结构（UI 渲染与 i18n 名共用的单一事实来源） */
  "credit.getRules"() {
    return ok({ ruleSet: RULESET });
  },

  /** UI 展示用阈值/权重（算法 §6.2 / 架构 §7.1） */
  "credit.getConfig"() {
    return ok({
      thresholds: { commitWarning: COMMIT_WARN_THRESHOLD },
      weights: { procWeight: 0.8, devWeight: 0.2 },
    });
  },

  async "credit.listPrs"() {
    try {
      const dir = path.join(DATA_DIR, "behaviors");
      const names = await fsp.readdir(dir);
      const items = [];
      for (const f of names.filter((n) => n.endsWith(".jsonl"))) {
        const full = path.join(dir, f);
        const st = await fsp.stat(full);
        const text = await fsp.readFile(full, "utf8");
        items.push({
          prId: f.replace(/\.jsonl$/, ""),
          size: st.size,
          mtimeMs: st.mtimeMs,
          behaviorCount: text.split("\n").filter(Boolean).length,
        });
      }
      items.sort((a, b) => b.mtimeMs - a.mtimeMs);
      return ok({ items });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },

  async "credit.getTaskStageView"({ prId, force }) {
    if (!prId) return fail("missing prId");
    try {
      const { graph, cached } = await loadTaskGraph(prId, { force: !!force });
      if (!graph) return fail(`无行为数据：${prId}`);
      return ok({ graph, cached, analytics: analyticRegistry.runAll(graph, []) });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },

  async "credit.getBehaviors"({ prId, ids }) {
    if (!prId) return fail("missing prId");
    const all = await readBehaviors(prId);
    const want = Array.isArray(ids) && ids.length > 0 ? new Set(ids) : null;
    return ok({ items: want ? all.filter((b) => want.has(b.id)) : all });
  },

  async "credit.compute"({ prId, workspaceDir, force }) {
    if (!prId) return fail("missing prId");
    try {
      return await runCompute({ prId, workspaceDir, force: !!force });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },

  // ── 画像域（P3 逻辑零改动，仅换宿主：fs → 原生） ──

  async "credit.getProfile"() {
    const profile = await readProfile();
    return ok({
      initialized: isInitialized(profile),
      profile,
      draft: await readJsonSafe(DRAFT_FILE),
      hasGithubToken: !!process.env.GITHUB_TOKEN,
    });
  },

  async "credit.importProfileFromGit"({ homeUrl }) {
    if (!homeUrl) return fail("缺少 homeUrl");
    try {
      const out = await initProfileFromGit({
        homeUrl: String(homeUrl),
        token: process.env.GITHUB_TOKEN ?? null,
        fetchLike: (url, init) => fetch(url, init),
        llm: createLlmPort(),
      });
      if (!out.ok) return fail(out.error);
      await writeJsonAtomic(DRAFT_FILE, out.draft);
      return ok({ digestChars: out.digestChars, requests: out.requests });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },

  async "credit.confirmProfileDraft"({ profile }) {
    const draft = await readJsonSafe(DRAFT_FILE);
    if (!draft?.profile && !profile) return fail("无待确认草稿");
    const p = normalizeProfile(profile ?? draft.profile);
    if (!p) return fail("草稿数据不合法");
    if (!isInitialized(p)) return fail("草稿为空画像，拒绝确认");
    await writeJsonAtomic(PROFILE_FILE, p);
    try {
      await fsp.unlink(DRAFT_FILE);
    } catch {
      /* 已不存在 */
    }
    return ok({ gitUser: p.gitUser, keywords: p.techDomain.keywords.length });
  },

  async "credit.discardProfileDraft"() {
    try {
      await fsp.unlink(DRAFT_FILE);
    } catch {
      /* 无草稿 */
    }
    return ok({});
  },

  async "credit.syncProfileFromGit"() {
    const profile = await readProfile();
    if (!profile) return fail("尚未初始化画像");
    try {
      const out = await syncProfileFromGit({
        profile,
        token: process.env.GITHUB_TOKEN ?? null,
        fetchLike: (url, init) => fetch(url, init),
        llm: createLlmPort(),
      });
      if (!out.ok) return fail(out.error);
      await writeJsonAtomic(PROFILE_FILE, out.profile);
      return ok({ changes: out.changes, gitStats: out.profile.gitStats, requests: out.requests });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },

  /** 本地增量更新：只消费已落盘的 pr_credit，**不重算 credit**（D-041） */
  async "credit.updateProfileFromPr"({ prId }) {
    if (!prId) return fail("missing prId");
    const result = await readJsonSafe(path.join(DATA_DIR, "pr_credit", `${prId}.json`));
    if (!result) return fail(`无 pr_credit 结果：${prId}`);
    try {
      const out = await applyProfileFromCredit(result);
      return ok({ changed: out.changed, reason: out.reason });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },

  async "credit.saveProfile"({ profile }) {
    const p = normalizeProfile(profile);
    if (!p) return fail("profile 不合法");
    await writeJsonAtomic(PROFILE_FILE, p);
    return ok({});
  },

  async "credit.editProfile"({ addKeywords, removeKeywords }) {
    const profile = await readProfile();
    if (!profile) return fail("尚未初始化画像");
    const add = Array.isArray(addKeywords) ? addKeywords : [];
    const remove = new Set(
      (Array.isArray(removeKeywords) ? removeKeywords : []).map((s) => String(s).toLowerCase()),
    );
    if (add.length === 0 && remove.size === 0) return fail("无编辑内容");
    ensureKeywordEntries(profile, add, "local");
    profile.techDomain.keywords = profile.techDomain.keywords.filter(
      (k) => !remove.has(String(k.name).toLowerCase()),
    );
    profile.updatedAt = new Date().toISOString();
    await writeJsonAtomic(PROFILE_FILE, profile);
    return ok({ keywords: profile.techDomain.keywords.length });
  },

  // ── 提交域（M6，D-048：只 commit，push 独立） ──

  async "credit.getChangedFiles"({ workspaceDir }) {
    if (!workspaceDir) return fail("缺少 workspaceDir");
    try {
      const out = await git(["status", "--porcelain"], workspaceDir);
      const files = String(out)
        .split("\n")
        .filter(Boolean)
        .map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3).trim() }));
      return ok({ files });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },

  async "credit.commitAndPush"({ workspaceDir, files, message, push }) {
    if (!workspaceDir) return fail("缺少 workspaceDir");
    if (!Array.isArray(files) || files.length === 0) return fail("未选择文件");
    if (!message || !String(message).trim()) return fail("commit 说明为空");
    try {
      await git(["add", "--", ...files], workspaceDir);
      await git(["commit", "-m", String(message)], workspaceDir);
      const commitHash = (await git(["rev-parse", "--short", "HEAD"], workspaceDir)).trim();
      let pushed = false;
      if (push) {
        await git(["push"], workspaceDir);
        pushed = true;
      }
      return ok({ commitHash, pushed });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },

  async "credit.push"({ workspaceDir }) {
    if (!workspaceDir) return fail("缺少 workspaceDir");
    try {
      await git(["push"], workspaceDir);
      return ok({ pushed: true });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
};
