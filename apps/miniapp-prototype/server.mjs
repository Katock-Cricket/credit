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
 */
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createBridge } from "@credit/core";

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
    if (pathname.startsWith("/api/credit/")) {
      const action = pathname.replace("/api/credit/", "");
      const fn = api[action];
      if (typeof fn !== "function") return json(res, 404, { ok: false, error: `unknown action: ${action}` });
      return json(res, 200, await fn());
    }
    if (pathname === "/" || pathname === "/index.html") {
      const html = await fsp.readFile(path.join(HERE, "index.html"), "utf8");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
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
