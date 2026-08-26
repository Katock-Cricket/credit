import { describe, it, expect, vi, afterEach } from "vitest";
import { createForeshadowBridge } from "./foreshadow-bridge.js";
import type { CreditRawEvent } from "@credit/protocol";

/** mock globalEventBus：记录 on 的 handler，提供 emit 触发 */
function mockBus() {
  const handlers: Record<string, Array<(d: any) => void>> = {};
  return {
    bus: {
      on(event: string, handler: (d: any) => void) {
        (handlers[event] ??= []).push(handler);
        return () => {
          handlers[event] = (handlers[event] ?? []).filter((h) => h !== handler);
        };
      },
    },
    emit(event: string, data: any) {
      (handlers[event] ?? []).forEach((h) => h(data));
    },
    handlers,
  };
}

/** mock model 事件源（onModelCreated / onModelContentReady / onModelContentChanged） */
function mockModelSource() {
  const subs = {
    created: new Set<(e: any) => void>(),
    ready: new Set<(e: any) => void>(),
    changed: new Set<(e: any) => void>(),
  };
  return {
    onModelCreated: (cb: (e: any) => void) => {
      subs.created.add(cb);
      return () => void subs.created.delete(cb);
    },
    onModelContentReady: (cb: (e: any) => void) => {
      subs.ready.add(cb);
      return () => void subs.ready.delete(cb);
    },
    onModelContentChanged: (cb: (e: any) => void) => {
      subs.changed.add(cb);
      return () => void subs.changed.delete(cb);
    },
    fireCreated: (e: any) => subs.created.forEach((h) => h(e)),
    fireReady: (e: any) => subs.ready.forEach((h) => h(e)),
    fireChanged: (e: any) => subs.changed.forEach((h) => h(e)),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("foreshadow-bridge self-capture", () => {
  it("publishes textChanged (merged, line-diff hunks) from onModelContentChanged", () => {
    vi.useFakeTimers();
    const b = mockBus();
    const src = mockModelSource();
    const published: CreditRawEvent[] = [];
    const counts: Record<string, number> = {};
    const bridge = createForeshadowBridge({
      globalEventBus: b.bus,
      api: { listen: () => () => {} },
      publish: (e) => published.push(e),
      count: (k) => (counts[k] = (counts[k] ?? 0) + 1),
      logError: vi.fn(),
      ...src,
    });

    // 打开文件：modelCreated → fileOpened + activeEditorChanged
    src.fireCreated({ uri: "file:///d/x/a.ts", filePath: "d:/x/a.ts", language: "ts" });
    expect(published.map((e) => e.type)).toEqual(["fileOpened", "activeEditorChanged"]);

    // 内容基线（contentReady）
    src.fireReady({ uri: "file:///d/x/a.ts", filePath: "d:/x/a.ts", content: "l1\nl2\nl3" });

    // 修改（400ms 窗口内两次合并为一条）
    published.length = 0;
    src.fireChanged({ uri: "file:///d/x/a.ts", filePath: "d:/x/a.ts", content: "l1\nl2" });
    src.fireChanged({ uri: "file:///d/x/a.ts", filePath: "d:/x/a.ts", content: "l1\nl2" });
    vi.advanceTimersByTime(500);

    expect(published).toHaveLength(1);
    const evt = published[0] as any;
    expect(evt.type).toBe("textChanged");
    expect(evt.beforeText).toBe("l1\nl2\nl3");
    expect(evt.afterText).toBe("l1\nl2");
    // diff hunks：删除 1 行（l3），带上下文 padding
    expect(Array.isArray(evt.changes)).toBe(true);
    const del = (evt.changes as any[]).find((h) => h.op === "delete");
    expect(del).toBeTruthy();
    expect(del.lines).toEqual(["l3"]);
    expect(counts["foreshadow-bridge:textChanged"]).toBe(1);
    bridge.dispose();
  });

  it("fileOpened dedupes same uri within 10s window", () => {
    vi.useFakeTimers();
    const b = mockBus();
    const src = mockModelSource();
    const published: CreditRawEvent[] = [];
    const bridge = createForeshadowBridge({
      globalEventBus: b.bus,
      api: { listen: () => () => {} },
      publish: (e) => published.push(e),
      count: () => {},
      logError: vi.fn(),
      ...src,
    });

    src.fireCreated({ uri: "file:///d/x/a.ts", filePath: "d:/x/a.ts", language: "ts" });
    vi.advanceTimersByTime(5_000);
    // 同文件再次打开（model 复用 → contentReady）→ 10s 内去重
    src.fireReady({ uri: "file:///d/x/a.ts", filePath: "d:/x/a.ts", content: "x" });
    expect(published.filter((e) => e.type === "fileOpened")).toHaveLength(1);

    // 10s 后再打开 → 再发
    vi.advanceTimersByTime(10_000);
    src.fireReady({ uri: "file:///d/x/a.ts", filePath: "d:/x/a.ts", content: "x" });
    expect(published.filter((e) => e.type === "fileOpened")).toHaveLength(2);
    bridge.dispose();
  });

  it("does NOT throw when handler errors (self-capture + count)", () => {
    vi.useFakeTimers();
    const b = mockBus();
    const src = mockModelSource();
    const logError = vi.fn();
    const counts: Record<string, number> = {};
    const bridge = createForeshadowBridge({
      globalEventBus: b.bus,
      api: { listen: () => () => {} },
      publish: () => {
        throw new Error("ingress boom");
      },
      count: (k) => (counts[k] = (counts[k] ?? 0) + 1),
      logError,
      ...src,
    });
    // 触发事件，publish 抛错不应冒泡到调用方
    expect(() => {
      src.fireCreated({ uri: "file:///d/x/a.ts", filePath: "d:/x/a.ts", language: "ts" });
      vi.advanceTimersByTime(500);
    }).not.toThrow();
    expect(logError).toHaveBeenCalled();
    expect(counts["foreshadow-bridge:error"]).toBeGreaterThanOrEqual(1);
    bridge.dispose();
  });
});
