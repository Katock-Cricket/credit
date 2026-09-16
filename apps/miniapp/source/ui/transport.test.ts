import { describe, it, expect, vi } from "vitest";
import {
  TransportError,
  createAppTransport,
  createFetchTransport,
  createTransport,
} from "./transport.js";

/** 最小 fetch 桩：记录调用并按队列返回响应 */
function mockFetch(responses: Array<{ status?: number; body: unknown }> = []) {
  const calls: Array<{ url: string; init: any }> = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init: any) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)] ?? { status: 200, body: { ok: true } };
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => r.body,
    };
  });
  globalThis.fetch = fn as never;
  return { calls, fn };
}

describe("createAppTransport（MiniApp 实机）", () => {
  it("透传 method/params 并返回宿主结果", async () => {
    const app = { call: vi.fn(async () => ({ ok: true, value: 42 })) };
    const tp = createAppTransport(app as never);
    const out = await tp.call("credit.getStatus", { a: 1 });
    expect(out).toEqual({ ok: true, value: 42 });
    expect(app.call).toHaveBeenCalledWith("credit.getStatus", { a: 1 });
    expect(tp.kind).toBe("app");
  });

  it("宿主缺 app.call → TransportError（含方法名）", async () => {
    const tp = createAppTransport({} as never);
    await expect(tp.call("credit.start")).rejects.toBeInstanceOf(TransportError);
    await expect(tp.call("credit.start")).rejects.toThrow(/credit\.start/);
  });

  it("宿主抛错 → 包装为 TransportError 并保留 cause", async () => {
    const boom = new Error("boom");
    const app = { call: async () => { throw boom; } };
    const tp = createAppTransport(app as never);
    const err = await tp.call("credit.compute", { prId: "p" }).catch((e) => e);
    expect(err).toBeInstanceOf(TransportError);
    expect(err.reason).toBe("boom");
    expect(err.cause).toBe(boom);
  });

  it("结果为 {ok:false} → 抛 TransportError（不静默返回）", async () => {
    const app = { call: async () => ({ ok: false, error: "no behaviors" }) };
    const tp = createAppTransport(app as never);
    await expect(tp.call("credit.compute", { prId: "p" })).rejects.toThrow(/no behaviors/);
  });

  it("需要 workspace 的方法自动注入 workspaceDir（Worker 拿不到 app.workspaceDir）", async () => {
    const app = {
      workspaceDir: "D:/proj",
      call: vi.fn(async () => ({ ok: true })),
    };
    const tp = createAppTransport(app as never);
    await tp.call("credit.compute", { prId: "p1" });
    expect(app.call).toHaveBeenCalledWith("credit.compute", {
      prId: "p1",
      workspaceDir: "D:/proj",
    });
    // 调用方显式给出的 workspaceDir 优先，不被覆盖
    await tp.call("credit.getChangedFiles", { workspaceDir: "D:/other" });
    expect(app.call).toHaveBeenLastCalledWith("credit.getChangedFiles", {
      workspaceDir: "D:/other",
    });
    // 非 workspace 方法不注入
    await tp.call("credit.getStatus");
    expect(app.call).toHaveBeenLastCalledWith("credit.getStatus", {});
  });

  it("onProgress 订阅/取消订阅", () => {
    const handlers: Record<string, (p: unknown) => void> = {};
    const off = vi.fn();
    const app = {
      on: (ev: string, fn: (p: unknown) => void) => (handlers[ev] = fn),
      off,
    };
    const tp = createAppTransport(app as never);
    const fn = vi.fn();
    const unsub = tp.onProgress(fn);
    // 宿主 Bridge 会把 Worker 的 rpcEmit('credit:progress') 前缀成 'worker:credit:progress'
    handlers["worker:credit:progress"]?.({ done: 1, total: 2 });
    expect(fn).toHaveBeenCalledWith({ done: 1, total: 2 });
    unsub();
    expect(off).toHaveBeenCalled();
  });
});

describe("createFetchTransport（原型本地调试）", () => {
  it("GET 映射：credit.getStatus → /api/credit/status", async () => {
    const { calls } = mockFetch([{ body: { ok: true } }]);
    await createFetchTransport().call("credit.getStatus");
    expect(calls[0]!.url).toBe("/api/credit/status");
    expect(calls[0]!.init.method).toBe("GET");
  });

  it("POST 映射：credit.start → JSON body", async () => {
    const { calls } = mockFetch([{ body: { ok: true } }]);
    await createFetchTransport().call("credit.start", { prId: "pr-1" });
    expect(calls[0]!.url).toBe("/api/credit/start");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.body).toBe(JSON.stringify({ prId: "pr-1" }));
  });

  it("路径参数 + force：credit.compute", async () => {
    const { calls } = mockFetch([{ body: { ok: true } }]);
    await createFetchTransport().call("credit.compute", { prId: "pr-9", force: true });
    expect(calls[0]!.url).toBe("/api/pr/pr-9/credit?force=1");
  });

  it("query 参数：credit.updateProfileFromPr / credit.getBehaviors", async () => {
    const { calls } = mockFetch([{ body: { ok: true } }, { body: { ok: true } }]);
    const tp = createFetchTransport();
    await tp.call("credit.updateProfileFromPr", { prId: "pr-3" });
    await tp.call("credit.getBehaviors", { prId: "pr-3", ids: ["b1", "b2"] });
    expect(calls[0]!.url).toBe("/api/profile/updateFromPr?prId=pr-3");
    expect(calls[1]!.url).toBe("/api/pr/pr-3/behaviors?ids=b1%2Cb2");
  });

  it("原型不支持的方法（M6 提交域）→ 显式报错", async () => {
    mockFetch([{ body: { ok: true } }]);
    await expect(createFetchTransport().call("credit.push")).rejects.toThrow(/原型宿主不支持/);
  });

  it("HTTP 4xx + {ok:false,error} → 抛 error 文本", async () => {
    mockFetch([{ status: 400, body: { ok: false, error: "尚未初始化画像" } }]);
    await expect(createFetchTransport().call("credit.getProfile")).rejects.toThrow(/尚未初始化画像/);
  });

  it("HTTP 200 但 {ok:false} → 同样抛错", async () => {
    mockFetch([{ status: 200, body: { ok: false, error: "bad" } }]);
    await expect(createFetchTransport().call("credit.listPrs")).rejects.toBeInstanceOf(TransportError);
  });

  it("网络异常 → TransportError（含原因）", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as never;
    await expect(createFetchTransport().call("credit.listPrs")).rejects.toThrow(/网络请求失败/);
  });
});

describe("createTransport 宿主择一", () => {
  it("有 app.call → 用实机宿主", () => {
    const tp = createTransport({ app: { call: async () => ({ ok: true }) } as never });
    expect(tp.kind).toBe("app");
  });

  it("无 app → 退回原型 HTTP 宿主", () => {
    const tp = createTransport({ app: undefined as never, fetchBase: "" });
    expect(tp.kind).toBe("fetch");
  });
});
