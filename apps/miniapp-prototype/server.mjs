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
  createDefaultAnalyticRegistry,
  createOpenAILlmPort,
  createNullLlmPort,
  createMemoryCache,
  DEFAULT_LLM_CONFIG,
} from "@credit/analyzer";

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

  /** 按需拉取指定 Behavior 明细（点击 Task 展开时用，避免全量传输） */
  async behaviors(prId, query) {
    const ids = new Set((query?.get("ids") ?? "").split(",").filter(Boolean));
    const all = await readBehaviors(prId);
    return { ok: true, items: ids.size > 0 ? all.filter((b) => ids.has(b.id)) : all };
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

    // P2-pre：过程建模 API —— /api/pr/<prId>/graph | /behaviors，列表为 /api/pr/list
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
