/**
 * LLM 接入层测试（P2-pre T0，决策 D-023）。
 *
 * 覆盖 SPEC §10.5 用例清单：三 Provider 行为、缓存、重试与降级、schema 校验。
 * **全部离线**：`openai-compatible` 用注入的 fetch 替身，不发起真实网络请求、不消耗 token。
 */
import { describe, it, expect, vi } from "vitest";
import {
  createNullLlmPort,
  createMockLlmPort,
  createOpenAILlmPort,
  createBitfunLlmPort,
  createMemoryCache,
  hashInput,
  validateJson,
  readApiKey,
  makeCacheKey,
  DEFAULT_LLM_CONFIG,
  type LlmCallSpec,
  type FetchLike,
} from "./index.js";

const spec = (over: Partial<LlmCallSpec> = {}): LlmCallSpec => ({
  metricId: "task-desc",
  templateId: "task-desc-v1",
  system: "你是助手",
  user: "请归纳",
  input: { tasks: [{ id: "T1" }] },
  schema: { type: "object", required: ["tasks"] },
  ...over,
});

// ───────────────────────── hash / schema / key ─────────────────────────

describe("工具函数", () => {
  it("hashInput：同语义输入（key 顺序不同）得到相同 hash", () => {
    expect(hashInput({ a: 1, b: 2 })).toBe(hashInput({ b: 2, a: 1 }));
    expect(hashInput({ a: 1 })).not.toBe(hashInput({ a: 2 }));
  });

  it("readApiKey：只从环境变量取，缺失/空白返回 null", () => {
    expect(readApiKey("K", { K: "sk-1" })).toBe("sk-1");
    expect(readApiKey("K", { K: "  sk-2  " })).toBe("sk-2");
    expect(readApiKey("K", { K: "   " })).toBeNull();
    expect(readApiKey("K", {})).toBeNull();
  });

  it("makeCacheKey：templateId / model / input 变化即换键", () => {
    const a = makeCacheKey(spec(), "m1");
    const b = makeCacheKey(spec({ templateId: "task-desc-v2" }), "m1");
    const c = makeCacheKey(spec(), "m2");
    const d = makeCacheKey(spec({ input: { tasks: [{ id: "T2" }] } }), "m1");
    expect(new Set([a, b, c, d]).size).toBe(4);
    expect(makeCacheKey(spec(), "m1")).toBe(a);
  });

  it("validateJson：顶层 type 与 required 校验", () => {
    expect(validateJson({ a: 1 }, { type: "object", required: ["a"] })).toBeNull();
    expect(validateJson({ a: 1 }, { type: "object", required: ["b"] })).toMatch(/缺少字段：b/);
    expect(validateJson([], { type: "object" })).toMatch(/期望 object/);
    expect(validateJson({}, { type: "array" })).toMatch(/期望 array/);
  });
});

// ───────────────────────── NullLlmPort ─────────────────────────

describe("NullLlmPort", () => {
  it("恒不可用，complete 返回 unavailable 且**不抛异常**", async () => {
    const p = createNullLlmPort();
    expect(p.id).toBe("null");
    await expect(p.isAvailable()).resolves.toBe(false);
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unavailable");
  });
});

// ───────────────────────── MockLlmPort ─────────────────────────

describe("MockLlmPort（三模式）", () => {
  it("模式 1：合法 JSON 正常返回，并记录调用", async () => {
    const p = createMockLlmPort({
      responses: { "task-desc-v1": { tasks: [{ id: "T1", desc: "x" }] } },
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.json as { tasks: unknown[] }).tasks).toHaveLength(1);
    expect(p.calls).toHaveLength(1);
    p.reset();
    expect(p.calls).toHaveLength(0);
  });

  it("模式 2：非法 JSON → invalid-json", async () => {
    const p = createMockLlmPort({
      responses: { "task-desc-v1": new Error("模型输出非合法 JSON") },
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-json");
  });

  it("模式 3：超时 → timeout", async () => {
    const p = createMockLlmPort({
      responses: { "task-desc-v1": new Error("request timed out") },
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("timeout");
  });

  it("未注册 templateId → error（不静默成功）", async () => {
    const p = createMockLlmPort({ responses: {}, available: true });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("error");
  });

  it("未启用（available=false）→ unavailable", async () => {
    const p = createMockLlmPort({
      responses: { "task-desc-v1": { tasks: [] } },
      available: false,
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unavailable");
  });

  it("响应不合规 → schema", async () => {
    const p = createMockLlmPort({ responses: { "task-desc-v1": { foo: 1 } } });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("schema");
  });
});

// ───────────────────────── OpenAILlmPort ─────────────────────────

/** 构造一个成功的 OpenAI 风格响应 */
function okResponse(content: unknown): FetchLike {
  return (async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  })) as unknown as FetchLike;
}

describe("OpenAILlmPort", () => {
  const env = { OPENAI_API_KEY: "sk-test" };

  it("无密钥 → unavailable（不发起请求）", async () => {
    const fetchImpl = vi.fn() as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1",
      model: "m",
      env: {},
      fetchImpl,
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unavailable");
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it("正常路径：请求体结构正确，返回解析后的 JSON", async () => {
    const fetchImpl = vi.fn(okResponse({ tasks: [{ id: "T1", desc: "d" }] })) as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1/",
      model: "deepseek-v4-flash",
      env,
      fetchImpl,
    });
    await expect(p.isAvailable()).resolves.toBe(true);
    const r = await p.complete(spec());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cached).toBe(false);
      expect(r.model).toBe("deepseek-v4-flash");
      expect((r.json as { tasks: unknown[] }).tasks).toHaveLength(1);
    }

    // 校验请求体
    const call = (fetchImpl as unknown as { mock: { calls: Array<[string, { body: string; headers: Record<string, string> }]> } }).mock.calls[0];
    expect(call?.[0]).toBe("https://example.com/v1/chat/completions"); // 末尾斜杠已归一
    expect(call?.[1].headers.authorization).toBe("Bearer sk-test");
    const body = JSON.parse(call?.[1].body ?? "{}");
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    // 请求体**不得**含密钥以外的敏感信息；且密钥只出现在 header
    expect(call?.[1].body).not.toContain("sk-test");
  });

  it("缓存：同输入二次调用命中缓存且不发起网络请求", async () => {
    const fetchImpl = vi.fn(okResponse({ tasks: [] })) as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1",
      model: "m",
      env,
      fetchImpl,
      cache: createMemoryCache(),
    });
    const a = await p.complete(spec());
    const b = await p.complete(spec());
    expect(a.ok && b.ok).toBe(true);
    if (b.ok) expect(b.cached).toBe(true);
    expect(
      (fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls,
    ).toHaveLength(1); // 只发了一次

    // 输入变化 → 不命中
    await p.complete(spec({ input: { tasks: [{ id: "T9" }] } }));
    expect(
      (fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls,
    ).toHaveLength(2);
  });

  it("模型输出非 JSON → invalid-json（重试后仍失败）", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: "不是 JSON" } }] }),
    })) as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1",
      model: "m",
      env,
      fetchImpl,
      retry: 1,
      sleep: async () => {},
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-json");
    // 首次 + 1 次重试
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });

  it("schema 校验失败 → schema", async () => {
    const fetchImpl = vi.fn(okResponse({ wrong: 1 })) as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1",
      model: "m",
      env,
      fetchImpl,
      retry: 0,
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("schema");
  });

  it("5xx → timeout 且可重试；2 次失败后返回最后一次原因", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "server error",
    })) as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1",
      model: "m",
      env,
      fetchImpl,
      retry: 1,
      sleep: async () => {},
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("timeout");
      expect(r.message).toMatch(/HTTP 500/);
    }
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });

  it("4xx（非 429）→ error 且**不重试**", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    })) as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1",
      model: "m",
      env,
      fetchImpl,
      retry: 2,
      sleep: async () => {},
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("error");
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
  });

  it("AbortError（超时）→ timeout", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const fetchImpl = vi.fn(async () => {
      throw err;
    }) as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1",
      model: "m",
      env,
      fetchImpl,
      retry: 0,
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("timeout");
  });

  it("运行环境无 fetch → unavailable（不抛异常）", async () => {
    const g = globalThis as { fetch?: unknown };
    const original = g.fetch;
    delete g.fetch; // fetchImpl 缺省时会回落 globalThis.fetch —— 连它也没有才算不可用
    try {
      const p = createOpenAILlmPort({
        baseUrl: "https://example.com/v1",
        model: "m",
        env,
      });
      const r = await p.complete(spec());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("unavailable");
    } finally {
      g.fetch = original;
    }
  });

  it("```json 围栏包裹的输出也能正确解析", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: '```json\n{"tasks":[]}\n```' } }],
        }),
    })) as unknown as FetchLike;
    const p = createOpenAILlmPort({
      baseUrl: "https://example.com/v1",
      model: "m",
      env,
      fetchImpl,
      retry: 0,
    });
    const r = await p.complete(spec());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.json).toEqual({ tasks: [] });
  });

  it("默认配置指向用户给定的外部 LLM（D-023）", () => {
    expect(DEFAULT_LLM_CONFIG.provider).toBe("openai-compatible");
    expect(DEFAULT_LLM_CONFIG.openaiCompatible.baseUrl).toBe(
      "https://api.chatanywhere.tech/v1",
    );
    expect(DEFAULT_LLM_CONFIG.openaiCompatible.model).toBe("deepseek-v4-flash");
    expect(DEFAULT_LLM_CONFIG.openaiCompatible.apiKeyEnv).toBe("OPENAI_API_KEY");
  });
});

// ───────────────────────── BitfunLlmPort（P4 口子） ─────────────────────────

describe("BitfunLlmPort", () => {
  it("未注入 app.ai → unavailable（P4 前预期）", async () => {
    const p = createBitfunLlmPort({ ai: null });
    await expect(p.isAvailable()).resolves.toBe(false);
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unavailable");
  });

  it("注入后走宿主通道并校验 schema；首个模型失败则降级 fallbackModel", async () => {
    const ai = {
      complete: vi.fn(async (_o: { model?: string }) => ({ text: JSON.stringify({ tasks: [] }) })),
    };
    const p = createBitfunLlmPort({ ai, model: "fast", fallbackModel: "primary" });
    const r = await p.complete(spec());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model).toBe("fast");
  });

  it("宿主返回非法 JSON → 降级到 fallback；仍失败则返回 error 不抛异常", async () => {
    const ai = {
      complete: vi.fn(async () => ({ text: "not json" })),
    };
    const p = createBitfunLlmPort({ ai, model: "fast", fallbackModel: "primary" });
    const r = await p.complete(spec());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("error");
    expect(ai.complete).toHaveBeenCalledTimes(2); // fast + primary
  });
});
