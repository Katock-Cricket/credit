/**
 * P2 分析层测试（T2/T3/T5/T6）。
 *
 * 最关键的两条：
 * 1. **聚合重分配**（算法 §6.1）—— pending/excluded 的权重必须不进分母，
 *    写错一个分母分数仍落在 0–100，肉眼完全看不出来；
 * 2. **引擎冒烟**—— 32 个计算器全部跑一遍，确保没有一个会抛异常。
 */
import { describe, it, expect } from "vitest";
import type { Behavior } from "@credit/protocol";
import type { RuleNode } from "@credit/rules";
import { PR_CREDIT_TREE, leaves } from "@credit/rules";
import { createNullLlmPort, createMockLlmPort } from "../llm/index.js";
import { buildTaskGraph } from "../task/build.js";
import { parseUnifiedDiff, isMeaningfulLine } from "../shared/diff-parser.js";
import { matchGlob, buildCoreDiff } from "../shared/core-diff.js";
import { aggregateGroup, aggregateRoot, bandOf } from "./aggregate.js";
import { createContext } from "./context.js";
import { genStaged } from "../metrics/gen-staged.js";
import { genAcceptLines } from "../metrics/gen-accept-lines.js";
import { genVerifyCursorNc } from "../metrics/gen-verify-cursor-nc.js";
import { computeCredit, inputFingerprint } from "./compute.js";
import { buildReadingTrace, traceOf } from "../shared/reading.js";
import { normUri, resolveGitUri } from "../shared/uri.js";
import { extractTestCases } from "../shared/rtm.js";
import { parseLooseJson } from "../llm/openai-compatible.js";
import type { GitDiffSnapshot, MetricResult, ResultNode } from "./types.js";

// ───────────────────────── 工具 ─────────────────────────

let seq = 0;
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

const prompt = (ts: number, text: string): Behavior =>
  b({
    ts,
    action: "prompt.submit",
    object: { kind: "dialog", uri: "sess-1" },
    context: { promptText: text, sessionId: "sess-1", fidelity: "frontend" },
  });

const edit = (ts: number, uri: string, actor: "dev" | "ai" = "ai"): Behavior =>
  b({
    ts,
    actor,
    action: "edit",
    object: { kind: "file", uri, role: "source", lineRange: [10, 20] },
    context: { before: "a", after: "b", fidelity: "frontend" },
  });

const scroll = (ts: number, uri: string, lines: [number, number], dwell = 800): Behavior =>
  b({
    ts,
    action: "file.scroll",
    object: { kind: "file", uri, role: "source", lineRange: lines },
    context: { dwellMs: dwell, fidelity: "frontend" },
  });

const testCmd = (ts: number, cmd = "cargo test --lib", exitCode = 0): Behavior =>
  b({
    ts,
    action: "terminal.exec",
    object: { kind: "terminal", uri: "proc-1" },
    context: { cmd, exitCode, output: "test result: ok. 5 passed; 0 failed", fidelity: "frontend" },
  });

/** 构造一个最小 ResultNode（聚合器单测用） */
function node(id: string, r: Partial<MetricResult>): ResultNode {
  return {
    node: { id, name: { "zh-CN": id, "en-US": id }, level: "L4" } as unknown as RuleNode,
    result: {
      id,
      status: "ok",
      score: 0,
      weight: 1,
      detail: "",
      evidence: [],
      ...r,
    } as MetricResult,
  };
}

const groupNode = { id: "g", name: { "zh-CN": "g", "en-US": "g" }, level: "L3" } as unknown as RuleNode;

// ───────────────────────── T2 · 共享组件 ─────────────────────────

describe("diff-parser", () => {
  it("解析 -U0 输出，提取新增行号与内容", () => {
    const patch = [
      "diff --git a/src/a.rs b/src/a.rs",
      "--- a/src/a.rs",
      "+++ b/src/a.rs",
      "@@ -5,0 +10,2 @@",
      "+fn main() {",
      "+}",
      "diff --git a/src/b.rs b/src/b.rs",
      "--- a/src/b.rs",
      "+++ b/src/b.rs",
      "@@ -1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n");

    const files = parseUnifiedDiff(patch);
    expect(files).toHaveLength(2);
    expect(files[0]!.uri).toBe("src/a.rs");
    expect(files[0]!.addedLines).toEqual([10, 11]);
    expect(files[0]!.addedTexts[0]).toBe("fn main() {");
    expect(files[1]!.totalDeleted).toBe(1);
  });

  it("空行与纯符号行不算有意义内容", () => {
    expect(isMeaningfulLine("")).toBe(false);
    expect(isMeaningfulLine("   ")).toBe(false);
    expect(isMeaningfulLine("}{")).toBe(false);
    expect(isMeaningfulLine("let x = 1;")).toBe(true);
  });
});

describe("C5 core-diff", () => {
  it("排除产物文件并对新增行做行级过滤", () => {
    expect(matchGlob("pnpm-lock.yaml", "**/*.lock")).toBe(false); // .yaml 不匹配 .lock
    expect(matchGlob("dist/a.js", "**/dist/**")).toBe(true);
    expect(matchGlob("src/a.min.js", "**/*.min.*")).toBe(true);

    const git: GitDiffSnapshot = {
      available: true,
      files: [
        { uri: "src/a.rs", added: 3, deleted: 0, addedLines: [1, 2, 3], addedTexts: ["fn a()", "", "}"] },
        { uri: "dist/b.js", added: 100, deleted: 0, addedLines: [1], addedTexts: ["x"] },
      ],
      commitCount: 2,
    };

    const cd = buildCoreDiff(git, [edit(1000, "src/a.rs", "dev")], {
      coreFileExcludePatterns: ["**/dist/**", "**/*.min.*"],
    });

    expect(cd.files["dist/b.js"]).toBeUndefined(); // 产物被排除
    expect(cd.files["src/a.rs"]!.coreNewLines).toEqual([1]); // 只有 "fn a()" 有意义
    expect(cd.totalCoreNew).toBe(1);
  });

  it("git 不可用 → 空集且不抛错（绝不伪造）", () => {
    const cd = buildCoreDiff(
      { available: false, files: null, commitCount: 0 },
      [],
      { coreFileExcludePatterns: [] },
    );
    expect(cd.totalCoreNew).toBe(0);
    expect(cd.files).toEqual({});
  });

  it("Dev 编辑过的行从 AI 行集中移出", () => {
    const git: GitDiffSnapshot = {
      available: true,
      files: [{ uri: "src/a.rs", added: 2, deleted: 0, addedLines: [10, 11], addedTexts: ["a", "b"] }],
      commitCount: 1,
    };
    const behaviors = [
      b({ ts: 1000, actor: "ai", action: "edit", object: { kind: "file", uri: "src/a.rs", lineRange: [10, 11] } }),
      b({ ts: 2000, actor: "dev", action: "edit", object: { kind: "file", uri: "src/a.rs", lineRange: [10, 10] } }),
    ];
    const cd = buildCoreDiff(git, behaviors, { coreFileExcludePatterns: [] });
    expect(cd.aiLines["src/a.rs"]).toEqual([11]); // 10 被 Dev 改过 → 移出
    expect(cd.devEditedLines["src/a.rs"]).toEqual([10]);
  });
});

describe("C4 reading", () => {
  it("合并阅读行区间并累计 dwell", () => {
    const idx = buildReadingTrace(
      [scroll(1000, "src/a.rs", [1, 10], 800), scroll(2000, "src/a.rs", [5, 15], 1200)],
      { readDwellMs: 500 },
    );
    const t = idx.byUri["src/a.rs"]!;
    expect(t.dwellMs).toBe(2000);
    expect(t.readLines).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(idx.scrollAvailable).toBe(true);
  });

  it("无滚动事件 → scrollAvailable=false（调用方须据此降级）", () => {
    const idx = buildReadingTrace([], { readDwellMs: 500 });
    expect(idx.scrollAvailable).toBe(false);
  });
});

// ───────────────────────── T5 · 聚合器 ─────────────────────────

describe("聚合器（算法 §6.1）", () => {
  it("只统计 ok/degraded，pending 与 excluded 的权重不进分母（重分配）", () => {
    const children = [
      node("a", { status: "ok", score: 100 }),
      node("b", { status: "degraded", score: 50 }),
      node("c", { status: "pending", score: null }),
      node("d", { status: "excluded", score: null }),
    ];
    const r = aggregateGroup(groupNode, children);
    // (100 + 50) / 2 = 75，而不是 /4 = 37.5
    expect(r.score).toBe(75);
    expect(r.status).toBe("ok");
  });

  it("excluded_no_evidence 同样重分配（人工测试无证据不该拉低总分）", () => {
    const children = [
      node("a", { status: "ok", score: 80 }),
      node("b", { status: "excluded_no_evidence", score: null }),
    ];
    expect(aggregateGroup(groupNode, children).score).toBe(80);
  });

  it("组内全非计分 → 状态向上传递（pending 优先于 excluded）", () => {
    const r = aggregateGroup(groupNode, [
      node("a", { status: "excluded", score: null }),
      node("b", { status: "pending", score: null }),
    ]);
    expect(r.status).toBe("pending");
    expect(r.score).toBeNull();
  });

  it("error 子节点不进分母（按算法 §6.1，非计分）", () => {
    const r = aggregateGroup(groupNode, [
      node("a", { status: "ok", score: 60 }),
      node("b", { status: "error", score: 0 }),
    ]);
    expect(r.score).toBe(60);
  });

  it("权重生效", () => {
    const r = aggregateGroup(groupNode, [
      node("a", { status: "ok", score: 100, weight: 3 }),
      node("b", { status: "ok", score: 0, weight: 1 }),
    ]);
    expect(r.score).toBe(75);
  });
});

describe("PR_Credit 聚合（决策 D-028）", () => {
  const proc = { ...node("procCredits", { status: "ok", score: 66.8 }), node: { ...groupNode, id: "procCredits" } };

  it("Dev 缺失 → PR_Credit = Proc_Credits", () => {
    const dev = { ...node("devCredit", { status: "excluded", score: null }), node: { ...groupNode, id: "devCredit" } };
    const r = aggregateRoot(groupNode, [proc as ResultNode, dev as ResultNode], {
      procWeight: 0.8,
      devWeight: 0.2,
    });
    expect(r.score).toBe(66.8);
    expect(r.detail).toContain("Dev_Credit 缺失");
  });

  it("Dev 可用 → 0.8 × Proc + 0.2 × Dev（P3 接入即生效，防死代码）", () => {
    const dev = { ...node("devCredit", { status: "ok", score: 60 }), node: { ...groupNode, id: "devCredit" } };
    const r = aggregateRoot(groupNode, [proc as ResultNode, dev as ResultNode], {
      procWeight: 0.8,
      devWeight: 0.2,
    });
    // 0.8 × 66.8 + 0.2 × 60 = 53.44 + 12 = 65.44
    expect(r.score).toBe(65.44);
  });
});

describe("四档映射（算法 §6.2）", () => {
  it("边界值", () => {
    expect(bandOf(0).band).toBe("blind");
    expect(bandOf(39.9).band).toBe("blind");
    expect(bandOf(40).band).toBe("selective");
    expect(bandOf(59.9).band).toBe("selective");
    expect(bandOf(60).band).toBe("verified");
    expect(bandOf(79.9).band).toBe("verified");
    expect(bandOf(80).band).toBe("mastered");
    expect(bandOf(100).band).toBe("mastered");
  });
});

// ───────────────────────── T3/T4 · 引擎 ─────────────────────────

describe("引擎（T3/T4）", () => {
  it("全树跑通：32 个计算器无一抛异常，且结构完整", async () => {
    const behaviors = [
      prompt(1000, "实现功能 A，必须遵循现有架构"),
      edit(2000, "src/a.rs", "ai"),
      scroll(3000, "src/a.rs", [10, 20], 1000),
      testCmd(4000),
      prompt(5000, "补充测试用例，覆盖边界"),
    ];
    const g = await buildTaskGraph({ prId: "pr-1", behaviors, llm: createNullLlmPort() });
    const r = await computeCredit({ prId: "pr-1", behaviors, taskGraph: g, llm: createNullLlmPort() });

    // 结构完整
    expect(r.v).toBe("1.0");
    expect(r.tree.children).toHaveLength(2);
    // 无异常（NullLlmPort 应走 degraded 而非 error）
    expect(r.diagnostics.errorIds).toEqual([]);
    // 分数合法
    expect(r.summary.prCredit).toBeGreaterThanOrEqual(0);
    expect(r.summary.prCredit).toBeLessThanOrEqual(100);
    // Dev_Credit 恒缺失（D-028/D-032）
    expect(r.summary.devCredit).toBeNull();
  });

  it("LLM 未配置 → 相关指标 degraded 保守分，而不是 0 分的 error（不惩罚没配 key）", async () => {
    const behaviors = [prompt(1000, "实现功能")];
    const g = await buildTaskGraph({ prId: "pr-1", behaviors, llm: createNullLlmPort() });
    const r = await computeCredit({ prId: "pr-1", behaviors, taskGraph: g, llm: createNullLlmPort() });
    expect(r.diagnostics.errorIds).toEqual([]);
    // 依赖 LLM 的指标应进入 degraded 列表
    const degraded = r.diagnostics.degradedIds;
    expect(degraded.length).toBeGreaterThan(0);
  });

  it("组级前置：无 SPEC 文档 → SPEC工程整组 excluded（且子节点不计算）", async () => {
    const behaviors = [prompt(1000, "实现功能"), edit(2000, "src/a.rs", "ai")];
    const g = await buildTaskGraph({ prId: "pr-1", behaviors, llm: createNullLlmPort() });
    const r = await computeCredit({ prId: "pr-1", behaviors, taskGraph: g, llm: createNullLlmPort() });

    const prep = r.tree.children!.find((c) => c.node.id === "procCredits")!
      .children!.find((c) => c.node.id === "prep")!;
    const spec = prep.children!.find((c) => c.node.id === "spec")!;
    expect(spec.result.status).toBe("excluded");
    // 子节点全部 excluded
    for (const c of spec.children ?? []) {
      expect(c.result.status).toBe("excluded");
    }
  });

  it("六个桩恒为 pending 且不伪造分数（D-029）", async () => {
    const behaviors = [prompt(1000, "实现功能"), edit(2000, "src/a.rs", "ai"), testCmd(3000)];
    const g = await buildTaskGraph({ prId: "pr-1", behaviors, llm: createNullLlmPort() });
    const r = await computeCredit({ prId: "pr-1", behaviors, taskGraph: g, llm: createNullLlmPort() });

    const flat: ResultNode[] = [];
    const walk = (n: ResultNode) => {
      flat.push(n);
      for (const c of n.children ?? []) walk(c);
    };
    walk(r.tree);

    const stubs = leaves(PR_CREDIT_TREE).filter((n) => n.stub).map((n) => n.id);
    for (const id of stubs) {
      const hit = flat.find((n) => n.node.id === id);
      // 若所在组被 excluded（如测试组无数据）也是合理的，但绝不能出现"有分数"
      if (hit && hit.result.status !== "excluded") {
        expect(hit.result.status, `${id} 应为 pending`).toBe("pending");
        expect(hit.result.score).toBeNull();
      }
    }
  });

  it("错误隔离：计算器抛异常只影响该指标", async () => {
    // 用 mock 返回一个会让计算器崩溃的结构（schema 通过了）
    const llm = createMockLlmPort({
      responses: { "spec-completeness-v1": { dims: "not-an-array" } },
    });
    const behaviors = [prompt(1000, "实现功能")];
    const g = await buildTaskGraph({ prId: "pr-1", behaviors, llm: createNullLlmPort() });
    const r = await computeCredit({ prId: "pr-1", behaviors, taskGraph: g, llm });
    // 整树仍能算完
    expect(r.summary.prCredit).toBeGreaterThanOrEqual(0);
    expect(r.tree.children).toHaveLength(2);
  });
});

// ─────────── 回归：uri 对齐 / Rust 测试识别 / 宽容 JSON（2026-09-07 实测暴露） ───────────

describe("uri 归一化（回归：git 相对路径 vs behaviors 绝对路径）", () => {
  it("归一化 file:// 编码、分隔符与大小写", () => {
    expect(normUri("D:\\Workspace\\X\\src\\a.rs")).toBe("d:/workspace/x/src/a.rs");
    expect(normUri("file:///d%3A/Workspace/X/README.md")).toBe("d:/workspace/x/readme.md");
  });

  it("git 相对路径解析回 behaviors 的绝对 uri；无法解析则原样返回", () => {
    const known = ["D:/Workspace/MusicStorm/src-tauri/src/codec_probe.rs"];
    expect(resolveGitUri("src-tauri/src/codec_probe.rs", known)).toBe(known[0]);
    expect(resolveGitUri("other/x.rs", known)).toBe("other/x.rs");
  });

  it("**回归**：key 对齐后阅读覆盖不再恒为 0（初版 0/303 的根因）", () => {
    const git: GitDiffSnapshot = {
      available: true,
      files: [
        { uri: "src/a.rs", added: 3, deleted: 0, addedLines: [10, 11, 12], addedTexts: ["a", "b", "c"] },
      ],
      commitCount: 1,
    };
    const abs = "D:/proj/src/a.rs";
    const behaviors = [scroll(1000, abs, [10, 12], 900)];
    const cd = buildCoreDiff(git, behaviors, { coreFileExcludePatterns: [] });
    // key 必须已对齐为 behaviors 的形态，否则 traceOf 查不到
    expect(cd.files[abs]).toBeDefined();
    const idx = buildReadingTrace(behaviors, { readDwellMs: 500 });
    const core = new Set(cd.files[abs]!.coreNewLines);
    // 必须走 traceOf：索引 key 是归一化的，直接 byUri[abs] 取不到
    expect(traceOf(idx, abs).readLines.filter((l) => core.has(l)).length).toBe(3);
  });
});

describe("Rust 测试识别（回归：测试函数名不含 test）", () => {
  it("`#[test]` 之后的 fn 被识别，不论名字是否含 test", () => {
    const src = [
      "pub fn probe_audio_codec_file() {}",
      "#[cfg(test)]",
      "mod tests {",
      "    #[test]",
      "    fn detects_eac3_file() { assert!(true); }",
      "    #[test]",
      "    fn missing_file_returns_unknown() {}",
      "}",
    ].join("\n");
    expect(extractTestCases(src, "src/x.rs").map((c) => c.name)).toEqual([
      "detects_eac3_file",
      "missing_file_returns_unknown",
    ]);
  });

  it("普通函数不被误判为测试", () => {
    const src = "pub fn probe() {}\nfn helper(x: u8) {}";
    expect(extractTestCases(src, "src/x.rs")).toEqual([]);
  });

  it("JS / Python / Go 仍正常识别", () => {
    expect(extractTestCases("test('adds', () => {})", "a.test.ts").map((c) => c.name)).toEqual(["adds"]);
    expect(extractTestCases("def test_foo():", "t.py").map((c) => c.name)).toEqual(["test_foo"]);
    expect(extractTestCases("func TestBar(t *testing.T) {}", "b.go").map((c) => c.name)).toEqual(["TestBar"]);
  });
});

describe("宽容 JSON 解析（回归：模型输出代码片段或带前缀文字）", () => {
  it("带说明文字时可提取 JSON", () => {
    expect(parseLooseJson('好的，结果如下：{"decisions":[{"decisionId":"D1"}]}')).toEqual({
      decisions: [{ decisionId: "D1" }],
    });
  });
  it("带 markdown 围栏也可", () => {
    expect(parseLooseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("纯代码片段 → null（救不回，应判 invalid-json 而不是崩溃）", () => {
    expect(parseLooseJson("rust struct CodecProbeResult { codec: String }")).toBeNull();
  });
});

// ───────────────────────── T6 · 指纹 ─────────────────────────

describe("输入指纹（T6）", () => {
  it("behaviors 条数 / TaskGraph 版本 / gitDiff 变化都会改变指纹", async () => {
    const behaviors = [prompt(1000, "实现功能")];
    const g = await buildTaskGraph({ prId: "pr-1", behaviors, llm: createNullLlmPort() });
    const base = inputFingerprint({ behaviors, taskGraph: g });

    expect(inputFingerprint({ behaviors: [...behaviors, prompt(2000, "再来")], taskGraph: g })).not.toBe(base);
    expect(
      inputFingerprint({
        behaviors,
        taskGraph: g,
        gitDiff: { available: true, files: [], commitCount: 1, head: "abc", base: "def" },
      }),
    ).not.toBe(base);
  });
});

// ───────── 大型修改分阶段施行（2026-09-08 改版：TODO 拆解与推进，而非 commit 数）─────────

/**
 * **为何改版**：原实现用"PR 期间 commit 数 ≥ 2"判定。但本指标考察的正是
 * **一次 commit 内部**的实施是否分阶段 —— 所有修改本就落在同一个 commit 里，
 * 该判据等于**恒判 0**。以下用例的 diff 全部 `commitCount: 1`，正是旧实现的盲区。
 */
describe("大型修改分阶段施行（改版）", () => {
  const node = leaves(PR_CREDIT_TREE).find((l) => l.id === "gen.staged")!;

  const todoWrite = (
    ts: number,
    todos: Array<{ id: string; content: string; status: string }>,
    toolName = "TodoWrite",
  ): Behavior =>
    b({
      ts,
      action: "agent.tool",
      actor: "ai",
      context: { toolName, toolInput: { todos }, fidelity: "frontend" } as never,
    });

  const diffOf = (added: number): GitDiffSnapshot => ({
    available: true,
    files: [{ uri: "src/a.ts", added, deleted: 0, addedLines: null, addedTexts: null }],
    commitCount: 1, // ← 关键：只有 1 次提交
  });

  async function ctxFor(behaviors: Behavior[], gd: GitDiffSnapshot = diffOf(300)) {
    const g = await buildTaskGraph({ prId: "pr-1", behaviors, llm: createNullLlmPort() });
    return createContext({
      prId: "pr-1",
      behaviors,
      taskGraph: g,
      gitDiff: gd,
      llm: createNullLlmPort(),
    });
  }

  it("小改动不适用 → 100", async () => {
    const r = await genStaged(await ctxFor([], diffOf(10)), node);
    expect(r.status).toBe("ok");
    expect(r.score).toBe(100);
  });

  it("拆解为多步并分批推进 → 100（即使仅 1 次 commit）", async () => {
    const bs = [
      todoWrite(1000, [
        { id: "1", content: "改 A", status: "in_progress" },
        { id: "2", content: "改 B", status: "pending" },
      ]),
      todoWrite(2000, [
        { id: "1", content: "改 A", status: "completed" },
        { id: "2", content: "改 B", status: "in_progress" },
      ]),
      todoWrite(3000, [
        { id: "1", content: "改 A", status: "completed" },
        { id: "2", content: "改 B", status: "completed" },
      ]),
    ];
    const r = await genStaged(await ctxFor(bs), node);
    expect(r.score).toBe(100);
  });

  it("列出清单后一次性全勾 → 0（拆了但不是按步骤施行）", async () => {
    const bs = [
      todoWrite(1000, [
        { id: "1", content: "改 A", status: "completed" },
        { id: "2", content: "改 B", status: "completed" },
      ]),
    ];
    const r = await genStaged(await ctxFor(bs), node);
    expect(r.score).toBe(0);
  });

  it("只拆 1 步 → 0（不构成拆解）", async () => {
    const bs = [
      todoWrite(1000, [{ id: "1", content: "改 A", status: "in_progress" }]),
      todoWrite(2000, [{ id: "1", content: "改 A", status: "completed" }]),
    ];
    const r = await genStaged(await ctxFor(bs), node);
    expect(r.score).toBe(0);
  });

  it("无 TODO 轨迹但对话中输出分步计划 → degraded（有拆解、无法验证施行）", async () => {
    const bs = [
      b({
        ts: 1000,
        action: "agent.message",
        actor: "ai",
        context: { promptText: "步骤1：改 A\n步骤2：改 B\n步骤3：验证" } as never,
      }),
    ];
    const r = await genStaged(await ctxFor(bs), node);
    expect(r.status).toBe("degraded");
  });

  it("完全无拆解证据 → 0", async () => {
    const r = await genStaged(await ctxFor([prompt(1000, "直接改")]), node);
    expect(r.status).toBe("ok");
    expect(r.score).toBe(0);
  });

  it("git 不可用 → degraded", async () => {
    const r = await genStaged(
      await ctxFor([], { available: false, files: null, commitCount: 0 }),
      node,
    );
    expect(r.status).toBe("degraded");
  });

  it("工具名走 config：换平台的 TODO 工具名同样识别", async () => {
    const bs = [
      todoWrite(
        1000,
        [
          { id: "1", content: "a", status: "in_progress" },
          { id: "2", content: "b", status: "pending" },
        ],
        "todo_write",
      ),
      todoWrite(
        2000,
        [
          { id: "1", content: "a", status: "completed" },
          { id: "2", content: "b", status: "completed" },
        ],
        "todo_write",
      ),
    ];
    const r = await genStaged(await ctxFor(bs), node);
    expect(r.score).toBe(100);
  });
});

/**
 * 「退出计分」= **规则树不注册**（不参与聚合）+ **实现保留**（数据层不删）。
 * 这两条必须同时断言：只测前者，可能有人把实现删了；只测后者，可能有人误加回规则树。
 */
describe("已退出 CREDIT 分数框架的指标（数据层保留、不再计分）", () => {
  const retired = [
    { id: "gen.acceptLines", fn: genAcceptLines, why: "D-033：真实 userAccept 未触发，恒 degraded" },
    { id: "gen.verify.cursorNc", fn: genVerifyCursorNc, why: "D-035：cursor 事件仅 4 条且 dwell 全 0，恒为 0" },
  ];

  for (const { id, fn, why } of retired) {
    it(`${id} 不再注册到规则树（${why}）`, () => {
      expect(leaves(PR_CREDIT_TREE).some((l) => l.id === id)).toBe(false);
    });
    it(`${id} 计算实现仍保留，可离线复用`, () => {
      expect(typeof fn).toBe("function");
    });
  }
});
