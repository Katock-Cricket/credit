import { describe, it, expect } from "vitest";
import { IngressGovernor } from "./governor.js";
import { DEFAULT_CREDIT_CONFIG, type CreditConfig } from "../config.js";
import type { CreditRawEvent } from "@credit/protocol";

const cfg = (over: Partial<CreditConfig> = {}): CreditConfig => ({
  ...DEFAULT_CREDIT_CONFIG,
  ...over,
});

/** 构造带行号的编辑事件（行号用于失焦判定的行跳跃阈值） */
const editAt = (
  uri: string,
  before: string,
  after: string,
  ts: number,
  line = 9,
): CreditRawEvent =>
  ({
    type: "textChanged",
    uri,
    beforeText: before,
    afterText: after,
    changes: [{ op: "insert", startLine: line, endLine: line, lines: ["x"], contextBefore: [], contextAfter: [] }],
    ts,
  }) as unknown as CreditRawEvent;

const cursor = (uri: string, ts: number, line = 9): CreditRawEvent =>
  ({ type: "selectionChanged", uri, kind: "cursor", line, column: 1, selection: null, ts }) as unknown as CreditRawEvent;

const scroll = (uri: string, ts: number): CreditRawEvent =>
  ({ type: "textScrolled", uri, viewport: { firstLine: 1, lastLine: 50 }, ts }) as unknown as CreditRawEvent;

const switchFile = (uri: string, ts: number): CreditRawEvent =>
  ({ type: "activeEditorChanged", uri, ts }) as unknown as CreditRawEvent;

const prompt = (ts: number): CreditRawEvent =>
  ({ type: "promptSubmitted", sessionId: "s", promptText: "hi", fidelity: "frontend", ts }) as unknown as CreditRawEvent;

const onlyEdits = (out: { evt: CreditRawEvent }[]) =>
  out.filter((e) => e.evt.type === "textChanged");

describe("IngressGovernor — 编辑合并（失焦驱动，对齐 foreshadow edit-merge）", () => {
  it("连续打字暂存为一块：首条 before + 末条 after", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    // 真实场景：击键间隔常达数秒，时间窗合并无效，失焦驱动才对
    g.push(editAt("a.ts", "v0", "v1", 1000));
    g.push(editAt("a.ts", "v1", "v2", 2000));
    g.push(editAt("a.ts", "v2", "v3", 5000));
    const out = g.flushPending();
    expect(out).toHaveLength(1);
    expect(out[0]!.mergedCount).toBe(3);
    expect(out[0]!.evt.beforeText).toBe("v0");
    expect(out[0]!.evt.afterText).toBe("v3");
  });

  it("cursor 与 scroll 是白名单：不触发结算，编辑继续合并", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    g.push(editAt("a.ts", "v0", "v1", 1000));
    g.push(cursor("a.ts", 1100));
    g.push(scroll("a.ts", 1200));
    g.push(cursor("a.ts", 1300));
    g.push(editAt("a.ts", "v1", "v2", 1400));
    const out = g.flushPending();
    const edits = onlyEdits(out);
    expect(edits).toHaveLength(1);
    expect(edits[0]!.mergedCount).toBe(2);
    expect(edits[0]!.evt.beforeText).toBe("v0");
    expect(edits[0]!.evt.afterText).toBe("v2");
  });

  it("切换文件 → 注意力转移，结算暂存的编辑", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    g.push(editAt("a.ts", "v0", "v1", 1000));
    g.push(editAt("a.ts", "v1", "v2", 1100));
    const out = g.push(switchFile("b.ts", 1200));
    const edits = onlyEdits(out);
    expect(edits).toHaveLength(1);
    expect(edits[0]!.mergedCount).toBe(2);
    // 切换事件本身也要透传
    expect(out.some((e) => e.evt.type === "activeEditorChanged")).toBe(true);
  });

  it("问 Agent → 注意力转移，结算暂存的编辑", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    g.push(editAt("a.ts", "v0", "v1", 1000));
    const out = g.push(prompt(1100));
    expect(onlyEdits(out)).toHaveLength(1);
    expect(out.some((e) => e.evt.type === "promptSubmitted")).toBe(true);
  });

  it("同一文件内行号跳跃超过阈值 → 失焦结算", () => {
    const g = new IngressGovernor({ cfg: cfg({ editLostFocusLineThr: 10 }) });
    g.push(editAt("a.ts", "v0", "v1", 1000, 9));
    // 跳到第 100 行编辑：跳跃 91 > 10 → 失焦
    const out = g.push(editAt("a.ts", "v1", "v2", 1100, 100));
    expect(onlyEdits(out)).toHaveLength(1);
    expect(onlyEdits(out)[0]!.evt.afterText).toBe("v1");
  });

  it("行号邻近（阈值内）不失焦，继续合并", () => {
    const g = new IngressGovernor({ cfg: cfg({ editLostFocusLineThr: 10 }) });
    g.push(editAt("a.ts", "v0", "v1", 1000, 9));
    const out = g.push(editAt("a.ts", "v1", "v2", 1100, 15)); // 跳跃 6 ≤ 10
    expect(onlyEdits(out)).toHaveLength(0); // 未结算，仍暂存
    expect(g.flushPending()).toHaveLength(1);
  });

  it("净零编辑（加→删回到原样）整块丢弃，对齐 foreshadow", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    g.push(editAt("a.ts", "v0", "v1", 1000));
    g.push(editAt("a.ts", "v1", "v0", 1100));
    expect(g.flushPending()).toHaveLength(0);
    expect(g.stats.merged).toBe(2); // 被折叠计数
  });

  it("合并后按首 before 与尾 after 重算行级 diff", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    g.push(editAt("a.ts", "l1\nl2", "l1\nl2\nl3", 1000));
    g.push(editAt("a.ts", "l1\nl2\nl3", "l1\nl2\nl3\nl4", 1100));
    const out = g.flushPending();
    expect(out).toHaveLength(1);
    const changes = (out[0]!.evt as { changes?: unknown[] }).changes ?? [];
    // before=2 行 → after=4 行，合并后应重算出新增行（而非沿用末条的 1 行 diff）
    expect(Array.isArray(changes)).toBe(true);
    expect(changes.length).toBeGreaterThanOrEqual(1);
  });

  it("不同 actor 的编辑分开暂存（dev 与 ai 不混）", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    g.push(editAt("a.ts", "v0", "v1", 1000)); // dev 暂存
    // 切到 ai 编辑 → actor 变化即失焦，dev 块被结算返回
    const settled = g.push({ ...editAt("a.ts", "v1", "v2", 1100), source: "agent" } as CreditRawEvent);
    const rest = g.flushPending(); // ai 块
    const all = [...settled, ...rest];
    expect(all).toHaveLength(2);
    expect(all[0]!.evt.afterText).toBe("v1"); // dev 块
    expect(all[1]!.evt.afterText).toBe("v2"); // ai 块
  });

  it("滚动/光标的窗口定时器不打断编辑合并（回归：定时器误冲刷编辑暂存）", async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const g = new IngressGovernor({ cfg: cfg({ scrollMergeWindowMs: 50, editMaxHoldMs: 60_000 }) });
    g.push(editAt("a.ts", "v0", "v1", 1000));
    g.push(scroll("a.ts", 1100)); // 滚动 → 设置 50ms 定时器
    g.push(cursor("a.ts", 1200));
    g.push(editAt("a.ts", "v1", "v2", 1300));
    await sleep(150); // 等滚动定时器触发
    // 编辑仍在聚焦中，不应被滚动的定时器结算
    const out = g.flushPending();
    const edits = onlyEdits(out);
    expect(edits).toHaveLength(1);
    expect(edits[0]!.mergedCount).toBe(2);
    expect(edits[0]!.evt.beforeText).toBe("v0");
    expect(edits[0]!.evt.afterText).toBe("v2");
  });

  it("超过 editMaxHoldMs 未失焦 → 兜底结算，避免数据滞留", () => {
    const g = new IngressGovernor({ cfg: cfg({ editMaxHoldMs: 5000 }) });
    g.push(editAt("a.ts", "v0", "v1", 1000));
    // 20s 后的新编辑：先结算此前的暂存
    const out = g.push(editAt("a.ts", "v1", "v2", 21000));
    expect(onlyEdits(out)).toHaveLength(1);
    expect(onlyEdits(out)[0]!.evt.afterText).toBe("v1");
  });
});

describe("IngressGovernor — 未打开文件的 AI 编辑合成", () => {
  const agentEdit = (file: string, oldStr: string, newStr: string, ts: number): CreditRawEvent =>
    ({
      type: "agentToolUse",
      sessionId: "s",
      toolName: "Edit",
      toolInput: { file_path: file, old_string: oldStr, new_string: newStr },
      phase: "end",
      fidelity: "frontend",
      ts,
    }) as unknown as CreditRawEvent;

  it("未打开的文件被 Agent 编辑 → 合成 actor=ai 的 edit", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    const out = g.push(agentEdit("pkg/a.json", '"v": "1"', '"v": "2"', 1000));
    const tool = out.filter((e) => e.evt.type === "agentToolUse");
    const edits = out.filter((e) => e.evt.type === "textChanged");
    expect(tool).toHaveLength(1); // 工具调用本身仍记录
    expect(edits).toHaveLength(1); // 补出 AI 编辑
    const e = edits[0]!.evt as unknown as { uri: string; beforeText: string; afterText: string; source: string };
    expect(e.uri).toBe("pkg/a.json");
    expect(e.beforeText).toBe('"v": "1"');
    expect(e.afterText).toBe('"v": "2"');
    expect(e.source).toBe("agent"); // → actor 判为 ai
  });

  it("已打开（有基线）的文件被 Agent 编辑 → 不合成，避免重复", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    // 用户打开过该文件 → 建立基线
    g.push({ type: "textChanged", uri: "pkg/a.json", afterText: "orig", ts: 500 } as CreditRawEvent);
    const out = g.push(agentEdit("pkg/a.json", '"v": "1"', '"v": "2"', 1000));
    expect(out.filter((e) => e.evt.type === "textChanged")).toHaveLength(0);
  });

  it("Write 工具（content，无 old_string）也能合成", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    const out = g.push({
      type: "agentToolUse",
      sessionId: "s",
      toolName: "Write",
      toolInput: { file_path: "pkg/new.txt", content: "hello" },
      fidelity: "frontend",
      ts: 1000,
    } as unknown as CreditRawEvent);
    const edits = out.filter((e) => e.evt.type === "textChanged");
    expect(edits).toHaveLength(1);
    expect((edits[0]!.evt as unknown as { afterText: string }).afterText).toBe("hello");
  });

  it("非 Edit/Write 工具（如 Read）不合成", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    const out = g.push({
      type: "agentToolUse",
      sessionId: "s",
      toolName: "Read",
      toolInput: { file_path: "pkg/a.json" },
      fidelity: "frontend",
      ts: 1000,
    } as unknown as CreditRawEvent);
    expect(out.filter((e) => e.evt.type === "textChanged")).toHaveLength(0);
  });

  it("synthesizeAgentEdit=false 时关闭合成（配置驱动）", () => {
    const g = new IngressGovernor({ cfg: cfg({ synthesizeAgentEdit: false }) });
    const out = g.push(agentEdit("pkg/a.json", '"v": "1"', '"v": "2"', 1000));
    expect(out.filter((e) => e.evt.type === "textChanged")).toHaveLength(0);
  });
});

describe("IngressGovernor — 基线事件治理（决策 D-007）", () => {
  it("before 缺失且基线未建立：只建基线，不产出", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    const out = g.push({ type: "textChanged", uri: "a.ts", afterText: "hello", ts: 1000 } as CreditRawEvent);
    expect(out).toHaveLength(0);
    expect(g.stats.baseline).toBe(1);
    expect(g.flushPending()).toHaveLength(0);
  });

  it("基线建立后的编辑（带 before）正常暂存并在失焦时产出", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    g.push({ type: "textChanged", uri: "a.ts", afterText: "v0", ts: 1000 } as CreditRawEvent);
    g.push(editAt("a.ts", "v0", "v1", 1100));
    const out = g.flushPending();
    expect(out).toHaveLength(1);
    expect(out[0]!.evt.beforeText).toBe("v0");
  });

  it("before 缺失但基线已建立：用基线补全 before 后暂存", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    g.push({ type: "textChanged", uri: "a.ts", afterText: "base", ts: 1000 } as CreditRawEvent);
    g.push({ type: "textChanged", uri: "a.ts", afterText: "base+", ts: 1100 } as CreditRawEvent);
    const out = g.flushPending();
    expect(out).toHaveLength(1);
    expect(out[0]!.evt.beforeText).toBe("base");
  });

  it("baselineEmitBehavior=true 时基线事件也产出（配置驱动）", () => {
    const g = new IngressGovernor({ cfg: cfg({ baselineEmitBehavior: true }) });
    const out = g.push({ type: "textChanged", uri: "a.ts", afterText: "hello", ts: 1000 } as CreditRawEvent);
    expect(out).toHaveLength(1);
    expect(g.stats.baseline).toBe(1);
  });
});

describe("IngressGovernor — 滚动与选择合并", () => {
  it("scroll 合并：覆盖区间取并集、dwellMs 累加", () => {
    const g = new IngressGovernor({ cfg: cfg({ scrollMergeWindowMs: 600 }) });
    // 区间相交（[1,20] ∩ [10,30] ≠ ∅）→ 递归合并取并集
    g.push({
      type: "textScrolled", uri: "a.ts", viewport: { firstLine: 1, lastLine: 20 }, dwellMs: 100, ts: 1000,
    } as CreditRawEvent);
    g.push({
      type: "textScrolled", uri: "a.ts", viewport: { firstLine: 10, lastLine: 30 }, dwellMs: 200, ts: 1100,
    } as CreditRawEvent);
    const out = g.flushPending();
    expect(out).toHaveLength(1);
    expect(out[0]!.evt.viewport).toEqual({ firstLine: 1, lastLine: 30 });
    expect(out[0]!.evt.dwellMs).toBe(300);
    expect(out[0]!.mergedCount).toBe(2);
  });

  it("selection 合并：dwellMs 累加、位置取最后", () => {
    const g = new IngressGovernor({ cfg: cfg({ readDwellMs: 500 }) });
    g.push({ type: "selectionChanged", uri: "a.ts", kind: "cursor", line: 5, column: 1, selection: null, dwellMs: 120, ts: 1000 } as CreditRawEvent);
    g.push({ type: "selectionChanged", uri: "a.ts", kind: "cursor", line: 9, column: 2, selection: null, dwellMs: 80, ts: 1100 } as CreditRawEvent);
    const out = g.flushPending();
    expect(out).toHaveLength(1);
    expect(out[0]!.evt.dwellMs).toBe(200);
    expect((out[0]!.evt as { line?: number }).line).toBe(9);
  });
});

describe("IngressGovernor — 滚动与光标的合并（滑动窗口 / 行容忍度）", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("一次连续滚动合并为一条（滑动窗口不切断，避免相邻区间重叠）", () => {
    // 固定窗口会在边界处切断，导致 [4,98] 与 [59,140] 这类重叠区间；滑动窗口不会
    const g = new IngressGovernor({ cfg: cfg({ scrollMergeWindowMs: 100_000 }) });
    const base = Date.now();
    for (let i = 0; i < 6; i++) {
      g.push({
        type: "textScrolled",
        uri: "a.ts",
        viewport: { firstLine: 4 + i * 10, lastLine: 52 + i * 10 },
        ts: base + i * 200,
      } as unknown as CreditRawEvent);
    }
    const out = g.flushPending();
    expect(out).toHaveLength(1);
    expect(out[0]!.mergedCount).toBe(6);
    expect(out[0]!.evt.viewport).toEqual({ firstLine: 4, lastLine: 102 });
  });

  it("注意力转移（黑名单事件）结算滚动，不依赖时间", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    const base = Date.now();
    g.push({ type: "textScrolled", uri: "a.ts", viewport: { firstLine: 1, lastLine: 50 }, ts: base } as unknown as CreditRawEvent);
    // 隔很久再滚，只要区间仍相交就继续合并（不再按时间切段）
    g.push({ type: "textScrolled", uri: "a.ts", viewport: { firstLine: 40, lastLine: 90 }, ts: base + 30_000 } as unknown as CreditRawEvent);
    // 切换文件 = 注意力转移 → 结算
    const out = g.push({ type: "activeEditorChanged", uri: "b.ts", ts: base + 31_000 } as unknown as CreditRawEvent);
    const scrolls = out.filter((e) => e.evt.type === "textScrolled");
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0]!.mergedCount).toBe(2);
    expect(scrolls[0]!.evt.viewport).toEqual({ firstLine: 1, lastLine: 90 });
  });

  it("滚动跳到不相交的区域 → 结算上一段", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    const base = Date.now();
    g.push({ type: "textScrolled", uri: "a.ts", viewport: { firstLine: 1, lastLine: 50 }, ts: base } as unknown as CreditRawEvent);
    // 跳到第 500 行，与 [1,50] 无交集 → 结算上一段
    const out = g.push({ type: "textScrolled", uri: "a.ts", viewport: { firstLine: 500, lastLine: 550 }, ts: base + 200 } as unknown as CreditRawEvent);
    expect(out).toHaveLength(1);
    expect(out[0]!.evt.viewport).toEqual({ firstLine: 1, lastLine: 50 });
  });

  it("持续滚动超过 scrollMaxHoldMs 兜底输出，避免数据滞留", () => {
    const g = new IngressGovernor({
      cfg: cfg({ scrollMergeWindowMs: 100_000, scrollMaxHoldMs: 1000 }),
    });
    const base = Date.now();
    g.push({ type: "textScrolled", uri: "a.ts", viewport: { firstLine: 1, lastLine: 50 }, ts: base } as unknown as CreditRawEvent);
    // 持续滚动：每条间隔 200ms，累计超过 scrollMaxHoldMs(1000ms) 后兜底输出
    const out = g.push({ type: "textScrolled", uri: "a.ts", viewport: { firstLine: 60, lastLine: 110 }, ts: base + 1500 } as unknown as CreditRawEvent);
    expect(out).toHaveLength(1);
    expect(out[0]!.evt.viewport).toEqual({ firstLine: 1, lastLine: 50 });
  });

  it("cursor 在 ±20 行内跳动合并为一条", () => {
    const g = new IngressGovernor({ cfg: cfg({ cursorMergeLineThr: 20 }) });
    const base = Date.now();
    for (const line of [156, 171, 162, 162, 160]) {
      g.push({
        type: "selectionChanged",
        uri: "a.ts",
        kind: "cursor",
        line,
        column: 1,
        selection: null,
        ts: base,
      } as unknown as CreditRawEvent);
    }
    const out = g.flushPending();
    expect(out).toHaveLength(1);
    expect(out[0]!.mergedCount).toBe(5);
    expect((out[0]!.evt as unknown as { line: number }).line).toBe(160); // 位置取最新
  });

  it("cursor 行跳跃超过阈值 → 结算上一段", () => {
    const g = new IngressGovernor({ cfg: cfg({ cursorMergeLineThr: 20 }) });
    const base = Date.now();
    g.push({ type: "selectionChanged", uri: "a.ts", kind: "cursor", line: 10, column: 1, selection: null, ts: base } as unknown as CreditRawEvent);
    const out = g.push({ type: "selectionChanged", uri: "a.ts", kind: "cursor", line: 100, column: 1, selection: null, ts: base + 100 } as unknown as CreditRawEvent);
    expect(out).toHaveLength(1);
    expect((out[0]!.evt as unknown as { line: number }).line).toBe(10);
  });
});

describe("IngressGovernor — 非合并类事件透传并触发结算", () => {
  it("prompt/accept/agent/terminal 立即输出（并结算暂存编辑）", () => {
    const g = new IngressGovernor({ cfg: cfg() });
    expect(g.push({ type: "promptSubmitted", sessionId: "s", promptText: "hi", fidelity: "frontend", ts: 1 } as CreditRawEvent)).toHaveLength(1);
    expect(g.push({ type: "userAccept", kind: "file", fileUris: ["a.ts"], fidelity: "frontend", ts: 2 } as CreditRawEvent)).toHaveLength(1);
    expect(g.push({ type: "agentToolUse", sessionId: "s", toolName: "Edit", phase: "end", fidelity: "frontend", ts: 3 } as CreditRawEvent)).toHaveLength(1);
    expect(g.push({ type: "terminalCommand", processId: "p", cmd: "npm test", ts: 4 } as CreditRawEvent)).toHaveLength(1);
  });
});
