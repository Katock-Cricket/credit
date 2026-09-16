/**
 * transport —— UI 模块的**唯一数据入口**（P4 · 决策 D-044）。
 *
 * 两种宿主实现，接口完全一致：
 * - `createAppTransport(app)`   → MiniApp 实机：`window.app.call(method, params)`
 *                                 （宿主路由 → `worker.js` 四域方法表，见架构 §5.6）
 * - `createFetchTransport(base)` → 原型本地调试：HTTP `fetch('/api/...')`
 *                                 （不启动 Bitfun 也能迭代 UI）
 *
 * **纪律**（架构 §3.5 / AGENTS §7）：
 * 1. UI 模块**禁止**直接访问 `window.app` 或 `fetch` —— 一律经本层；
 * 2. `call()` 失败一律抛 `TransportError`（含 method 与原因），调用方只需 try/catch；
 * 3. 原型宿主缺少的方法（M6 提交域）**显式报错**，不静默返回空值。
 */

/** 统一取数错误：`method` 标明是哪个方法失败，`cause` 保留原始异常 */
export class TransportError extends Error {
  constructor(method, message, cause) {
    super(`[${method}] ${message}`);
    this.name = "TransportError";
    this.method = method;
    this.reason = message;
    this.cause = cause;
  }
}

/**
 * Worker 方法 ↔ 原型 HTTP 端点映射（仅原型宿主需要）。
 * 返回 `{ httpMethod, path }`；未列出的方法在原型下不可用。
 */
const FETCH_ROUTES = {
  "credit.getStatus": () => ({ httpMethod: "GET", path: "/api/credit/status" }),
  "credit.start": () => ({ httpMethod: "POST", path: "/api/credit/start" }),
  "credit.finish": () => ({ httpMethod: "POST", path: "/api/credit/finish" }),
  "credit.reset": () => ({ httpMethod: "POST", path: "/api/credit/reset" }),

  "credit.listPrs": () => ({ httpMethod: "GET", path: "/api/pr/list" }),
  "credit.getTaskStageView": (p) => ({
    httpMethod: "GET",
    path: `/api/pr/${encodeURIComponent(p.prId)}/graph${p.force ? "?force=1" : ""}`,
  }),
  "credit.getBehaviors": (p) => ({
    httpMethod: "GET",
    path: `/api/pr/${encodeURIComponent(p.prId)}/behaviors${
      p.ids?.length ? `?ids=${encodeURIComponent(p.ids.join(","))}` : ""
    }`,
  }),
  "credit.compute": (p) => ({
    httpMethod: "GET",
    path: `/api/pr/${encodeURIComponent(p.prId)}/credit${p.force ? "?force=1" : ""}`,
  }),
  "credit.getRules": () => ({ httpMethod: "GET", path: "/api/rules/tree" }),

  "credit.getProfile": () => ({ httpMethod: "GET", path: "/api/profile/get" }),
  "credit.importProfileFromGit": () => ({ httpMethod: "POST", path: "/api/profile/init" }),
  "credit.confirmProfileDraft": () => ({ httpMethod: "POST", path: "/api/profile/confirm" }),
  "credit.discardProfileDraft": () => ({ httpMethod: "POST", path: "/api/profile/discardDraft" }),
  "credit.syncProfileFromGit": () => ({ httpMethod: "POST", path: "/api/profile/sync" }),
  "credit.updateProfileFromPr": (p) => ({
    httpMethod: "GET",
    path: `/api/profile/updateFromPr?prId=${encodeURIComponent(p.prId ?? "")}`,
  }),
  "credit.editProfile": () => ({ httpMethod: "POST", path: "/api/profile/edit" }),
};

/** POST 需要 JSON body 的方法（其余方法的 params 拼进 query 或忽略） */
const BODY_METHODS = new Set([
  "credit.start",
  "credit.finish",
  "credit.importProfileFromGit",
  "credit.confirmProfileDraft",
  "credit.editProfile",
]);

function normalizeResult(method, data) {
  if (data?.ok === false) throw new TransportError(method, data.error ?? "调用失败");
  return data;
}

/**
 * 需要 `workspaceDir` 的方法。
 *
 * **为什么由 transport 注入**：Worker 进程拿不到 `app.workspaceDir`（那是 iframe 侧 Bridge 的
 * 属性，Worker 只有 cwd = MiniApp 应用目录），但 git 操作必须在工作区里执行。
 * 故由持有 `app` 的 iframe 侧统一补参，UI 模块无需关心（架构 §3.6 GitService）。
 */
const NEED_WORKSPACE = new Set([
  "credit.compute",
  "credit.getChangedFiles",
  "credit.commitAndPush",
  "credit.push",
]);

/** MiniApp 实机宿主 */
export function createAppTransport(app) {
  return {
    kind: "app",
    async call(method, params) {
      if (typeof app?.call !== "function") {
        throw new TransportError(method, "宿主 app.call 不可用（需 node.enabled=true）");
      }
      let payload = params ?? {};
      if (NEED_WORKSPACE.has(method) && payload.workspaceDir === undefined) {
        payload = { ...payload, workspaceDir: app.workspaceDir ?? null };
      }
      let data;
      try {
        data = await app.call(method, payload);
      } catch (e) {
        throw new TransportError(method, e?.message ?? String(e), e);
      }
      return normalizeResult(method, data);
    },
    /** Worker → iframe 推送事件；返回取消订阅函数 */
    on(event, fn) {
      if (typeof app?.on !== "function") return () => {};
      app.on(event, fn);
      return () => app.off?.(event, fn);
    },
    /** 计算进度流（`credit:progress`）*/
    onProgress(fn) {
      return this.on("worker:credit:progress", fn);
    },
  };
}

/** 原型本地调试宿主（不启动 Bitfun 亦可迭代 UI） */
export function createFetchTransport(baseUrl = "") {
  return {
    kind: "fetch",
    async call(method, params = {}) {
      const route = FETCH_ROUTES[method];
      if (!route) {
        throw new TransportError(method, "原型宿主不支持该方法（仅 MiniApp 可用）");
      }
      const { httpMethod, path } = route(params);
      const init = { method: httpMethod, headers: { "content-type": "application/json" } };
      if (BODY_METHODS.has(method)) init.body = JSON.stringify(params ?? {});

      let res;
      try {
        res = await fetch(baseUrl + path, init);
      } catch (e) {
        throw new TransportError(method, `网络请求失败：${e?.message ?? String(e)}`, e);
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new TransportError(method, data?.error ?? `HTTP ${res.status}`);
      }
      return normalizeResult(method, data);
    },
    onProgress() {
      return () => {};
    },
  };
}

/**
 * 自动择宿主：有 `app.call` 用实机，否则退回原型 HTTP。
 * `opts.app` / `opts.fetchBase` 可显式注入（测试用）。
 */
export function createTransport(opts = {}) {
  const app = opts.app ?? (typeof window !== "undefined" ? window.app : undefined);
  if (app && typeof app.call === "function") return createAppTransport(app);
  if (opts.fetchBase !== undefined || typeof window !== "undefined") {
    return createFetchTransport(opts.fetchBase ?? "");
  }
  throw new TransportError("transport", "未找到可用宿主（app.call / fetch 均不可用）");
}
