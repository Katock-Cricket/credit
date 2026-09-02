import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPreviewBridge, type PreviewDeps } from "./preview-bridge.js";
import type { CreditRawEvent } from "@credit/protocol";

function makePreview(
  opts: { scrollTop?: number; clientHeight?: number; scrollHeight?: number } = {},
) {
  const handlers: Record<string, Array<() => void>> = {};
  const el: any = {
    scrollTop: opts.scrollTop ?? 0,
    clientHeight: opts.clientHeight ?? 100,
    scrollHeight: opts.scrollHeight ?? 1000,
    isConnected: true,
    addEventListener: (e: string, cb: any) => {
      (handlers[e] ||= []).push(cb);
    },
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ width: 200, height: 100, top: 0, bottom: 100, left: 0, right: 200 }),
    emit: (e: string) => (handlers[e] ?? []).forEach((cb) => cb()),
  };
  return { el, handlers };
}

function setup(
  entries: Array<{ el: any; filePath?: string | null; lineCount?: number | null; active?: boolean }>,
  overrides: Partial<PreviewDeps> = {},
) {
  const published: CreditRawEvent[] = [];
  const counts: Record<string, number> = {};
  const errors: string[] = [];
  const deps: PreviewDeps = {
    getMarkdownPreviews: () => entries,
    publish: (e) => published.push(e),
    count: (k) => {
      counts[k] = (counts[k] ?? 0) + 1;
    },
    logError: (m) => errors.push(m),
    ...overrides,
  };
  const bridge = createPreviewBridge(deps);
  return { bridge, published, counts, errors };
}

describe("preview-bridge（B-012：md 预览模式阅读采集）", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("挂载时产出 fileOpened + activeEditorChanged(editorKind=preview)", () => {
    const { el } = makePreview();
    const { bridge, published } = setup([{ el, filePath: "D:/p/SPEC.md", lineCount: 200 }]);

    expect(published).toEqual([
      expect.objectContaining({ type: "fileOpened", uri: "D:/p/SPEC.md" }),
      expect.objectContaining({ type: "activeEditorChanged", uri: "D:/p/SPEC.md", editorKind: "preview" }),
    ]);
    bridge.dispose();
  });

  it("scroll 按滚动比例估算行区间并标 approximate", () => {
    // 总高 1000、视口 100 → 每次可见 10%；源码 200 行 → 每次约 20 行
    const { el, handlers } = makePreview({ scrollTop: 500, clientHeight: 100, scrollHeight: 1000 });
    const { bridge, published } = setup([{ el, filePath: "SPEC.md", lineCount: 200 }]);
    published.length = 0;

    // 首尾节流：首次滚动**立即**产出（leading），确保捕获起点
    handlers.scroll?.forEach((cb) => cb());
    const scrolled = published.find((e) => e.type === "textScrolled") as any;
    expect(scrolled).toBeTruthy();
    // 50% 处 → 第 101 行；底部 60% → 第 120 行
    expect(scrolled.viewport).toEqual({ firstLine: 101, lastLine: 120 });
    expect(scrolled.editorKind).toBe("preview");
    expect(scrolled.approximate).toBe(true);
    bridge.dispose();
  });

  it("滚到底部时 lastLine 收敛到总行数", () => {
    const { el, handlers } = makePreview({ scrollTop: 900, clientHeight: 100, scrollHeight: 1000 });
    const { bridge, published } = setup([{ el, filePath: "SPEC.md", lineCount: 200 }]);
    published.length = 0;

    handlers.scroll?.forEach((cb) => cb());
    vi.advanceTimersByTime(200);

    const scrolled = published.find((e) => e.type === "textScrolled") as any;
    expect(scrolled.viewport.lastLine).toBe(200);
    bridge.dispose();
  });

  it("缺少总行数时不产出滚动事件（避免无意义的行号）", () => {
    const { el, handlers } = makePreview({ scrollTop: 100 });
    const { bridge, published, counts } = setup([{ el, filePath: "SPEC.md", lineCount: null }]);
    published.length = 0;

    handlers.scroll?.forEach((cb) => cb());
    vi.advanceTimersByTime(200);

    expect(published.filter((e) => e.type === "textScrolled")).toHaveLength(0);
    expect(counts["preview-bridge:scroll:empty"]).toBeGreaterThan(0);
    bridge.dispose();
  });

  it("元素失效（脱离文档）后重新挂载可再次产出事件", () => {
    const { el } = makePreview();
    const entries = [{ el, filePath: "SPEC.md", lineCount: 50 }];
    const { bridge, published } = setup(entries);
    const initial = published.filter((e) => e.type === "activeEditorChanged").length;

    el.isConnected = false;
    vi.advanceTimersByTime(300);
    el.isConnected = true;
    vi.advanceTimersByTime(300);

    expect(published.filter((e) => e.type === "activeEditorChanged").length).toBeGreaterThan(initial);
    bridge.dispose();
  });

  it("filePath 缺失时降级为合成 uri", () => {
    const { el } = makePreview();
    const { bridge, published } = setup([{ el, filePath: null, lineCount: 10 }]);

    const opened = published.find((e) => e.type === "fileOpened") as any;
    expect(opened?.uri).toMatch(/^preview:\/\/untitled/);
    bridge.dispose();
  });

  it("publish 抛错被 guard 自捕获（§5 旁路纪律）", () => {
    const { el } = makePreview();
    const counts: Record<string, number> = {};
    const errors: string[] = [];
    const bridge = createPreviewBridge({
      getMarkdownPreviews: () => [{ el, filePath: "SPEC.md", lineCount: 10 }],
      publish: () => {
        throw new Error("publish boom");
      },
      count: (k) => {
        counts[k] = (counts[k] ?? 0) + 1;
      },
      logError: (m) => errors.push(m),
    });

    expect(counts["preview-bridge:error"]).toBeGreaterThan(0);
    expect(errors.some((m) => m.includes("handler failed"))).toBe(true);
    bridge.dispose();
  });
});
