import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTextareaBridge, type TextareaDeps } from "./textarea-bridge.js";
import type { CreditRawEvent } from "@credit/protocol";

/** 构造 mock textarea（仅实现桥实际用到的最小面） */
function makeTextarea(
  opts: {
    value?: string;
    scrollTop?: number;
    clientHeight?: number;
    scrollHeight?: number;
    selectionStart?: number;
    selectionEnd?: number;
  } = {},
) {
  const handlers: Record<string, Array<() => void>> = {};
  const el: any = {
    value: opts.value ?? "l1\nl2\nl3",
    scrollTop: opts.scrollTop ?? 0,
    clientHeight: opts.clientHeight ?? 100,
    scrollHeight: opts.scrollHeight ?? 300,
    selectionStart: opts.selectionStart ?? 0,
    selectionEnd: opts.selectionEnd ?? 0,
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

function setup(entries: Array<{ el: any; filePath?: string | null; active?: boolean }>, overrides: Partial<TextareaDeps> = {}) {
  const published: CreditRawEvent[] = [];
  const counts: Record<string, number> = {};
  const errors: Array<{ msg: string }> = [];
  const deps: TextareaDeps = {
    getMarkdownTextareas: () => entries,
    publish: (e) => published.push(e),
    count: (k) => {
      counts[k] = (counts[k] ?? 0) + 1;
    },
    logError: (m) => errors.push({ msg: m }),
    ...overrides,
  };
  const bridge = createTextareaBridge(deps);
  return { bridge, published, counts, errors };
}

describe("textarea-bridge（B-012：md 源码模式补采）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // selectionchange 监听依赖 document
    (globalThis as any).document = {
      activeElement: null,
      addEventListener: (_e: string, cb: any) => {
        ((globalThis as any).__docHandlers ||= []).push(cb);
      },
      removeEventListener: () => {},
    };
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).document;
    delete (globalThis as any).__docHandlers;
  });

  const fireSelectionChange = () => ((globalThis as any).__docHandlers ?? []).forEach((cb: any) => cb());

  it("挂载时产出 fileOpened + activeEditorChanged(editorKind=textarea)", () => {
    const { el } = makeTextarea();
    const { bridge, published } = setup([{ el, filePath: "D:/p/SPEC.md" }]);

    expect(published).toEqual([
      expect.objectContaining({ type: "fileOpened", uri: "D:/p/SPEC.md" }),
      expect.objectContaining({ type: "activeEditorChanged", uri: "D:/p/SPEC.md", editorKind: "textarea" }),
    ]);
    bridge.dispose();
  });

  it("input 产出 textChanged：before 取上次快照，净零不产出", () => {
    const { el, handlers } = makeTextarea({ value: "a\nb" });
    const { bridge, published } = setup([{ el, filePath: "SPEC.md" }]);
    published.length = 0;

    el.value = "a\nb\nc";
    handlers.input?.forEach((cb) => cb());
    vi.advanceTimersByTime(400);

    const first = published.find((e) => e.type === "textChanged") as any;
    expect(first.beforeText).toBe("a\nb");
    expect(first.afterText).toBe("a\nb\nc");

    // 内容未变 → 不产出
    published.length = 0;
    handlers.input?.forEach((cb) => cb());
    vi.advanceTimersByTime(400);
    expect(published.filter((e) => e.type === "textChanged")).toHaveLength(0);
    bridge.dispose();
  });

  it("scroll 产出 textScrolled：按行高估算可见行区间并标 approximate", () => {
    // 30 行、scrollHeight 3000 → 行高 100；clientHeight 100 → 可见 1 行
    const value = Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join("\n");
    const { el, handlers } = makeTextarea({ value, scrollTop: 500, clientHeight: 100, scrollHeight: 3000 });
    const { bridge, published } = setup([{ el, filePath: "SPEC.md" }]);
    published.length = 0;

    // 首尾节流：首次滚动**立即**产出（leading），确保捕获起点
    handlers.scroll?.forEach((cb) => cb());
    const scrolled = published.find((e) => e.type === "textScrolled") as any;
    expect(scrolled).toBeTruthy();
    // scrollTop 500 / 行高 100 → 第 6 行；视口高 100 → 仍为第 6 行
    expect(scrolled.viewport).toEqual({ firstLine: 6, lastLine: 6 });
    expect(scrolled.editorKind).toBe("textarea");
    expect(scrolled.approximate).toBe(true);
    bridge.dispose();
  });

  it("selectionchange 产出 selectionChanged：行号由 selectionStart 精确计算", () => {
    const { el } = makeTextarea({ value: "aaa\nbbb\nccc", selectionStart: 5, selectionEnd: 5 });
    (globalThis as any).document.activeElement = el;
    const { bridge, published } = setup([{ el, filePath: "SPEC.md" }]);
    published.length = 0;

    fireSelectionChange();
    const sel = published.find((e) => e.type === "selectionChanged") as any;
    expect(sel).toBeTruthy();
    expect(sel.line).toBe(2); // "aaa\n" 之后 → 第 2 行
    expect(sel.column).toBe(2); // "bb" 之后
    expect(sel.kind).toBe("cursor");
    expect(sel.approximate).toBeUndefined(); // 精确行号，不标近似
    bridge.dispose();
  });

  it("选区非空时带 selection 文本与 kind=select", () => {
    const { el } = makeTextarea({ value: "abcdef", selectionStart: 1, selectionEnd: 4 });
    (globalThis as any).document.activeElement = el;
    const { bridge, published } = setup([{ el, filePath: "SPEC.md" }]);
    published.length = 0;

    fireSelectionChange();
    const sel = published.find((e) => e.type === "selectionChanged") as any;
    expect(sel.kind).toBe("select");
    expect(sel.selection).toBe("bcd");
    bridge.dispose();
  });

  it("焦点不在本 textarea 时不产出 selectionChanged", () => {
    const { el } = makeTextarea({ selectionStart: 3 });
    (globalThis as any).document.activeElement = { other: true };
    const { bridge, published } = setup([{ el, filePath: "SPEC.md" }]);
    published.length = 0;

    fireSelectionChange();
    expect(published.filter((e) => e.type === "selectionChanged")).toHaveLength(0);
    bridge.dispose();
  });

  it("元素失效（脱离文档）后重新挂载可再次产出事件", () => {
    const { el } = makeTextarea();
    const entries = [{ el, filePath: "SPEC.md" }];
    const { bridge, published } = setup(entries);
    const initial = published.filter((e) => e.type === "activeEditorChanged").length;

    el.isConnected = false;
    vi.advanceTimersByTime(300);
    el.isConnected = true;
    vi.advanceTimersByTime(300);

    expect(published.filter((e) => e.type === "activeEditorChanged").length).toBeGreaterThan(initial);
    bridge.dispose();
  });

  it("filePath 缺失时降级为合成 uri（不丢事件）", () => {
    const { el } = makeTextarea();
    const { bridge, published } = setup([{ el, filePath: null }]);

    const opened = published.find((e) => e.type === "fileOpened") as any;
    expect(opened?.uri).toMatch(/^textarea:\/\/untitled/);
    bridge.dispose();
  });

  it("publish 抛错被 guard 自捕获（§5 旁路纪律）", () => {
    const { el } = makeTextarea();
    const counts: Record<string, number> = {};
    const errors: string[] = [];
    const bridge = createTextareaBridge({
      getMarkdownTextareas: () => [{ el, filePath: "SPEC.md" }],
      publish: () => {
        throw new Error("publish boom");
      },
      count: (k) => {
        counts[k] = (counts[k] ?? 0) + 1;
      },
      logError: (m) => errors.push(m),
    });

    expect(counts["textarea-bridge:error"]).toBeGreaterThan(0);
    expect(errors.some((m) => m.includes("handler failed"))).toBe(true);
    bridge.dispose();
  });
});
