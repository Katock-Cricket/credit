/**
 * 过程建模测试（P2-pre T3–T7）。
 *
 * 覆盖 SPEC 各节用例清单：切分边界、阶段归类、Review 反推、Desc 降级链、
 * TaskGraph 结构完整性、分析插件异常隔离。**全部离线**（LLM 用 Mock/Null）。
 */
import { describe, it, expect } from "vitest";
import type { Behavior, ObjectRole } from "@credit/protocol";
import { createMockLlmPort, createNullLlmPort } from "../llm/index.js";
import { buildTaskGraph } from "./build.js";
import { segmentBehaviors } from "./segment.js";
import { detectReviewSessions, reviewSignalOf, isReviewBehavior } from "./review.js";
import { classifyWindow, annotateStages, makeClassifyContext, buildFixWindows } from "./stage.js";
import { detectTestRuns } from "./testrun.js";
import { cleanPrompt, fallbackDesc, generateDescs } from "./desc.js";
import { buildBehaviorSummary, aggregateFiles, computeMetrics } from "./files.js";
import { mergeTaskConfig, DEFAULT_TASK_CONFIG } from "./config.js";
import { createAnalyticRegistry } from "../process/registry.js";
import { createAiInvolvementLayer, createCollabPatternLayer } from "../process/index.js";
import type { StageId } from "./types.js";

const CFG = DEFAULT_TASK_CONFIG;
let seq = 0;

/** 构造一条 Behavior（默认 dev/agent.tool，按需覆盖） */
function b(over: Partial<Behavior> & { ts: number }): Behavior {
  seq += 1;
  return {
    id: `pr-1-${seq}`,
    prId: "pr-1",
    ts: over.ts,
    actor: over.actor ?? "dev",
    action: over.action ?? "agent.tool",
    object: over.object ?? { kind: "panel" },
    context: over.context ?? { fidelity: "frontend" },
    source: "test",
  };
}

/** 构造一批等间隔的行为 */
function series(n: number, startTs: number, stepMs: number, mk: (i: number) => Partial<Behavior>): Behavior[] {
  return Array.from({ length: n }, (_, i) => b({ ts: startTs + i * stepMs, ...mk(i) }));
}

function prompt(ts: number, text: string, sessionId = "sess-main"): Behavior {
  return b({
    ts,
    action: "prompt.submit",
    object: { kind: "dialog", uri: sessionId },
    context: { promptText: text, sessionId, fidelity: "frontend" },
  });
}

function edit(ts: number, uri: string, role: ObjectRole = "source", actor: "dev" | "ai" = "ai"): Behavior {
  return b({
    ts,
    actor,
    action: "edit",
    object: { kind: "file", uri, role },
    context: { before: "a", after: "b", diff: [{ op: "insert", startLine: 1, endLine: 1, lines: ["b"] }], fidelity: "frontend" },
  });
}

function testCmd(ts: number, cmd = "cargo test --lib", actor: "dev" | "ai" = "dev", exitCode: number | null = 0): Behavior {
  return b({
    ts,
    actor,
    action: "terminal.exec",
    object: { kind: "terminal", uri: "proc-1" },
    context: { cmd, exitCode, output: actor === "dev" ? "test result: ok. 5 passed; 0 failed" : null, fidelity: "frontend" },
  });
}

// ───────────────────────── T3 切分 ─────────────────────────

describe("segment · Task 切分（规则定边界）", () => {
  it("S1：每条 Dev prompt 都是一个切点", () => {
    const bs = [
      b({ ts: 1000 }),
      prompt(2000, "第一个需求"),
      b({ ts: 3000 }),
      b({ ts: 4000 }),
      prompt(5000, "第二个需求"),
      b({ ts: 6000 }),
      b({ ts: 7000 }),
    ];
    const { clusters, cutSignals } = segmentBehaviors(bs, CFG);
    expect(cutSignals.prompt).toBe(2);
    expect(clusters).toHaveLength(3);
    expect(clusters[1]![0]!.action).toBe("prompt.submit");
  });

  it("S2：超过 idleGapMs 的空档切开（恰好等于不切）", () => {
    // 第二段起点与第一段末点的间隔**恰好**为 gap
    const mk = (gap: number) => [
      b({ ts: 1000 }),
      b({ ts: 2000 }),
      b({ ts: 2000 + gap }),
      b({ ts: 3000 + gap }),
      b({ ts: 4000 + gap }),
    ];
    expect(segmentBehaviors(mk(CFG.idleGapMs), CFG).cutSignals.idleGap).toBe(0);
    expect(segmentBehaviors(mk(CFG.idleGapMs + 1), CFG).cutSignals.idleGap).toBe(1);
  });

  it("S3：Dev 执行测试命令切开", () => {
    const bs = [
      b({ ts: 1000 }), b({ ts: 2000 }), b({ ts: 3000 }),
      testCmd(4000),
      b({ ts: 5000 }), b({ ts: 6000 }), b({ ts: 7000 }),
    ];
    expect(segmentBehaviors(bs, CFG).cutSignals.testCmd).toBe(1);
  });

  it("S3 只认 Dev：actor=ai 的 terminal.exec 不切（Agent 跑命令属 Task 内部）", () => {
    const aiOnly = [
      b({ ts: 1000 }), b({ ts: 2000 }), b({ ts: 3000 }),
      testCmd(4000, "cargo test --lib", "ai"),
      b({ ts: 5000 }), b({ ts: 6000 }), b({ ts: 7000 }),
    ];
    expect(segmentBehaviors(aiOnly, CFG).cutSignals.testCmd).toBe(0);
  });

  it("S4：sessionId 切换切开", () => {
    const bs = [
      b({ ts: 1000, context: { sessionId: "sess-a" } }),
      b({ ts: 2000, context: { sessionId: "sess-a" } }),
      b({ ts: 3000, context: { sessionId: "sess-b" } }),
      b({ ts: 4000, context: { sessionId: "sess-b" } }),
      b({ ts: 5000, context: { sessionId: "sess-b" } }),
    ];
    expect(segmentBehaviors(bs, CFG).cutSignals.reviewSwitch).toBe(1);
  });

  it("S5 默认关闭（P1 样例实测噪声过大）；开启后生效", () => {
    const bs = [
      edit(1000, "D:/a.ts"), b({ ts: 2000 }), b({ ts: 3000 }),
      edit(4000, "D:/b.ts"), b({ ts: 5000 }), b({ ts: 6000 }), b({ ts: 7000 }),
    ];
    expect(segmentBehaviors(bs, CFG).cutSignals.fileSwitch).toBe(0);
    expect(segmentBehaviors(bs, { enableFileSwitch: true }).cutSignals.fileSwitch).toBe(1);
  });

  it("噪声抑制：< minClusterSize 的碎片并入相邻簇", () => {
    const bs = [
      b({ ts: 1000 }), b({ ts: 1100 }), b({ ts: 1200 }), b({ ts: 1300 }),
      prompt(2000, "切一刀"),
      b({ ts: 2100 }), // 只有 1 条 → 应并入前一簇
      b({ ts: 3000 }), b({ ts: 3100 }), b({ ts: 3200 }),
      prompt(4000, "再切一刀"),
      b({ ts: 4100 }), b({ ts: 4200 }), b({ ts: 4300 }),
    ];
    const { clusters } = segmentBehaviors(bs, CFG);
    // prompt 后的单条碎片被并入，最终 3 簇
    expect(clusters).toHaveLength(3);
  });

  it("空输入不崩溃", () => {
    const r = segmentBehaviors([], CFG);
    expect(r.clusters).toHaveLength(0);
  });
});

// ───────────────────────── 测试运行解析 ─────────────────────────

describe("testrun · 测试运行识别", () => {
  it("识别 Dev 的 cargo test 并解析结果", () => {
    const bs = [testCmd(1000, "cargo test --lib", "dev", 0)];
    const runs = detectTestRuns(bs, CFG);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.actor).toBe("dev");
    expect(runs[0]!.passed).toBe(5);
    expect(runs[0]!.failed).toBe(0);
    expect(runs[0]!.parseOk).toBe(true);
  });

  it("start/end 两条同命令合并为一次运行", () => {
    const bs = [
      testCmd(1000, "cargo test --lib", "dev", null),
      testCmd(1200, "cargo test --lib", "dev", 0),
    ];
    expect(detectTestRuns(bs, CFG)).toHaveLength(1);
  });

  it("非测试命令不识别", () => {
    expect(detectTestRuns([testCmd(1000, "ls -la")], CFG)).toHaveLength(0);
  });

  it("无输出时靠 exitCode 粗判（parseOk=false）", () => {
    const bs = [b({
      ts: 1000, action: "terminal.exec", object: { kind: "terminal", uri: "p" },
      context: { cmd: "npm test", exitCode: 1, output: null },
    })];
    const runs = detectTestRuns(bs, CFG);
    expect(runs[0]!.failed).toBe(1);
    expect(runs[0]!.parseOk).toBe(false);
  });

  it("修复窗口：仅由失败运行生成", () => {
    const runs = [
      { ...detectTestRuns([testCmd(1000, "cargo test", "dev", 0)], CFG)[0]! },
    ];
    expect(buildFixWindows(runs)).toHaveLength(0);
    const failing = detectTestRuns([
      b({ ts: 1000, action: "terminal.exec", object: { kind: "terminal", uri: "p" }, context: { cmd: "cargo test", exitCode: 101, output: null } }),
    ], CFG);
    expect(buildFixWindows(failing)).toHaveLength(1);
  });
});

// ───────────────────────── T5 Review 反推 ─────────────────────────

describe("review · 语义反推（D-015）", () => {
  const reviewPrompt = (ts: number, sid: string, text = "Perform an independent adversarial review") =>
    prompt(ts, text, sid);

  it("L1：review 子会话的 Dev prompt 是锚点", () => {
    const b1 = reviewPrompt(1000, "review_child_review_abc");
    expect(reviewSignalOf(b1, CFG)).toEqual({ level: "L1", anchor: true });
  });

  it("L1 补充：review 会话下的 AI 消息**不是**锚点（否则会吞掉后续修复）", () => {
    const msg = b({
      ts: 2000,
      action: "agent.message",
      object: { kind: "dialog", uri: "review_child_review_abc" },
      context: { sessionId: "review_child_review_abc", after: "ok", fidelity: "frontend" },
    });
    expect(reviewSignalOf(msg, CFG)).toEqual({ level: "L1", anchor: false });
  });

  it("L2：主会话里含审阅语义的 prompt 也是锚点（覆盖非内置形态）", () => {
    const p = prompt(1000, "帮我 review 一下这段代码", "sess-main");
    expect(reviewSignalOf(p, CFG)).toEqual({ level: "L2", anchor: true });
  });

  it("L3：AI 消息含 finding 结构 → 补充信号，非锚点", () => {
    const msg = b({
      ts: 1000,
      action: "agent.message",
      object: { kind: "dialog", uri: "sess-main" },
      context: { sessionId: "sess-main", after: "Severity: blocking — 建议修改", fidelity: "frontend" },
    });
    expect(reviewSignalOf(msg, CFG)).toEqual({ level: "L3", anchor: false });
  });

  it("L3 不能单独发起一轮 review（初版 3 处误判的修复）", () => {
    const msg = b({
      ts: 1000,
      action: "agent.message",
      object: { kind: "dialog", uri: "sess-main" },
      context: { sessionId: "sess-main", after: "Severity: blocking", fidelity: "frontend" },
    });
    expect(detectReviewSessions([msg], CFG)).toHaveLength(0);
  });

  it("轮数 = 不同 review 子会话数；处置语义可识别", () => {
    const bs = [
      reviewPrompt(1000, "review_child_review_1"),
      b({ ts: 1100, action: "agent.message", context: { sessionId: "review_child_review_1", after: "x" }, object: { kind: "dialog", uri: "review_child_review_1" } }),
      reviewPrompt(5000, "review_child_review_2"),
      prompt(6000, "The user approved remediation for selected Review findings only.", "review_child_review_2"),
    ];
    const rs = detectReviewSessions(bs, CFG);
    expect(rs).toHaveLength(2);
    expect(rs[0]!.roundIndex).toBe(1);
    expect(rs[1]!.roundIndex).toBe(2);
    expect(rs[1]!.disposition).toBe("selected");
  });

  it("时间范围不越过下一轮起点，也不由 AI 消息无限延长", () => {
    const bs = [
      reviewPrompt(1000, "review_child_review_1"),
      reviewPrompt(2000, "review_child_review_2"),
      b({ ts: 999_000, action: "agent.message", context: { sessionId: "review_child_review_2", after: "y" }, object: { kind: "dialog", uri: "review_child_review_2" } }),
    ];
    const rs = detectReviewSessions(bs, CFG);
    expect(rs[0]!.endTs).toBeLessThanOrEqual(rs[1]!.startTs);
  });

  it("isReviewBehavior 供切分与归类共用", () => {
    expect(isReviewBehavior(reviewPrompt(1000, "review_child_review_x"), CFG)).toBe(true);
    expect(isReviewBehavior(b({ ts: 1000 }), CFG)).toBe(false);
  });
});

// ───────────────────────── T4 阶段标注 ─────────────────────────

describe("stage · 阶段标注（C1）", () => {
  const emptyCtx = () => makeClassifyContext([], [], new Set(), CFG);

  const classify = (bs: Behavior[], ctx = emptyCtx()): StageId => classifyWindow(bs, ctx);

  it("规则 1：review 行为覆盖 → ai-review", () => {
    const ids = new Set<string>();
    const rp = reviewPromptSig(1000);
    ids.add(rp.id);
    const ctx = makeClassifyContext([rp], [], ids, CFG);
    expect(classify([rp, b({ ts: 1100 })], ctx)).toBe("ai-review");
  });

  it("规则 2：SPEC 文件编辑 → spec-engineering", () => {
    expect(classify([edit(1000, "docs/SPEC.md", "spec")])).toBe("spec-engineering");
  });

  it("规则 3：测试文件编辑（无失败上下文）→ test-planning", () => {
    expect(classify([edit(1000, "src/a.test.ts", "test")])).toBe("test-planning");
  });

  it("规则 4：修复窗口内 + 修复语义 prompt → ai-fix", () => {
    const ctx = makeClassifyContext([], [], new Set(), CFG);
    ctx.fixWindows = [{ startTs: 0, endTs: 100_000 }];
    expect(classify([prompt(1000, "这个报错帮我修复一下")], ctx)).toBe("ai-fix");
  });

  it("规则 4 收紧：修复窗口内**仅有编辑**不再判 ai-fix（P1 样例误标的修复）", () => {
    const ctx = makeClassifyContext([], [], new Set(), CFG);
    ctx.fixWindows = [{ startTs: 0, endTs: 100_000 }];
    expect(classify([edit(1000, "src/a.ts")], ctx)).not.toBe("ai-fix");
  });

  it("规则 5：Dev 触发的测试运行 → ai-testing", () => {
    // 必须复用同一实例：testRunBehaviorIds 是按 behavior.id 匹配的
    const tc = testCmd(1000, "cargo test");
    const ctx = makeClassifyContext([tc], detectTestRuns([tc], CFG), new Set(), CFG);
    expect(classify([tc], ctx)).toBe("ai-testing");
  });

  it("规则 5 收紧：AI 边写边跑测试不算测试阶段（P1 样例 40 分钟误标）", () => {
    const aiTest = testCmd(1000, "cargo test --lib", "ai", 0);
    const ctx = makeClassifyContext([aiTest], detectTestRuns([aiTest], CFG), new Set(), CFG);
    expect(classify([edit(900, "src/a.ts"), aiTest], ctx)).not.toBe("ai-testing");
  });

  it("规则 6：人工验证语义 prompt → manual-verification", () => {
    expect(classify([prompt(1000, "人工dev验证结果：可以出声了")])).toBe("manual-verification");
  });

  it("规则 7：其余 → ai-code-generation", () => {
    expect(classify([b({ ts: 1000 })])).toBe("ai-code-generation");
  });

  // ── 用户指出的误判（P1 样例 T2–T6）──

  it("SPEC 文件**只有阅读没有编辑**也算 SPEC 工程（T5 场景：用户在审阅）", () => {
    const reads = [
      b({ ts: 1000, action: "file.open", object: { kind: "file", uri: "docs/SPEC-a.md", role: "spec" } }),
      b({ ts: 1100, action: "view", object: { kind: "file", uri: "docs/SPEC-a.md", role: "spec" } }),
      b({ ts: 1200, action: "file.scroll", object: { kind: "file", uri: "docs/SPEC-a.md", role: "spec" } }),
    ];
    expect(classify(reads)).toBe("spec-engineering");
  });

  it("调研类 prompt 且未动源码 → SPEC 工程（T2 场景）", () => {
    expect(classify([prompt(1000, "先探索仓库代码，形成调研报告")])).toBe("spec-engineering");
  });

  it("方案讨论 prompt 且未动源码 → SPEC 工程（T4 场景）", () => {
    expect(classify([prompt(1000, "你的调研我看了，本次任务先按方案A走")])).toBe(
      "spec-engineering",
    );
  });

  it("测试准备 prompt 且未动源码 → 测试方案准备（T6 前段场景）", () => {
    const p = prompt(
      1000,
      "我按测试验收要求为你准备了测试音频，你编写测试用例时可以使用，按照测试驱动",
    );
    expect(classify([p])).toBe("test-planning");
  });

  it("已在写源码时不再判测试准备（避免 40 分钟实现被误标）", () => {
    const p = prompt(1000, "你编写测试用例时可以使用这些测试数据");
    expect(classify([p, edit(2000, "src/a.ts", "source")])).not.toBe("test-planning");
  });

  it("README 不算规格文档（避免 T1 开场看 README 被误判）", () => {
    const readme = [
      b({ ts: 1000, action: "file.open", object: { kind: "file", uri: "README.md", role: "unknown" } }),
      b({ ts: 1100, action: "view", object: { kind: "file", uri: "README.md", role: "unknown" } }),
    ];
    expect(classify(readme)).not.toBe("spec-engineering");
  });

  it("修复优先于人工验证：『人工验证**发现**问题 → 诊断』是修复不是验证通过（T9）", () => {
    const ctx = makeClassifyContext([], [], new Set(), CFG);
    ctx.fixWindows = [{ startTs: 0, endTs: 100_000 }];
    expect(classify([prompt(1000, "人工dev验证结果：有严重的听觉问题，请你诊断下原因")], ctx)).toBe(
      "ai-fix",
    );
  });

  it("人工复测通过 → manual-verification（T10）", () => {
    const ctx = makeClassifyContext([], [], new Set(), CFG);
    ctx.fixWindows = [{ startTs: 0, endTs: 100_000 }];
    expect(classify([prompt(1000, "我人工复测问题验证；已解决，验收用例均已测试通过")], ctx)).toBe(
      "manual-verification",
    );
  });

  it("Dev 跑测试 + 顺手看了眼报告 → 测试阶段，不被文档活动抢判（T8）", () => {
    const tc = testCmd(1000, "cargo test --lib");
    const readReport = b({
      ts: 1100,
      action: "file.scroll",
      object: { kind: "file", uri: "docs/report-stage1.md", role: "unknown" },
    });
    const ctx = makeClassifyContext([tc], detectTestRuns([tc], CFG), new Set(), CFG);
    expect(classify([tc, readReport], ctx)).toBe("ai-testing");
  });

  it("spans 带 startTs/endTs（甘特图按 span 渲染所必需）", () => {
    const bs = [
      edit(1000, "docs/SPEC.md", "spec"),
      prompt(20_000, "开始写代码"),
      edit(21_000, "src/a.ts", "source", "ai"),
      edit(22_000, "src/a.ts", "source", "ai"),
    ];
    const ctx = makeClassifyContext(bs, [], new Set(), CFG);
    const ann = annotateStages(bs, ctx);
    expect(ann.spans.length).toBeGreaterThanOrEqual(2);
    for (const sp of ann.spans) {
      expect(sp.startTs).toBeGreaterThan(0);
      expect(sp.endTs).toBeGreaterThanOrEqual(sp.startTs);
    }
    // 相邻 span 时间衔接（合并后 endTs 应被更新到后一段的末点）
    for (let i = 1; i < ann.spans.length; i++) {
      expect(ann.spans[i]!.startTs).toBeGreaterThanOrEqual(ann.spans[i - 1]!.endTs);
    }
  });

  it("「开始写代码」成为子段锚点：备测试数据 → 实现 被切分（T6）", () => {
    const bs = [
      prompt(1000, "我准备了测试音频，你编写测试用例时可以使用"),
      b({ ts: 2000, action: "agent.tool", actor: "ai" }),
      edit(5000, "src/a.ts", "source", "ai"),
      edit(6000, "src/a.ts", "source", "ai"),
    ];
    const ctx = makeClassifyContext(bs, [], new Set(), CFG);
    const ann = annotateStages(bs, ctx);
    expect(ann.spans[0]!.stage).toBe("test-planning");
    expect(ann.spans[ann.spans.length - 1]!.stage).toBe("ai-code-generation");
  });

  it("spans：混合 Task 的权重和为 1，且相邻同类被合并", () => {
    const bs = [
      edit(1000, "docs/SPEC.md", "spec"),
      edit(2000, "docs/SPEC.md", "spec"),
      prompt(10_000, "开始生成代码"),
      ...series(5, 11_000, 1000, () => ({ action: "agent.tool" as const })),
    ];
    const ctx = makeClassifyContext(bs, [], new Set(), CFG);
    const ann = annotateStages(bs, ctx);
    const sum = ann.spans.reduce((s, x) => s + x.weight, 0);
    expect(sum).toBeCloseTo(1, 3);
    // 相邻同类已合并：不应出现两个连续的 spec-engineering
    for (let i = 1; i < ann.spans.length; i++) {
      expect(ann.spans[i]!.stage).not.toBe(ann.spans[i - 1]!.stage);
    }
    expect(ann.spans.length).toBeGreaterThanOrEqual(2);
  });

  it("空窗口 → unknown，不崩溃", () => {
    expect(classify([], emptyCtx())).toBe("unknown");
    expect(annotateStages([], emptyCtx()).spans).toHaveLength(0);
  });
});

// ───────────────────────── Desc 生成 ─────────────────────────

describe("desc · Desc 与降级链（D-018 修订 + D-023）", () => {
  it("cleanPrompt 剥离注入上下文块", () => {
    const r = cleanPrompt(
      "[Directory: D:\\repo\\src] [File: a.ts] 我准备为该仓库添加 E-AC-3 支持",
      1200,
    );
    expect(r.text).not.toContain("[Directory");
    expect(r.text).toContain("我准备为该仓库添加");
    expect(r.systemTemplate).toBe(false);
  });

  it("cleanPrompt 识别系统模板并给出语义标签", () => {
    const r = cleanPrompt("Perform an independent adversarial review of the requested change.", 1200);
    expect(r.systemTemplate).toBe(true);
    expect(r.templateLabel).toBe("执行 AI Review");
  });

  it("cleanPrompt 超长截断", () => {
    const r = cleanPrompt("x".repeat(500), 100);
    expect(r.text.length).toBeLessThanOrEqual(101); // 含省略号
    expect(r.text.endsWith("…")).toBe(true);
  });

  it("L3 降级：普通 prompt 原文", () => {
    const r = fallbackDesc(
      { taskId: "T1", promptText: "帮我加个功能", systemTemplate: false, templateLabel: null, agentMessage: null, behaviorSummary: "编辑 1 文件", files: [], stage: "ai-code-generation" },
      CFG,
    );
    expect(r.desc).toBe("帮我加个功能");
    expect(r.source).toBe("prompt");
  });

  it("L3 降级：系统模板 → 语义标签", () => {
    const r = fallbackDesc(
      { taskId: "T1", promptText: "", systemTemplate: true, templateLabel: "执行 AI Review", agentMessage: null, behaviorSummary: "", files: [], stage: "ai-review" },
      CFG,
    );
    expect(r.desc).toBe("执行 AI Review");
  });

  it("L4 降级：AI 消息首句", () => {
    const r = fallbackDesc(
      { taskId: "T1", promptText: "", systemTemplate: false, templateLabel: null, agentMessage: "我先读取文件。然后分析代码。", behaviorSummary: "", files: [], stage: "ai-code-generation" },
      CFG,
    );
    expect(r.source).toBe("agent-message");
    expect(r.desc).toBe("我先读取文件。");
  });

  it("L5 降级：无可得 → desc=null 且 source=rule", () => {
    const r = fallbackDesc(
      { taskId: "T1", promptText: "", systemTemplate: false, templateLabel: null, agentMessage: null, behaviorSummary: "编辑 1 文件", files: [], stage: "ai-code-generation" },
      CFG,
    );
    expect(r.desc).toBeNull();
    expect(r.source).toBe("rule");
  });

  it("LLM 可用：一次批量调用覆盖全部 Task，descSource=llm", async () => {
    const inputs = [1, 2, 3].map((i) => ({
      taskId: `T${i}`,
      promptText: `需求 ${i}`,
      systemTemplate: false,
      templateLabel: null,
      agentMessage: null,
      behaviorSummary: "编辑 1 文件",
      files: [],
      stage: "ai-code-generation" as StageId,
    }));
    const llm = createMockLlmPort({
      responses: {
        "task-desc-v1": (spec) => {
          const payload = spec.input as { tasks: Array<{ id: string }> };
          return { tasks: payload.tasks.map((t) => ({ id: t.id, desc: `归纳-${t.id}`, taskType: "feature" })) };
        },
      },
    });
    const res = await generateDescs(inputs, llm, CFG);
    expect(res.llmCalls).toBe(1); // 批量：不是每 Task 一次
    expect(res.fallbackCount).toBe(0);
    expect(res.results.get("T1")?.desc).toBe("归纳-T1");
    expect(res.results.get("T1")?.source).toBe("llm");
    expect(res.results.get("T1")?.taskType).toBe("feature");
  });

  it("LLM 不可用 → 全部降级，不抛异常", async () => {
    const inputs = [{
      taskId: "T1", promptText: "需求", systemTemplate: false, templateLabel: null,
      agentMessage: null, behaviorSummary: "x", files: [], stage: "ai-code-generation" as StageId,
    }];
    const res = await generateDescs(inputs, createNullLlmPort(), CFG);
    expect(res.llmCalls).toBe(0);
    expect(res.fallbackCount).toBe(1);
    expect(res.results.get("T1")?.source).toBe("prompt");
  });

  it("LLM 返回非法 schema → 该批降级，不抛异常", async () => {
    const inputs = [{
      taskId: "T1", promptText: "需求", systemTemplate: false, templateLabel: null,
      agentMessage: null, behaviorSummary: "x", files: [], stage: "ai-code-generation" as StageId,
    }];
    const llm = createMockLlmPort({ responses: { "task-desc-v1": { wrong: 1 } } });
    const res = await generateDescs(inputs, llm, CFG);
    expect(res.fallbackCount).toBe(1);
    expect(res.results.get("T1")?.source).toBe("prompt");
  });
});

// ───────────────────────── 文件聚合 / 摘要 / 度量 ─────────────────────────

describe("files · 聚合与摘要", () => {
  it("aggregateFiles 汇总动作与角色", () => {
    const files = aggregateFiles([
      edit(1000, "src/a.ts", "source", "ai"),
      edit(2000, "src/a.ts", "source", "dev"),
      b({ ts: 3000, action: "file.scroll", object: { kind: "file", uri: "src/a.ts", role: "source", lineRange: [1, 40] } }),
    ]);
    expect(files).toHaveLength(1);
    expect(files[0]!.actions).toContain("edit");
    expect(files[0]!.actions).toContain("file.scroll");
    expect(files[0]!.aiLines).toBe(1);
    expect(files[0]!.devLines).toBe(1);
    expect(files[0]!.touchedLines).toBeGreaterThan(40);
  });

  it("behaviorSummary 恒非空（Desc 为 null 时的 UI 兜底）", () => {
    expect(buildBehaviorSummary([])).toBe("无行为记录");
    expect(buildBehaviorSummary([b({ ts: 1 })])).toBeTruthy();
    const s = buildBehaviorSummary([edit(1000, "src/a.ts"), testCmd(2000), prompt(3000, "hi")]);
    expect(s).toContain("编辑 1 文件");
    expect(s).toContain("提交 1 条 prompt");
  });

  it("computeMetrics：aiRatio 与 dev/ai 计数", () => {
    const m = computeMetrics([edit(1000, "a", "source", "ai"), edit(2000, "a", "source", "ai"), prompt(3000, "hi")], []);
    expect(m.behaviorCount).toBe(3);
    expect(m.aiBehaviors).toBe(2);
    expect(m.devBehaviors).toBe(1);
    expect(m.aiRatio).toBeCloseTo(2 / 3, 3);
    expect(m.promptCount).toBe(1);
  });
});

// ───────────────────────── T6 TaskGraph 组装 ─────────────────────────

describe("build · TaskGraph", () => {
  const sample: Behavior[] = [
    b({ ts: 1000, action: "file.open", object: { kind: "file", uri: "README.md", role: "unknown" } }),
    prompt(2000, "我准备为仓库添加 E-AC-3 支持"),
    ...series(5, 3000, 1000, () => ({ action: "agent.tool" as const, actor: "ai" as const })),
    edit(9000, "src/a.ts", "source", "ai"),
    prompt(20_000, "现在跑一下测试"),
    testCmd(21_000, "cargo test --lib", "dev", 0),
    prompt(30_000, "人工dev验证结果：可以出声了"),
    ...series(5, 31_000, 1000, () => ({ action: "agent.tool" as const, actor: "ai" as const })),
  ];

  it("结构完整：七阶段全量、无 unassigned、spans 权重归一", async () => {
    const g = await buildTaskGraph({ prId: "pr-1", behaviors: sample, llm: createNullLlmPort() });
    expect(g.stages).toHaveLength(7);
    expect(g.unassigned).toHaveLength(0);
    expect(g.tasks.length).toBeGreaterThan(0);
    for (const t of g.tasks) {
      const sum = t.spans.reduce((s, x) => s + x.weight, 0);
      expect(sum).toBeCloseTo(1, 2);
      expect(t.behaviorSummary).toBeTruthy(); // 恒非空
      expect(t.id).toBe(`pr-1-T${t.seq}`);
    }
  });

  it("LLM 不可用时全部走规则降级，且 diagnostics 如实记录", async () => {
    const g = await buildTaskGraph({ prId: "pr-1", behaviors: sample, llm: createNullLlmPort() });
    expect(g.diagnostics.llmCalls).toBe(0);
    expect(g.diagnostics.llmFallbackCount).toBe(g.tasks.length);
    expect(Object.keys(g.diagnostics.descSourceDist).length).toBeGreaterThan(0);
  });

  it("LLM 可用时 descSource=llm 且 llmCalls>0", async () => {
    const llm = createMockLlmPort({
      responses: {
        "task-desc-v1": (spec) => {
          const p = spec.input as { tasks: Array<{ id: string }> };
          return { tasks: p.tasks.map((t) => ({ id: t.id, desc: `归纳-${t.id}`, taskType: "feature" })) };
        },
      },
    });
    const g = await buildTaskGraph({ prId: "pr-1", behaviors: sample, llm });
    expect(g.diagnostics.llmCalls).toBe(1);
    expect(g.tasks.every((t) => t.descSource === "llm")).toBe(true);
  });

  it("每个 Behavior 恰好归属一个 Task（无重无漏）", async () => {
    const g = await buildTaskGraph({ prId: "pr-1", behaviors: sample, llm: createNullLlmPort() });
    const all = g.tasks.flatMap((t) => t.bs);
    expect(all).toHaveLength(sample.length);
    expect(new Set(all).size).toBe(sample.length);
  });

  it("空输入产出空图且不崩溃", async () => {
    const g = await buildTaskGraph({ prId: "pr-1", behaviors: [], llm: createNullLlmPort() });
    expect(g.tasks).toHaveLength(0);
    expect(g.stages.every((s) => !s.present)).toBe(true);
  });
});

// ───────────────────────── T7 分析插件 ─────────────────────────

describe("process · 分析插件（D-017）", () => {
  const graphOf = async () =>
    buildTaskGraph({
      prId: "pr-1",
      behaviors: [
        prompt(1000, "加功能"),
        ...series(8, 2000, 1000, () => ({ action: "agent.tool" as const, actor: "ai" as const })),
        edit(11_000, "src/a.ts", "source", "ai"),
      ],
      llm: createNullLlmPort(),
    });

  it("ai-involvement：输出光谱点与均值", async () => {
    const g = await graphOf();
    const v = createAiInvolvementLayer().compute(g, []);
    const d = v.data as { points: unknown[]; avgAiRatio: number };
    expect(d.points.length).toBe(g.tasks.length);
    expect(d.avgAiRatio).toBeGreaterThanOrEqual(0);
    expect(v.summary).toContain("AI 平均参与");
  });

  it("collab-pattern：AI 主导且人工编辑少 → 巡航式", async () => {
    const g = await graphOf();
    const v = createCollabPatternLayer().compute(g, []);
    const d = v.data as { pattern: string };
    expect(d.pattern).toBe("cruise");
  });

  it("插件抛异常被隔离：其他图层不受影响（架构 §3.3 纪律）", async () => {
    const g = await graphOf();
    const broken = {
      id: "broken",
      name: { "zh-CN": "坏图层", "en-US": "Broken" },
      renderAs: "panel" as const,
      compute() {
        throw new Error("boom");
      },
    };
    const reg = createAnalyticRegistry([broken, createAiInvolvementLayer()]);
    const views = reg.runAll(g, []);
    expect(views).toHaveLength(2);
    expect(views[0]!.data).toBeNull();
    expect(views[0]!.warnings?.[0]).toBe("boom");
    expect(views[1]!.data).not.toBeNull(); // 第二个图层正常
  });
});

// 局部辅助
function reviewPromptSig(ts: number): Behavior {
  return prompt(ts, "Perform an independent adversarial review", "review_child_review_x");
}
