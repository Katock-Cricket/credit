/**
 * MetricContext（算法 §1.2）：所有计算器的唯一输入。
 *
 * **共享组件懒加载**：只有被某指标请求时才计算，同 PR 内只算一次。
 * - 同步：`stages/tasks/testRuns/reading/coreDiff/prompts`（纯计算）
 * - 异步：`specDocs/testCases/rtm`（涉及 fs 读文件与 LLM）
 *
 * **P2pre 复用**：`stages()`/`tasks()` 直接取 `TaskGraph`（C1/C2 产物），
 * `testRuns()` 取 P2-pre 的测试运行识别（C6）—— 不重复实现。
 */
import type { Behavior } from "@credit/protocol";
import type { StageSegment, Task, TaskGraph } from "../task/types.js";
import type { TestRun } from "../task/testrun.js";
import type { LlmPort } from "../llm/port.js";
import { buildReadingTrace } from "../shared/reading.js";
import { buildCoreDiff } from "../shared/core-diff.js";
import { loadSpecDocs, collectSpecUris, isTestUri } from "../shared/spec-docs.js";
import { collectFileUris, resolveGitUri, normUri, canonicalUri } from "../shared/uri.js";
import { buildRtm, extractTestCases, type TestCaseRef } from "../shared/rtm.js";
import { buildSpecQuality, type SpecQualityJudgement } from "../shared/spec-quality.js";
import { extractPrKeywords } from "../profile/pr-keywords.js";
import type { DevProfile } from "../profile/types.js";
import type {
  CoreDiffLineSet,
  FsPort,
  GitDiffSnapshot,
  GitPort,
  ReadingTraceIndex,
  RtmMatrix,
  SpecDoc,
} from "./types.js";
import { mergeCreditConfig, type CreditConfig } from "./config.js";

/** Dev Prompt 与其后最近一条 AI 回复配成的对话轮（算法 §3.1.3） */
export interface PromptTurn {
  id: string;
  ts: number;
  promptText: string;
  messageId?: string;
  messageText?: string;
  messageTs?: number;
}

/** 按时间序配对：每条 prompt 取其后第一条 agent.message */
export function buildPromptTurns(behaviors: Behavior[]): PromptTurn[] {
  const sorted = [...behaviors].sort((a, b) => a.ts - b.ts);
  const msgs = sorted
    .filter((b) => b.action === "agent.message")
    .map((b) => ({
      id: b.id,
      ts: b.ts,
      text: String(b.context?.promptText ?? b.context?.output ?? ""),
    }));

  const turns: PromptTurn[] = [];
  for (const b of sorted) {
    if (b.action !== "prompt.submit") continue;
    const text = String(b.context?.promptText ?? "");
    if (!text) continue;
    const next = msgs.find((m) => m.ts >= b.ts);
    turns.push({
      id: b.id,
      ts: b.ts,
      promptText: text,
      messageId: next?.id,
      messageText: next?.text,
      messageTs: next?.ts,
    });
  }
  return turns;
}

export interface MetricContext {
  prId: string;
  behaviors: Behavior[];
  taskGraph: TaskGraph;
  gitDiff: GitDiffSnapshot;
  llm: LlmPort;
  git: GitPort | null;
  fs: FsPort | null;
  config: CreditConfig;
  /** Dev_Profile（P3）；null = Dev_Credit 整组不适用（引擎前置） */
  profile: DevProfile | null;
  /** 可写的诊断计数（LLM 调用次数等，供 diagnostics） */
  stats: { llmCalls: number; llmFallback: number };

  // 同步（P2-pre 产物 + 纯计算）
  stages(): StageSegment[];
  tasks(): Task[];
  testRuns(): TestRun[];
  reading(): ReadingTraceIndex;
  coreDiff(): CoreDiffLineSet;
  prompts(): PromptTurn[];
  /** 测试相关文件 uri（含内联测试的源码文件） */
  testUris(): string[];

  // 异步（fs / LLM）
  specDocs(): Promise<SpecDoc[]>;
  testCases(): Promise<TestCaseRef[]>;
  rtm(): Promise<RtmMatrix>;
  /**
   * SPEC 质量的共享判定（完整性 / 一致性 / 可验证性**一次调用**产出）。
   * 三个计算器共享它 —— 避免同一份 SPEC 上传三遍。
   */
  specQuality(): Promise<SpecQualityJudgement>;
  /**
   * 当前 PR 关键词（P3，D-042 共享槽）：熟练度 / 行数档计分与 F2 增量更新共用。
   * **仅 profile 存在时才会被消费**（懒加载），否则永不触发 LLM。
   */
  profileKeywords(): Promise<string[]>;
}

export interface CreateContextOptions {
  prId: string;
  behaviors: Behavior[];
  taskGraph: TaskGraph;
  gitDiff?: GitDiffSnapshot;
  testRuns?: TestRun[];
  llm: LlmPort;
  git?: GitPort | null;
  fs?: FsPort | null;
  config?: Partial<CreditConfig>;
  profile?: DevProfile | null;
}

export function createContext(opts: CreateContextOptions): MetricContext {
  const behaviors = [...opts.behaviors].sort((a, b) => a.ts - b.ts);
  const cfg = mergeCreditConfig(opts.config);
  const gitDiff: GitDiffSnapshot =
    opts.gitDiff ?? { available: false, files: null, commitCount: 0 };

  // ── 懒加载缓存 ──
  let _reading: ReadingTraceIndex | null = null;
  let _coreDiff: CoreDiffLineSet | null = null;
  let _prompts: PromptTurn[] | null = null;
  let _specs: Promise<SpecDoc[]> | null = null;
  let _testCases: Promise<TestCaseRef[]> | null = null;
  let _rtm: Promise<RtmMatrix> | null = null;
  let _specQuality: Promise<SpecQualityJudgement> | null = null;
  let _profileKeywords: Promise<string[]> | null = null;
  let _testUris: string[] | null = null;

  const gitFiles = gitDiff.files?.map((f) => f.uri) ?? [];

  const testUris = (): string[] => {
    if (_testUris) return _testUris;
    // **按归一化 uri 去重**：同一文件在宿主里有多种形态（大小写 / 相对 / inmemory），
    // 不去重会把同一个文件算多遍，也会让"是否命中"的判断变得随机
    const set = new Map<string, string>();
    const add = (u: string) => {
      if (!u) return;
      const n = normUri(u);
      if (!set.has(n)) set.set(n, canonicalUri(u));
    };

    for (const b of behaviors) {
      if (b.object?.kind === "file" && b.object.uri && isTestUri(b.object.uri)) add(b.object.uri);
    }
    // git 输出相对路径，需解析回 behaviors 的 uri 形态（否则与阅读轨迹对不上）
    const known = collectFileUris(behaviors);
    for (const u of gitFiles) {
      const abs = resolveGitUri(u, known);
      if (isTestUri(abs)) add(abs);
      // 内联测试（Rust #[cfg(test)]、Go _test.go）：diff 触及的源码文件也纳入
      if (/\.(rs|go|py)$/i.test(abs)) add(abs);
    }
    _testUris = [...set.values()];
    return _testUris;
  };

  const ctx: MetricContext = {
    prId: opts.prId,
    behaviors,
    taskGraph: opts.taskGraph,
    gitDiff,
    llm: opts.llm,
    git: opts.git ?? null,
    fs: opts.fs ?? null,
    config: cfg,
    profile: opts.profile ?? null,
    stats: { llmCalls: 0, llmFallback: 0 },

    stages: () => opts.taskGraph.stages,
    tasks: () => opts.taskGraph.tasks,
    // C6 复用 P2-pre 的 `detectTestRuns`（TaskGraph 不含 testRuns，由调用方算好传入）
    testRuns: () => opts.testRuns ?? [],
    testUris,

    reading: () => {
      if (!_reading) _reading = buildReadingTrace(behaviors, cfg.reading);
      return _reading;
    },
    coreDiff: () => {
      if (!_coreDiff) _coreDiff = buildCoreDiff(gitDiff, behaviors, cfg.diff);
      return _coreDiff;
    },
    prompts: () => {
      if (!_prompts) _prompts = buildPromptTurns(behaviors);
      return _prompts;
    },

    specDocs: () => {
      if (!_specs) {
        const uris = collectSpecUris(behaviors, gitFiles, {
          filePatterns: cfg.spec.filePatterns,
          excludePatterns: cfg.spec.excludePatterns,
          minContentChars: cfg.spec.minContentChars,
        });
        _specs = loadSpecDocs(uris, opts.fs ?? null, {
          filePatterns: cfg.spec.filePatterns,
          excludePatterns: cfg.spec.excludePatterns,
          minContentChars: cfg.spec.minContentChars,
        });
      }
      return _specs;
    },

    testCases: () => {
      if (!_testCases) {
        _testCases = (async () => {
          const out: TestCaseRef[] = [];
          for (const uri of testUris()) {
            const content = opts.fs ? await opts.fs.readFile(uri) : null;
            if (content == null) continue;
            out.push(...extractTestCases(content, uri));
          }
          return out;
        })();
      }
      return _testCases;
    },

    rtm: () => {
      if (!_rtm) {
        _rtm = (async () => {
          const specs = await ctx.specDocs();
          return buildRtm({
            specs,
            testUris: testUris(),
            fs: opts.fs ?? null,
            llm: opts.llm,
            taskIds: opts.taskGraph.tasks.map((t) => t.id),
            gitFiles,
          });
        })();
      }
      return _rtm;
    },

    specQuality: () => {
      if (!_specQuality) {
        _specQuality = (async () => {
          const specs = await ctx.specDocs();
          ctx.stats.llmCalls++; // 共享调用同样计入（三个维度只算这一次）
          const q = await buildSpecQuality({
            specs,
            llm: opts.llm,
            itemIds: specs.flatMap((s) => s.items.map((i) => i.id)),
          });
          if (!q.ok) ctx.stats.llmFallback++;
          return q;
        })();
      }
      return _specQuality;
    },

    profileKeywords: () => {
      if (!_profileKeywords) {
        _profileKeywords = (async () => {
          ctx.stats.llmCalls++; // D-042：每 PR 只提取一次，计分与 F2 增量更新共享
          const r = await extractPrKeywords({
            tasks: opts.taskGraph.tasks,
            gitDiff,
            llm: opts.llm,
          });
          if (!r.ok) ctx.stats.llmFallback++;
          return r.keywords;
        })();
      }
      return _profileKeywords;
    },
  };

  return ctx;
}
