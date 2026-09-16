/**
 * CREDIT MiniApp 三按钮原型（P1 任务 T7，决策 D-005）。
 *
 * 形态：**仓内独立可运行** —— 零外部依赖（仅 Node 内置 http/fs），不依赖 Bitfun 桌面环境，
 * 不修改 Bitfun 仓白名单（架构 §2.3 四处之外零改动）。
 * 用途：人工验证 P1 会话生命周期（开始 / 放弃 / 结束保存）与断点恢复（自动接续）。
 *
 * 启动：
 *   pnpm --filter @credit/miniapp-prototype dev
 *   → 打开 http://127.0.0.1:5178
 *
 * 环境变量：
 *   CREDIT_PROTO_PORT  端口（默认 5178）
 *   CREDIT_HOME        数据根目录（默认 <home>/.bitfun/credit）
 *   OPENAI_API_KEY     外部 LLM 密钥（可选；不设则过程建模走规则降级路径，D-023）
 */
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createBridge } from "@credit/core";
import {
  buildTaskGraph,
  computeCredit,
  inputFingerprint,
  parseUnifiedDiff,
  RULESET,
  createDefaultAnalyticRegistry,
  createOpenAILlmPort,
  createNullLlmPort,
  createMemoryCache,
  DEFAULT_LLM_CONFIG,
  // P3 画像层
  normalizeProfile,
  isInitialized,
  ensureKeywordEntries,
  applyPrResult,
  initProfileFromGit,
  syncProfileFromGit,
  extractPrKeywords,
} from "@credit/analyzer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CREDIT_PROTO_PORT ?? 5178);
const ROOT = process.env.CREDIT_HOME ?? path.join(os.homedir(), ".bitfun", "credit");

const bridge = createBridge({
  store: { rootDir: ROOT },
  logger: { console: false, logDir: path.join(ROOT, "logs") },
});

/** 启动即断点恢复；结果保留供 UI 提示"已自动接续上轮未提交记录" */
let lastRecover = await bridge.recover();

function newPrId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `pr-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

const api = {
  /** 状态：会话 + 治理统计（raw/behavior/baseline/merged）+ 最近一次恢复结果 */
  async status() {
    // 先同步磁盘会话：Bitfun 侧 2s 回写一次 seq/counts/治理统计，
    // 不同步的话这里读到的会是启动时的旧快照（表现为界面统计恒为 0）。
    await bridge.syncSession();
    const s = bridge.session.current;
    return {
      ok: true,
      session: s
        ? { prId: s.prId, state: s.state, seq: s.seq, startedAt: s.startedAt, counts: s.counts }
        : null,
      stats: s?.stats ?? bridge.stats,
      recover: lastRecover,
      dirs: bridge.store.dirs,
    };
  },

  async start() {
    const s = await bridge.session.start(newPrId());
    return { ok: true, session: { prId: s.prId, state: s.state } };
  },

  /** 结束并保存：先冲刷治理 pending，再 finish（recording→computing→committed），最后落盘 */
  async finish() {
    const prId = bridge.session.current?.prId;
    if (!prId) return { ok: false, error: "no active session" };
    bridge.flushPending();
    const s = await bridge.session.finish(prId);
    await bridge.flush();
    return { ok: true, session: { prId: s.prId, state: s.state } };
  },

  /** 放弃本轮：清缓冲 + 删除本轮 raw/behaviors + 置 idle */
  async reset() {
    const rep = await bridge.session.reset();
    return { ok: true, reset: rep };
  },

  /** 手动重跑断点恢复（模拟 Bitfun 重启） */
  async recover() {
    lastRecover = await bridge.recover();
    return { ok: true, recover: lastRecover };
  },
};

// ─────────────── P2-pre：过程建模与可视化 API（决策 D-012 / D-023）───────────────

/** 读取 <ROOT>/config.json 的 llm 段（缺失则用默认配置） */
async function loadLlmConfig() {
  try {
    const raw = await fsp.readFile(path.join(ROOT, "config.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.llm) return { ...DEFAULT_LLM_CONFIG, ...parsed.llm };
  } catch {
    /* 缺失/坏文件 → 用默认配置 */
  }
  return { ...DEFAULT_LLM_CONFIG };
}

let llmPortPromise = null;
async function getLlmPort() {
  if (!llmPortPromise) {
    llmPortPromise = (async () => {
      const llmCfg = await loadLlmConfig();
      if (llmCfg.provider === "openai-compatible") {
        const port = createOpenAILlmPort({
          baseUrl: llmCfg.openaiCompatible.baseUrl,
          model: llmCfg.openaiCompatible.model,
          apiKeyEnv: llmCfg.openaiCompatible.apiKeyEnv,
          timeoutMs: llmCfg.timeoutMs,
          retry: llmCfg.retryPerModel,
          cache: llmCfg.cacheEnabled ? createMemoryCache() : null,
        });
        const ok = await port.isAvailable();
        console.log(
          ok
            ? `[credit] LLM: openai-compatible ready (model=${llmCfg.openaiCompatible.model})`
            : `[credit] LLM: 未检测到 ${llmCfg.openaiCompatible.apiKeyEnv}，过程建模走规则降级路径`,
        );
        return ok ? port : createNullLlmPort();
      }
      return createNullLlmPort();
    })();
  }
  return llmPortPromise;
}

const analyticRegistry = createDefaultAnalyticRegistry();

// ─────────────── P2：git / 文件 Port（决策 D-030：使用真实 git） ───────────────

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
  const { stdout } = await execFileAsync(GIT_BIN, args, {
    cwd,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
}

/** git 可执行文件名：环境 PATH 异常时可用 CREDIT_GIT_BIN 指定绝对路径 */
const GIT_BIN = process.env.CREDIT_GIT_BIN ?? "git";

/**
 * 分析配置（git 工作区 / PR 提交）**必须持久化**。
 *
 * **原因**：输入指纹包含 gitDiff 摘要。若只靠环境变量，一旦重启时忘了设，
 * git 就不可用 → 指纹变化 → **缓存全部失效并重算**（8 次 LLM，约 8 分钟），
 * 而用户看到的只是"正在计算…"，完全不知道是被环境变量坑了。
 *
 * 优先级：环境变量 > `config.json.analysis` > 默认；首次成功计算后回写。
 */
async function loadAnalysisConfig() {
  try {
    const raw = await fsp.readFile(path.join(ROOT, "config.json"), "utf8");
    return JSON.parse(raw)?.analysis ?? {};
  } catch {
    return {};
  }
}

async function saveAnalysisConfig(patch) {
  try {
    let cur = {};
    try {
      cur = JSON.parse(await fsp.readFile(path.join(ROOT, "config.json"), "utf8"));
    } catch {
      /* 无文件 → 新建 */
    }
    cur.analysis = { ...(cur.analysis ?? {}), ...patch };
    const file = path.join(ROOT, "config.json");
    const tmp = `${file}.tmp-${process.pid}`;
    await fsp.writeFile(tmp, JSON.stringify(cur, null, 2), "utf8");
    await fsp.rename(tmp, file);
  } catch (e) {
    console.warn(`[credit] 写 analysis 配置失败：${String(e)}`);
  }
}

const ANALYSIS_CFG = await loadAnalysisConfig();
const WORKSPACE_DIR = process.env.CREDIT_WORKSPACE ?? ANALYSIS_CFG.workspaceDir ?? "";
const PR_COMMIT = process.env.CREDIT_PR_COMMIT ?? ANALYSIS_CFG.prCommit ?? "HEAD";

console.log(
  `[credit] analysis: workspace=${WORKSPACE_DIR || "(未配置)"} commit=${PR_COMMIT}` +
    (WORKSPACE_DIR ? "" : " → git 不可用，相关指标将降级"),
);

/** 真实 git 实现的 GitPort；git 不可用 / 非仓库时返回 available:false（绝不伪造） */
const gitPort = {
  async diff() {
    if (!WORKSPACE_DIR) return { available: false, files: null, commitCount: 0, reason: "未配置 CREDIT_WORKSPACE" };
    try {
      const base = process.env.CREDIT_PR_BASE || `${PR_COMMIT}^`;
      const [patch, countOut] = await Promise.all([
        git(["diff", "-U0", "--no-color", base, PR_COMMIT], WORKSPACE_DIR),
        git(["rev-list", "--count", `${base}..${PR_COMMIT}`], WORKSPACE_DIR),
      ]);
      const files = parseUnifiedDiff(patch).map((f) => ({
        uri: f.uri,
        added: f.totalAdded,
        deleted: f.totalDeleted,
        addedLines: f.addedLines,
        addedTexts: f.addedTexts,
      }));
      return {
        available: true,
        files,
        commitCount: Number(String(countOut).trim()) || 0,
        base,
        head: PR_COMMIT,
      };
    } catch (e) {
      console.warn(`[credit] git diff 失败：${String(e?.message ?? e)}`);
      return { available: false, files: null, commitCount: 0 };
    }
  },
  async commitCount() {
    const d = await gitPort.diff();
    return d.commitCount;
  },
};

/** FsPort：读 SPEC / 测试文件内容（C3/C7 需要行内容做分析） */
const fsPort = {
  async readFile(uri) {
    try {
      return await fsp.readFile(uri, "utf8");
    } catch {
      // behaviors 里的 uri 可能是相对路径，尝试基于工作区解析
      if (!WORKSPACE_DIR) return null;
      try {
        return await fsp.readFile(path.join(WORKSPACE_DIR, uri), "utf8");
      } catch {
        return null;
      }
    }
  },
};

async function readBehaviors(prId) {
  const file = path.join(ROOT, "behaviors", `${prId}.jsonl`);
  const text = await fsp.readFile(file, "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
}

const prApi = {
  /** 历史 PR 列表（按 behaviors 文件 mtime 倒序） */
  async list() {
    const dir = path.join(ROOT, "behaviors");
    let files = [];
    try {
      files = (await fsp.readdir(dir)).filter((f) => f.endsWith(".jsonl"));
    } catch {
      return { ok: true, items: [] };
    }
    const items = [];
    for (const f of files) {
      const prId = f.replace(/\.jsonl$/, "");
      const st = await fsp.stat(path.join(dir, f));
      let count = 0;
      try {
        const text = await fsp.readFile(path.join(dir, f), "utf8");
        count = text.split("\n").filter(Boolean).length;
      } catch {
        /* ignore */
      }
      items.push({ prId, size: st.size, mtimeMs: st.mtimeMs, behaviorCount: count });
    }
    items.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return { ok: true, items };
  },

  /** 过程建模结果：命中 tasks/<prId>.json 缓存则直接返回，否则计算并落盘 */
  async graph(prId, query) {
    if (!prId) return { ok: false, error: "missing prId" };
    const cacheFile = path.join(ROOT, "tasks", `${prId}.json`);
    const force = query?.get("force") === "1";

    if (!force) {
      try {
        const cached = JSON.parse(await fsp.readFile(cacheFile, "utf8"));
        return { ok: true, graph: cached, cached: true, analytics: analyticRegistry.runAll(cached, []) };
      } catch {
        /* 无缓存 → 计算 */
      }
    }

    const behaviors = await readBehaviors(prId);
    if (behaviors.length === 0) return { ok: false, error: "no behaviors for this prId" };

    const llm = await getLlmPort();
    const llmCfg = await loadLlmConfig();
    const graph = await buildTaskGraph({
      prId,
      behaviors,
      llm,
      llmModel: llmCfg.provider === "openai-compatible" ? llmCfg.openaiCompatible.model : null,
    });

    try {
      await fsp.mkdir(path.join(ROOT, "tasks"), { recursive: true });
      const tmp = `${cacheFile}.tmp-${process.pid}`;
      await fsp.writeFile(tmp, JSON.stringify(graph, null, 2), "utf8");
      await fsp.rename(tmp, cacheFile);
    } catch (e) {
      console.warn(`[credit] 写 tasks 缓存失败：${String(e)}`);
    }

    return {
      ok: true,
      graph,
      cached: false,
      analytics: analyticRegistry.runAll(graph, behaviors),
    };
  },

  /**
   * P2：指标计算 —— **计算时机在 Task 之后**（先取 TaskGraph，再算 credit）。
   * 落盘 `pr_credit/<prId>.json`；输入指纹未变则直接读盘。
   */
  async credit(prId, query) {
    if (!prId) return { ok: false, error: "missing prId" };
    const cacheFile = path.join(ROOT, "pr_credit", `${prId}.json`);
    const force = query?.get("force") === "1";

    const behaviors = await readBehaviors(prId);
    if (behaviors.length === 0) return { ok: false, error: "no behaviors for this prId" };

    // —— 依赖 TaskGraph：不得绕过 Task 直接算指标 ——
    // 注意是 `prApi.graph`（PR 域），不是 `api`（Control 域）；
    // 且**不传 force** —— credit 的重算不该连带重算 Task。
    const g = await prApi.graph(prId, null);
    if (!g.ok) return g;

    const gitDiff = await gitPort.diff();
    // P3：画像参与指纹 —— 初始化/同步后指纹变，旧缓存（无 Dev_Credit）自动失效
    const profile = await readProfile();
    const fp = inputFingerprint({ behaviors, taskGraph: g.graph, gitDiff, profile, prId });

    /**
     * 缓存未命中原因 —— **必须透出给 UI**。
     * 否则用户只看到笼统的"正在计算…"，不知道其实是"git 没配好导致指纹变了"这种
     * 本可避免的重算（重算 = 8 次 LLM ≈ 8 分钟）。
     */
    let cacheMiss = null;
    if (!force) {
      try {
        const cached = JSON.parse(await fsp.readFile(cacheFile, "utf8"));
        if (cached?.generator?.inputFingerprint === fp) {
          return { ok: true, result: cached, cached: true };
        }
        cacheMiss = "输入已变化（行为数 / Task / git 摘要与上次不一致），需重新计算";
      } catch {
        cacheMiss = null; // 无缓存文件 → 首次计算，属正常
      }
    }

    // git 可用即回写配置：下次启动不依赖环境变量也能命中缓存
    if (gitDiff.available && WORKSPACE_DIR) {
      await saveAnalysisConfig({ workspaceDir: WORKSPACE_DIR, prCommit: PR_COMMIT });
    }

    const llm = await getLlmPort();
    const llmCfg = await loadLlmConfig();
    const result = await computeCredit({
      prId,
      behaviors,
      taskGraph: g.graph,
      llm,
      gitDiff,
      git: gitPort,
      fs: fsPort,
      profile,
      llmModel: llmCfg.provider === "openai-compatible" ? llmCfg.openaiCompatible.model : null,
    });

    try {
      await fsp.mkdir(path.join(ROOT, "pr_credit"), { recursive: true });
      const tmp = `${cacheFile}.tmp-${process.pid}`;
      await fsp.writeFile(tmp, JSON.stringify(result, null, 2), "utf8");
      await fsp.rename(tmp, cacheFile);
    } catch (e) {
      console.warn(`[credit] 写 pr_credit 失败：${String(e)}`);
    }

    // P3：结算后自动本地增量更新画像（触发A；best-effort，不影响 credit 返回）
    if (profile && !force) {
      try {
        const up = await profileApi.updateFromPr(prId);
        console.log(`[credit] profile 增量更新：${up.reason ?? "?"}（keywords=${up.keywords?.length ?? 0}）`);
      } catch (e) {
        console.warn(`[credit] profile 增量更新失败（可手动 /api/profile/updateFromPr?prId= 重试）：${String(e?.message ?? e)}`);
      }
    }

    return { ok: true, result, cached: false, cacheMiss };
  },

  /** 指标树结构（UI 渲染顺序与 i18n 名） */
  async rules() {
    return { ok: true, ruleSet: RULESET };
  },
  /** 按需拉取指定 Behavior 明细（点击 Task 展开时用，避免全量传输） */
  async behaviors(prId, query) {
    const ids = new Set((query?.get("ids") ?? "").split(",").filter(Boolean));
    const all = await readBehaviors(prId);
    return { ok: true, items: ids.size > 0 ? all.filter((b) => ids.has(b.id)) : all };
  },
};

// ─────────────── P3：画像层（Developer Profile，决策 D-033~D-037 / D-305）───────────────

const PROFILE_FILE = path.join(ROOT, "dev_profile.json");
const DRAFT_FILE = path.join(ROOT, "dev_profile.draft.json");

async function readJsonSafe(file) {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmp, file);
}

async function readProfile() {
  const p = normalizeProfile(await readJsonSafe(PROFILE_FILE));
  return p; // null = 未初始化
}

/** GITHUB_TOKEN 只从环境取（D-035：不落盘、不进日志、不进 prompt） */
const GH_TOKEN = process.env.GITHUB_TOKEN ?? null;
/** 注入式 fetch（bypass 纯逻辑可单测，宿主负责真网络） */
const ghFetchLike = (url, init) => fetch(url, init);

const profileApi = {
  /** 概览：正式画像 + 草稿 + 初始化状态 */
  async get() {
    const profile = await readProfile();
    const draft = await readJsonSafe(DRAFT_FILE);
    return {
      ok: true,
      initialized: isInitialized(profile),
      profile,
      draft: draft ?? null,
      hasGithubToken: !!GH_TOKEN,
    };
  },

  /** F3a 初始化：拉取 + 归纳 → 写草稿（D-036），不落正式文件 */
  async init(body) {
    const homeUrl = String(body?.homeUrl ?? "").trim();
    if (!homeUrl) return { ok: false, error: "缺少 homeUrl" };
    const llm = await getLlmPort();
    const out = await initProfileFromGit({ homeUrl, token: GH_TOKEN, fetchLike: ghFetchLike, llm });
    if (!out.ok) return { ok: false, error: out.error };
    await writeJsonAtomic(DRAFT_FILE, out.draft);
    return {
      ok: true,
      digestChars: out.digestChars,
      requests: out.requests,
      keywords: out.draft.profile.techDomain.keywords.map((k) => `${k.name}(${k.gitCommits})`),
      gitStats: out.draft.profile.gitStats,
    };
  },

  /** 草稿确认：可携编辑后的 profile 覆盖 → 写正式文件、删草稿 */
  async confirm(body) {
    const draft = await readJsonSafe(DRAFT_FILE);
    if (!draft?.profile) return { ok: false, error: "无待确认草稿" };
    const p = normalizeProfile(body?.profile ?? draft.profile);
    if (!p) return { ok: false, error: "草稿数据不合法" };
    if (!isInitialized(p)) return { ok: false, error: "草稿为空画像，拒绝确认" };
    await writeJsonAtomic(PROFILE_FILE, p);
    try {
      await fsp.unlink(DRAFT_FILE);
    } catch {
      /* 已不存在 */
    }
    return { ok: true, gitUser: p.gitUser, keywords: p.techDomain.keywords.length };
  },

  /** 放弃草稿 */
  async discardDraft() {
    try {
      await fsp.unlink(DRAFT_FILE);
      return { ok: true };
    } catch {
      return { ok: true, note: "无草稿" };
    }
  },

  /** F3b 增量同步（D-037）：游标增量拉取 → 直接合并落盘；失败游标不推进 */
  async sync() {
    const profile = await readProfile();
    if (!profile) return { ok: false, error: "尚未初始化画像" };
    const llm = await getLlmPort();
    const out = await syncProfileFromGit({ profile, token: GH_TOKEN, fetchLike: ghFetchLike, llm });
    if (!out.ok) return { ok: false, error: out.error };
    await writeJsonAtomic(PROFILE_FILE, out.profile);
    return {
      ok: true,
      changes: out.changes,
      digestChars: out.digestChars,
      requests: out.requests,
      gitStats: out.profile.gitStats,
    };
  },

  /** F2 本地增量更新（D-305：与重算解耦，可单独触发调试） */
  async updateFromPr(prId) {
    if (!prId) return { ok: false, error: "missing prId" };
    const profile = await readProfile();
    if (!profile) return { ok: false, error: "尚未初始化画像" };

    const result = await readJsonSafe(path.join(ROOT, "pr_credit", `${prId}.json`));
    if (!result) return { ok: false, error: `无 pr_credit 结果：${prId}` };

    // D-306：优先消费计算期共享提取的关键词；旧结果缺失时补提（1 次 LLM）
    let keywords = result.profileFeed?.profileKeywords ?? null;
    let keywordSource = "pr_credit.profileFeed";
    if (!keywords || keywords.length === 0) {
      const g = await prApi.graph(prId, null);
      if (!g.ok) return { ok: false, error: `补提关键词需要 TaskGraph：${g.error}` };
      const llm = await getLlmPort();
      const r = await extractPrKeywords({ tasks: g.graph.tasks, gitDiff: await gitPort.diff(), llm });
      keywords = r.keywords;
      keywordSource = `补提（${r.ok ? "LLM" : "规则降级"}）`;
    }

    const out = applyPrResult(profile, {
      prId,
      ts: result.generatedAt ?? Date.now(),
      repo: WORKSPACE_DIR ? path.basename(WORKSPACE_DIR) : undefined,
      prCredit: result.summary?.prCredit ?? 0,
      creditFingerprint: result.generator?.inputFingerprint,
      feed: { profileKeywords: keywords, aiCollabLines: result.profileFeed?.aiCollabLines ?? 0 },
      keywords,
    });

    if (out.changed) await writeJsonAtomic(PROFILE_FILE, out.profile);
    return {
      ok: true,
      reason: out.reason,
      changed: out.changed,
      keywordSource,
      keywords,
      aiCollabLines: result.profileFeed?.aiCollabLines ?? 0,
    };
  },

  /** 手动编辑：增删关键词（其余字段只能走初始化/同步/本地增量） */
  async edit(body) {
    const profile = await readProfile();
    if (!profile) return { ok: false, error: "尚未初始化画像" };
    const add = Array.isArray(body?.addKeywords) ? body.addKeywords : [];
    const remove = new Set((Array.isArray(body?.removeKeywords) ? body.removeKeywords : []).map((s) => String(s).toLowerCase()));
    if (add.length === 0 && remove.size === 0) return { ok: false, error: "无编辑内容" };

    ensureKeywordEntries(profile, add, "local");
    profile.techDomain.keywords = profile.techDomain.keywords.filter((k) => !remove.has(k.name.toLowerCase()));
    profile.updatedAt = new Date().toISOString();
    await writeJsonAtomic(PROFILE_FILE, profile);
    return { ok: true, keywords: profile.techDomain.keywords.length };
  },
};

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  let pathname = "/";
  try {
    pathname = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;
  } catch {
    /* ignore */
  }
  try {
    // 浏览器默认请求，无需资源 → 直接空响应，避免控制台 404 噪声
    if (pathname === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }
    if (pathname.startsWith("/api/credit/")) {
      const action = pathname.replace("/api/credit/", "");
      const fn = api[action];
      if (typeof fn !== "function") return json(res, 404, { ok: false, error: `unknown action: ${action}` });
      return json(res, 200, await fn());
    }

    // P2：指标树结构（UI 渲染顺序与 i18n 名）
    if (pathname === "/api/rules/tree") {
      return json(res, 200, await prApi.rules());
    }

    // P3：画像层 API —— /api/profile/<action>（GET 读，POST 带操作）
    if (pathname.startsWith("/api/profile/")) {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const action = pathname.replace("/api/profile/", "").split("/")[0];
      let body = {};
      if (req.method === "POST") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
          return json(res, 400, { ok: false, error: "invalid json body" });
        }
      }
      const fn = profileApi[action];
      if (typeof fn !== "function") {
        return json(res, 404, { ok: false, error: `unknown profile action: ${action}` });
      }
      // updateFromPr 支持 GET query ?prId=
      const out = await fn(action === "updateFromPr" ? body.prId ?? url.searchParams.get("prId") : body);
      return json(res, out?.ok === false ? 400 : 200, out);
    }

    // P2-pre：过程建模 API —— /api/pr/<prId>/graph | /behaviors | /credit，列表为 /api/pr/list
    if (pathname.startsWith("/api/pr/")) {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const rest = pathname.replace("/api/pr/", "");
      if (rest === "list") return json(res, 200, await prApi.list());
      const seg = rest.split("/").filter(Boolean).map(decodeURIComponent);
      const [prId, action = "graph"] = seg;
      const fn = prApi[action];
      if (typeof fn !== "function") {
        return json(res, 404, { ok: false, error: `unknown pr action: ${action}` });
      }
      const out = await fn(prId, url.searchParams);
      return json(res, out.ok ? 200 : 400, out);
    }

    // 静态文件（index.html / style.css / ui.js / ui/*.js）—— 限制在应用目录内
    const staticPath = pathname === "/" || pathname === "/index.html" ? "/index.html" : pathname;
    if (/^\/(?:index\.html|ui\/[\w-]+\.js|[\w-]+\.(?:css|js))$/.test(staticPath)) {
      const abs = path.join(HERE, staticPath);
      if (!abs.startsWith(HERE)) return json(res, 403, { ok: false, error: "forbidden" });
      try {
        const body = await fsp.readFile(abs, "utf8");
        const type = staticPath.endsWith(".css")
          ? "text/css"
          : staticPath.endsWith(".js")
            ? "text/javascript"
            : "text/html";
        res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
        return res.end(body);
      } catch {
        /* 落到 404 */
      }
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("not found");
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const r = lastRecover;
  console.log(`[credit] miniapp prototype: http://127.0.0.1:${PORT}`);
  console.log(`[credit] data root: ${ROOT}`);
  console.log(`[credit] startup recover: action=${r.action}${r.prId ? ` prId=${r.prId}` : ""}`);
  if (r.action === "resume" || r.action === "rewind") {
    console.log(`[credit] 已自动接续上轮未提交记录（prId=${r.prId}）`);
  }
});
