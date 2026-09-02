import { describe, it, expect, vi } from "vitest";
import { createControlApi } from "./control-api.js";
import type { PrSession } from "@credit/protocol";

const sessionStub = (over: Partial<PrSession> = {}): PrSession => ({
  prId: "pr-1",
  state: "recording",
  startedAt: 1,
  seq: 0,
  counts: {},
  ...over,
});

function setup() {
  const handlers: Record<string, (params: any) => Promise<unknown>> = {};
  const flush = vi.fn(async () => {});
  const discard = vi.fn();
  createControlApi({
    registerMethod: (method, handler) => {
      handlers[method] = handler as (params: any) => Promise<unknown>;
    },
    session: {
      handle: async (method: string) =>
        method === "credit.control.reset" ? null : sessionStub({ state: "committed" }),
      current: sessionStub(),
    } as never,
    logError: () => {},
    flush,
    discard,
  });
  return { handlers, flush, discard };
}

describe("control-api 生命周期命令后处理", () => {
  it("finish 后冲刷治理暂存并落盘（保存不丢最后一段行为）", async () => {
    const { handlers, flush, discard } = setup();
    const resp: any = await handlers["credit.finish"]!({ prId: "pr-1" });
    expect(resp.ok).toBe(true);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(discard).not.toHaveBeenCalled();
  });

  it("end 后同样冲刷暂存", async () => {
    const { handlers, flush } = setup();
    await handlers["credit.end"]!({ prId: "pr-1" });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("reset 后丢弃暂存，绝不冲刷（放弃的数据不落盘）", async () => {
    const { handlers, flush, discard } = setup();
    await handlers["credit.reset"]!({});
    expect(discard).toHaveBeenCalledTimes(1);
    expect(flush).not.toHaveBeenCalled();
  });

  it("getStatus 不冲刷暂存（避免打断正在进行的编辑）", async () => {
    const { handlers, flush, discard } = setup();
    await handlers["credit.getStatus"]!({});
    expect(flush).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
  });

  it("未注入 flush/discard 时不报错（向后兼容）", async () => {
    const handlers: Record<string, (params: any) => Promise<unknown>> = {};
    createControlApi({
      registerMethod: (m, h) => {
        handlers[m] = h as (params: any) => Promise<unknown>;
      },
      session: {
        handle: async () => sessionStub(),
        current: sessionStub(),
      } as never,
      logError: () => {},
    });
    const resp: any = await handlers["credit.finish"]!({ prId: "pr-1" });
    expect(resp.ok).toBe(true);
  });
});
