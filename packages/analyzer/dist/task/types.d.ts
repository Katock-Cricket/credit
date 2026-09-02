/**
 * Task / Stage 数据模型（P2-pre，架构 §5.9；需规 §3.2）。
 *
 * **二维模型**：Task = **时间切片**（连续行为序列，有序不重叠）；Stage = **语义标签**。
 * 由此两种"非直觉"形态均被支持：
 * 1. 一个 Task 跨多个 Stage → `Task.spans[]`；
 * 2. 一个 Stage 含多个不连续 Task → `StageSegment.taskIds[]`（即"乱序归类"）。
 */
import type { ObjectRole } from "@credit/protocol";
/** 七阶段枚举（D-020，含 AI软件测试）+ 兜底 */
export type StageId = "spec-engineering" | "test-planning" | "ai-code-generation" | "ai-testing" | "ai-fix" | "manual-verification" | "ai-review" | "unknown";
export declare const ALL_STAGES: readonly StageId[];
export declare const STAGE_LABELS: Record<StageId, {
    "zh-CN": string;
    "en-US": string;
}>;
export type TaskType = "feature" | "fix" | "test" | "docs" | "refactor" | "spec" | "review" | "unknown";
/** Desc 来源（降级链，SPEC §4.4） */
export type DescSource = "llm" | "prompt" | "agent-message" | "rule";
/** Task 内的语义子段：支撑"一个 Task 跨多个 Stage" */
export interface TaskSpan {
    stage: StageId;
    /** bs 下标区间 [startIdx, endIdx) */
    startIdx: number;
    endIdx: number;
    /** 归一化权重（按时长），Σ = 1 */
    weight: number;
    /**
     * 子段的时间范围。
     * 甘特图**按 span 渲染**（一个 Task 可同时出现在多条泳道），
     * 所以 span 必须自带时间，否则无法定位。
     */
    startTs: number;
    endTs: number;
}
export interface TaskFingerprint {
    taskType: TaskType;
    languages: string[];
    artifacts: string[];
}
export interface TaskFileRef {
    uri: string;
    role: ObjectRole;
    /** 对该文件的动作集合（edit / view / file.scroll / cursor …） */
    actions: string[];
    /** 涉及行数（编辑行 ∪ 阅读行） */
    touchedLines: number;
    aiLines?: number;
    devLines?: number;
}
export interface TaskMetrics {
    behaviorCount: number;
    devBehaviors: number;
    aiBehaviors: number;
    /** 自主度光谱：`aiBehaviors / behaviorCount`（AI 参与度图层用） */
    aiRatio: number;
    /** 扣除空档的 Dev 实际活跃时长 */
    devActiveMs: number;
    promptCount: number;
    testRunCount: number;
    testPassed: number | null;
    testFailed: number | null;
}
export interface Task {
    id: string;
    prId: string;
    seq: number;
    startTs: number;
    endTs: number;
    durationMs: number;
    /** 与前一 Task 的间隔（首个为 null） */
    idleBeforeMs: number | null;
    bs: string[];
    behaviorRange: [number, number];
    counts: Record<string, number>;
    /** 自然语言目标描述（**想做什么**）；不可得为 null */
    desc: string | null;
    descSource: DescSource;
    /** 规则拼接的行为摘要（**做了什么**），恒非空 */
    behaviorSummary: string;
    fp: TaskFingerprint;
    stage: StageId;
    spans: TaskSpan[];
    stageConfidence: number;
    files: TaskFileRef[];
    sessionIds: string[];
    promptIds: string[];
    testRunIds: string[];
    metrics: TaskMetrics;
}
/** 阶段侧：持有**可不连续**的 taskIds —— 乱序归类的落点 */
export interface StageSegment {
    stage: StageId;
    startTs: number;
    endTs: number;
    behaviorRange: [number, number];
    taskIds: string[];
    present: boolean;
    weightSum: number;
}
export interface ReviewSession {
    id: string;
    sessionId: string;
    /** 识别置信度分级（SPEC §6：L1 子会话 / L2 prompt 语义 / L3 finding 结构） */
    level: "L1" | "L2" | "L3";
    confidence: number;
    startTs: number;
    endTs: number;
    behaviorIds: string[];
    /** 第几轮（1-based，按 startTs 排序） */
    roundIndex: number;
    /** 处置语义（如 "selected" = 选择性采纳） */
    disposition: string | null;
    evidence: string;
}
export interface TaskDiagnostics {
    /** 各切分信号命中次数（S1 prompt / S2 idleGap / S3 testCmd / S4 reviewSwitch / S5 fileSwitch） */
    cutSignals: Record<string, number>;
    avgTaskDurationMs: number;
    /** 混合阶段 Task 数（过高 = 切太粗，应回调切分信号而非硬标单一 stage） */
    mixedStageTaskCount: number;
    llmFallbackCount: number;
    llmCalls: number;
    descSourceDist: Record<string, number>;
}
export interface TaskGraph {
    v: string;
    prId: string;
    generatedAt: number;
    generator: {
        ruleset: string;
        llmModel: string | null;
        llmCalls: number;
    };
    /** 七阶段全量，未出现的 present=false */
    stages: StageSegment[];
    tasks: Task[];
    reviewSessions: ReviewSession[];
    /** 未归入任何 Task 的 Behavior id（应为空） */
    unassigned: string[];
    diagnostics: TaskDiagnostics;
}
export declare const TASK_GRAPH_VERSION = "1.0";
