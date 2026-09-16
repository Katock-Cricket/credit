/**
 * P2 分析层核心类型（结果、证据、上下文输入）。
 *
 * **纪律**：计算器 = 纯函数 `(ctx, node) => Promise<MetricResult>`，
 * 不做直接 I/O；LLM / git / fs 一律经 ctx 注入的 Port（AGENTS §5.4），
 * 以便全离线单测。
 */
import type { MetricStatus, RuleNode } from "@credit/rules";

// ─────────────── 证据 ───────────────

export type Evidence =
  | { kind: "behavior"; ids: string[]; label: string }
  | { kind: "task"; ids: string[]; label: string }
  | { kind: "file"; uris: string[]; lines?: number[]; label: string }
  | { kind: "prompt"; ids: string[]; text: string }
  | { kind: "testrun"; ids: string[]; label: string }
  | { kind: "llm"; templateId: string; rationale: string }
  | { kind: "note"; text: string };

// ─────────────── 指标结果 ───────────────

export interface MetricResult {
  id: string;
  status: MetricStatus;
  /** 0–100；pending / excluded / error 为 null */
  score: number | null;
  weight: number;
  /** 人类可读的计算说明（UI 直接展示） */
  detail: string;
  evidence: Evidence[];
}

/** 结果树节点 = 树结构 + 本节点结果（group 的 score 由聚合器算出） */
export interface ResultNode {
  node: RuleNode;
  result: MetricResult;
  children?: ResultNode[];
}

// ─────────────── git / 共享组件产物 ───────────────

/** 单文件 diff 统计（GitPort 输出） */
export interface GitFileDiff {
  uri: string;
  added: number;
  deleted: number;
  /** 新增行的行号列表（1-based，位于新文件）；无 patch 解析时为 null */
  addedLines?: number[] | null;
  /**
   * 与 addedLines 一一对应的**行内容**。
   * C5 的行级过滤（剔除空行/纯符号行）需要它 —— 只有 numstat 计数无法过滤。
   */
  addedTexts?: string[] | null;
}

export interface GitDiffSnapshot {
  available: boolean;
  /** git 不可用 / 非仓库时为 null */
  files: GitFileDiff[] | null;
  /** `git log` 得到的本 PR 提交数（供"分阶段施行"） */
  commitCount: number;
  base?: string;
  head?: string;
}

/** C5 核心 Diff 行集（算法 §2.5） */
export interface CoreDiffLineSet {
  files: Record<string, { coreNewLines: number[]; totalAdded: number; totalDeleted: number }>;
  totalCoreNew: number;
  totalCoreAll: number;
  /** 被判定为 AI 生成（Accept 直收）且未被 Dev 后续修改的行 */
  aiLines: Record<string, number[]>;
  /** Dev 自己编辑且落在核心新增行内的行 */
  devEditedLines: Record<string, number[]>;
}

/** C4 阅读轨迹索引 */
export interface ReadingTrace {
  uri: string;
  /** 累计停留（ms） */
  dwellMs: number;
  /** 阅读过的行号集合（viewport 并集） */
  readLines: number[];
  /** 光标停留行（dwell ≥ 阈值） */
  cursorLines: number[];
}

export interface ReadingTraceIndex {
  byUri: Record<string, ReadingTrace>;
  /** textScrolled 事件数为 0 → viewport 不可用，只能以光标窗近似 */
  scrollAvailable: boolean;
}

/** C3 SPEC 文档 */
export interface SpecDoc {
  uri: string;
  content: string;
  /** 切分出的条目（按 Markdown 标题 / 编号列表） */
  items: Array<{ id: string; text: string }>;
}

/** C7 RTM 映射矩阵 */
export interface RtmMatrix {
  specItems: Array<{ id: string; text: string }>;
  testCases: Array<{ id: string; name: string; uri: string }>;
  /** specItemId → testCaseIds */
  specToTest: Record<string, string[]>;
  /** specItemId → taskId */
  specToTask: Record<string, string[]>;
  /** diff 文件 → 测试文件 */
  diffToTest: Record<string, string[]>;
  /** 有测试映射的条目 / 总条目 */
  specCoverage: number;
  /** LLM 是否可用（不可用则 coverage 为 0 且调用方按降级处理） */
  llmOk: boolean;
  /** 失败/跳过原因（用于 UI 与排障，避免只看到"LLM 不可用"四个字） */
  error?: string;
}

// ─────────────── 落盘结果 ───────────────

export type CreditBand = "blind" | "selective" | "verified" | "mastered";

export interface CreditResult {
  v: string;
  prId: string;
  generatedAt: number;
  generator: {
    rulesetVersion: string;
    llmModel: string | null;
    llmCalls: number;
    /** 输入指纹：behaviors 条数 + gitDiff 摘要 + TaskGraph 版本 */
    inputFingerprint: string;
  };
  tree: ResultNode;
  /**
   * P3 本地增量更新的数据源（D-041/D-042）：
   * `profileKeywords` 由熟练度计分共享提取（profile 未初始化时为 null）；
   * `aiCollabLines` = coreDiff.aiLines 总行数。
   */
  profileFeed?: { profileKeywords: string[] | null; aiCollabLines: number };
  summary: {
    prCredit: number;
    procCredits: number;
    devCredit: number | null;
    band: CreditBand;
    bandLabel: { "zh-CN": string; "en-US": string };
    overallComment: string;
  };
  diagnostics: {
    statusDist: Record<string, number>;
    llmFallbackCount: number;
    errorIds: string[];
    pendingIds: string[];
    degradedIds: string[];
    gitDiffAvailable: boolean;
  };
}

// ─────────────── Port ───────────────

export interface GitPort {
  /** 拉取 diff（含 staged + unstaged vs base）；不可用返回 available:false */
  diff(opts: { cwd: string; base?: string; head?: string }): Promise<GitDiffSnapshot>;
  /** 本 PR 的提交数 */
  commitCount(opts: { cwd: string; base?: string; head?: string }): Promise<number>;
}

export interface FsPort {
  readFile(uri: string): Promise<string | null>;
}
