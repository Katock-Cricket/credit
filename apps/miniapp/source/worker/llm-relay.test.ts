import { describe, it, expect, vi, afterEach } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const relay = require("./llm-relay.js") as {
  createRelayAi: (o?: { timeoutMs?: number }) => {
    complete: (o: { system: string; user: string; model?: string }) => Promise<{ text: string }>;
  };
  resolveLlm: (p: { id: string; text?: string; error?: string }) => { ok: boolean; error?: string };
  setEmitter: (fn: ((event: string, data: unknown) => void) | null) => void;
  pendingCount: () => number;
  aiEventName: string;
  aiResultMethod: string;
};

/** 捕获 Worker → iframe 的推送 */
function capture() {
  const sent: Array<{ event: string; data: any }> = [];
  relay.setEmitter((event, data) => sent.push({ event, data: data as any }));
  return sent;
}

afterEach(() => {
  relay.setEmitter(null);
});

describe("LLM 中继（D-051：Worker ⇄ iframe 往返）", () => {
  it("complete 推送 credit:llm 事件并携带 id/system/user/model", async () => {
    const sent = capture();
    const ai = relay.createRelayAi();
    const p = ai.complete({ system: "S", user: "U", model: "fast" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.event).toBe(relay.aiEventName);
    expect(sent[0]!.data).toMatchObject({ system: "S", user: "U", model: "fast" });
    expect(typeof sent[0]!.data.id).toBe("string");
    // 收尾：模块是单例，未结算的请求会污染后续用例
    relay.resolveLlm({ id: sent[0]!.data.id as string, text: "ok" });
    await p;
    expect(relay.pendingCount()).toBe(0);
  });

  it("iframe 回填文本 → promise 落地，且待处理数归零", async () => {
    const sent = capture();
    const ai = relay.createRelayAi();
    const p = ai.complete({ system: "S", user: "U" });
    expect(relay.pendingCount()).toBe(1);
    const id = sent[0]!.data.id as string;
    expect(relay.resolveLlm({ id, text: '{"a":1}' })).toEqual({ ok: true });
    await expect(p).resolves.toEqual({ text: '{"a":1}' });
    expect(relay.pendingCount()).toBe(0);
  });

  it("iframe 回填 error → promise reject（由 BitfunLlmPort 捕获并降级）", async () => {
    const sent = capture();
    const ai = relay.createRelayAi();
    const p = ai.complete({ system: "S", user: "U" });
    relay.resolveLlm({ id: sent[0]!.data.id as string, error: "宿主 AI 拒绝" });
    await expect(p).rejects.toThrow(/宿主 AI 拒绝/);
  });

  it("未知 id → 明确失败（不静默、不抛）", () => {
    capture();
    expect(relay.resolveLlm({ id: "nope", text: "x" })).toEqual({
      ok: false,
      error: "无待回填的中继请求：nope",
    });
  });

  it("同一次 compute 的多次调用各自独立（id 唯一、互不串扰）", async () => {
    const sent = capture();
    const ai = relay.createRelayAi();
    const p1 = ai.complete({ system: "S", user: "u1" });
    const p2 = ai.complete({ system: "S", user: "u2" });
    expect(sent[0]!.data.id).not.toBe(sent[1]!.data.id);
    relay.resolveLlm({ id: sent[1]!.data.id as string, text: "second" });
    relay.resolveLlm({ id: sent[0]!.data.id as string, text: "first" });
    await expect(p1).resolves.toEqual({ text: "first" });
    await expect(p2).resolves.toEqual({ text: "second" });
  });

  it("超时未回填 → reject 并清理 pending（默认上限 180s，此处注入短超时）", async () => {
    capture();
    vi.useFakeTimers();
    try {
      const ai = relay.createRelayAi({ timeoutMs: 50 });
      const p = ai.complete({ system: "S", user: "U" });
      const assertion = expect(p).rejects.toThrow(/中继超时/);
      vi.advanceTimersByTime(60);
      await assertion;
      expect(relay.pendingCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("推送通道本身抛错 → 请求立即失败且不留下 pending", async () => {
    relay.setEmitter(() => {
      throw new Error("rpcEmit 不可用");
    });
    const ai = relay.createRelayAi();
    await expect(ai.complete({ system: "S", user: "U" })).rejects.toThrow(/rpcEmit 不可用/);
    expect(relay.pendingCount()).toBe(0);
  });

  it("回填方法名与 Worker 方法表一致", () => {
    expect(relay.aiResultMethod).toBe("credit.__llmResult");
  });
});
