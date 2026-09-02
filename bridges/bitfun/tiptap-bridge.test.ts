import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTiptapBridge, type TiptapDeps } from "./tiptap-bridge.js";
import type { CreditRawEvent } from "@credit/protocol";

/** 构造 mock TipTap editor（仅实现桥实际用到的最小面） */
function makeEditor(
  opts: {
    text?: string;
    blockIndex?: number;
    /** 可见块的 [top, bottom]，用于滚动视口近似 */
    visibleBlocks?: Array<[number, number]>;
    empty?: boolean;
    /** 令 getText 抛错，验证异常不冒泡 */
    throwOnGetText?: boolean;
  } = {},
) {
  const handlers: Record<string, Array<() => void>> = {};
  let text = opts.text ?? "line1\nline2\nline3";
  const blockIndex = opts.blockIndex ?? 0;
  const empty = opts.empty ?? true;
  const blocks = (opts.visibleBlocks ?? []).map(([top, bottom]) => ({
    getBoundingClientRect: () => ({
      top,
      bottom,
      height: bottom - top,
      left: 0,
      right: 100,
      width: 100,
    }),
  }));
  const dom: any = {
    // 桥以 ProseMirror 的直接子元素作为块来源（不依赖 data-block-id）
    children: blocks,
    querySelectorAll: (_sel: string) => blocks,
    addEventListener: (_e: string, cb: any) => {
      (handlers.scroll ||= []).push(cb);
    },
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ top: 0, bottom: 100, height: 100, left: 0, right: 100, width: 100 }),
  };
  const editor: any = {
    on: (evt: string, cb: () => void) => {
      (handlers[evt] ||= []).push(cb);
    },
    emit: (evt: string) => (handlers[evt] ?? []).forEach((cb) => cb()),
    getText: () => {
      if (opts.throwOnGetText) throw new Error("getText boom");
      return text;
    },
    setText: (t: string) => {
      text = t;
    },
    state: {
      selection: {
        empty,
        from: 0,
        to: empty ? 0 : 3,
        $from: { depth: 1, index: () => blockIndex },
      },
      doc: { textBetween: () => "abc" },
    },
    view: { dom },
  };
  return { editor, dom, handlers };
}

function setup(entries: Array<{ editor: any; filePath?: string | null }>, overrides: Partial<TiptapDeps> = {}) {
  const published: CreditRawEvent[] = [];
  const counts: Record<string, number> = {};
  const errors: Array<{ msg: string; meta?: unknown }> = [];
  const deps: TiptapDeps = {
    getTiptapEditors: () => entries,
    publish: (e) => published.push(e),
    count: (k) => {
      counts[k] = (counts[k] ?? 0) + 1;
    },
    logError: (m, meta) => errors.push({ msg: m, meta }),
    ...overrides,
  };
  const bridge = createTiptapBridge(deps);
  return { bridge, published, counts, errors, deps };
}

describe("tiptap-bridge（B-012：md 文件行为补采）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 桥以**浏览器视口**判定块可见性（不再依赖滚动容器 rect），故 mock 视口高度。
    // 高度 100 对应下方用例里块的坐标区间（[10,40]、[50,80] 可见）。
    // 未定义 IntersectionObserver（node 环境）→ 走容器 scroll 触发源。
    (globalThis as any).window = { innerHeight: 100 };
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).window;
  });

  it("挂载时产出 fileOpened + activeEditorChanged(editorKind=tiptap)", () => {
    const { editor } = makeEditor();
    const { bridge, published } = setup([{ editor, filePath: "D:/proj/SPEC.md" }]);

    expect(published).toEqual([
      expect.objectContaining({ type: "fileOpened", uri: "D:/proj/SPEC.md" }),
      expect.objectContaining({ type: "activeEditorChanged", uri: "D:/proj/SPEC.md", editorKind: "tiptap" }),
    ]);
    bridge.dispose();
  });

  it("update 产出 textChanged：首次 before 为 null（基线），后续带 before/after", () => {
    const { editor, handlers } = makeEditor({ text: "a\nb" });
    const { bridge, published } = setup([{ editor, filePath: "SPEC.md" }]);
    published.length = 0;

    editor.setText("a\nb\nc");
    handlers.update?.forEach((cb) => cb());
    vi.advanceTimersByTime(400);

    const first = published.find((e) => e.type === "textChanged") as any;
    expect(first).toBeTruthy();
    expect(first.beforeText).toBe("a\nb"); // 挂载时已建基线，非 null
    expect(first.afterText).toBe("a\nb\nc");
    expect(first.source).toBe("user");

    // 第二次编辑：before 为上一次的 after
    published.length = 0;
    editor.setText("a\nb\nc\nd");
    handlers.update?.forEach((cb) => cb());
    vi.advanceTimersByTime(400);
    const second = published.find((e) => e.type === "textChanged") as any;
    expect(second.beforeText).toBe("a\nb\nc");
    expect(second.afterText).toBe("a\nb\nc\nd");
    bridge.dispose();
  });

  it("净零编辑不产出 textChanged", () => {
    const { editor, handlers } = makeEditor({ text: "same" });
    const { bridge, published } = setup([{ editor, filePath: "SPEC.md" }]);
    published.length = 0;

    handlers.update?.forEach((cb) => cb()); // 内容未变
    vi.advanceTimersByTime(400);
    expect(published.filter((e) => e.type === "textChanged")).toHaveLength(0);
    bridge.dispose();
  });

  it("selectionUpdate 产出 selectionChanged，行号为块索引近似并标 approximate", () => {
    const { editor, handlers } = makeEditor({ blockIndex: 3 });
    const { bridge, published } = setup([{ editor, filePath: "SPEC.md" }]);
    published.length = 0;

    handlers.selectionUpdate?.forEach((cb) => cb());
    const sel = published.find((e) => e.type === "selectionChanged") as any;
    expect(sel).toBeTruthy();
    expect(sel.line).toBe(3); // 块索引
    expect(sel.approximate).toBe(true);
    expect(sel.kind).toBe("cursor");
    bridge.dispose();
  });

  it("选区非空的 selectionChanged 带 selection 文本与 kind=select", () => {
    const { editor, handlers } = makeEditor({ empty: false });
    const { bridge, published } = setup([{ editor, filePath: "SPEC.md" }]);
    published.length = 0;

    handlers.selectionUpdate?.forEach((cb) => cb());
    const sel = published.find((e) => e.type === "selectionChanged") as any;
    expect(sel.kind).toBe("select");
    expect(sel.selection).toBe("abc");
    bridge.dispose();
  });

  it("scroll 节流后产出 textScrolled，viewport 为可见块索引区间且标 approximate", () => {
    const { editor, handlers } = makeEditor({
      visibleBlocks: [
        [-50, -10], // 视口外（上方）
        [10, 40], // 可见
        [50, 80], // 可见
        [200, 240], // 视口外（下方）
      ],
    });
    const { bridge, published } = setup([{ editor, filePath: "SPEC.md" }]);
    published.length = 0;

    // 首尾节流：首次滚动**立即**产出（leading），确保捕获起点
    handlers.scroll?.forEach((cb) => cb());
    const scrolled = published.find((e) => e.type === "textScrolled") as any;
    expect(scrolled).toBeTruthy();
    expect(scrolled.viewport).toEqual({ firstLine: 1, lastLine: 2 }); // 块索引
    expect(scrolled.editorKind).toBe("tiptap");
    expect(scrolled.approximate).toBe(true);
    bridge.dispose();
  });

  it("活跃实例切换时补发 activeEditorChanged（切回已打开的 md 不再静默）", () => {
    const { editor: ed1 } = makeEditor();
    const { editor: ed2 } = makeEditor();
    const entries = [
      { editor: ed1, filePath: "a.md", active: true },
      { editor: ed2, filePath: "b.md", active: false },
    ];
    const { bridge, published } = setup(entries);
    const initial = published.filter((e) => e.type === "activeEditorChanged").length;

    // 切到 b.md（模拟 tab 切换：实例不变，仅活跃目标变化）
    entries[0].active = false;
    entries[1].active = true;
    vi.advanceTimersByTime(300);

    const changed = published.filter((e) => e.type === "activeEditorChanged");
    expect(changed).toHaveLength(initial + 1);
    expect((changed[changed.length - 1] as any).uri).toBe("b.md");
    bridge.dispose();
  });

  it("实例失效（dom 脱离文档）后重新打开可再次挂载并产出事件", () => {
    const { editor } = makeEditor();
    const entries = [{ editor, filePath: "SPEC.md" }];
    const { bridge, published } = setup(entries);
    const initialChanged = published.filter((e) => e.type === "activeEditorChanged").length;

    // 模拟卸载（切模式/关 tab）：dom 脱离文档
    (editor.view.dom as any).isConnected = false;
    vi.advanceTimersByTime(300);
    // 重新挂载
    (editor.view.dom as any).isConnected = true;
    vi.advanceTimersByTime(300);

    // 失效实例被移出 attached 后应重新挂载，再次产出 view 事件
    expect(published.filter((e) => e.type === "activeEditorChanged").length).toBeGreaterThan(
      initialChanged,
    );
    bridge.dispose();
  });

  it("同一实例重复枚举不重复挂载（幂等）", () => {
    const { editor } = makeEditor();
    const entries = [{ editor, filePath: "SPEC.md" }];
    const { bridge, published } = setup(entries);
    const openedCount = published.filter((e) => e.type === "fileOpened").length;

    // 轮询再次枚举同一实例
    vi.advanceTimersByTime(1000);
    expect(published.filter((e) => e.type === "fileOpened")).toHaveLength(openedCount);
    bridge.dispose();
  });

  it("轮询发现新实例并补挂", () => {
    const { editor: ed1 } = makeEditor();
    const entries: Array<{ editor: any; filePath?: string | null }> = [{ editor: ed1, filePath: "a.md" }];
    const { bridge, published } = setup(entries);

    const { editor: ed2 } = makeEditor();
    // 标记 ed2 为活跃目标：打开/切换事件只在活跃判定里发（挂载即发会产生假事件）
    entries.push({ editor: ed2, filePath: "b.md", active: true });
    entries[0].active = false;
    vi.advanceTimersByTime(300);

    expect(published.some((e) => e.type === "fileOpened" && e.uri === "b.md")).toBe(true);
    bridge.dispose();
  });

  it("filePath 缺失时降级为合成 uri（不丢事件）", () => {
    const { editor } = makeEditor();
    const { bridge, published } = setup([{ editor, filePath: null }]);

    const opened = published.find((e) => e.type === "fileOpened") as any;
    expect(opened?.uri).toMatch(/^tiptap:\/\/untitled/);
    bridge.dispose();
  });

  it("宿主 getText 抛错时内容取空：不冒泡、不产出脏 textChanged", () => {
    const { editor, handlers } = makeEditor({ throwOnGetText: true });
    const { bridge, published } = setup([{ editor, filePath: "SPEC.md" }]);
    published.length = 0;

    expect(() => handlers.update?.forEach((cb) => cb())).not.toThrow();
    vi.advanceTimersByTime(400);
    // 内容取不到（before/after 均为空且相等）→ 跳过，绝不产出无意义事件
    expect(published.filter((e) => e.type === "textChanged")).toHaveLength(0);
    bridge.dispose();
  });

  it("publish 抛错被 guard 自捕获（§5：绝不向事件源抛错），并计数与记录", () => {
    const { editor } = makeEditor();
    const counts: Record<string, number> = {};
    const errors: Array<{ msg: string; meta?: unknown }> = [];
    const bridge = createTiptapBridge({
      getTiptapEditors: () => [{ editor, filePath: "SPEC.md" }],
      publish: () => {
        throw new Error("publish boom");
      },
      count: (k) => {
        counts[k] = (counts[k] ?? 0) + 1;
      },
      logError: (m, meta) => errors.push({ msg: m, meta }),
    });

    expect(counts["tiptap-bridge:error"]).toBeGreaterThan(0);
    expect(errors.some((e) => e.msg.includes("handler failed"))).toBe(true);
    bridge.dispose();
  });

  it("未提供 getTiptapEditors 时不抛错（向后兼容）", () => {
    const { bridge, published } = setup([], { getTiptapEditors: undefined });
    expect(published).toHaveLength(0);
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    bridge.dispose();
  });
});
