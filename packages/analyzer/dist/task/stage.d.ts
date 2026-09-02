/**
 * 阶段标注 C1（P2-pre T4，需规 §3.2 / SPEC §5）。
 *
 * **七阶段**（D-020，含「AI软件测试」）：SPEC工程 / 测试方案准备 / AI代码生成 /
 * AI软件测试 / AI代码修复 / 人工补测验证 / AI Review，另加 `unknown` 兜底。
 *
 * **归类优先级**（规则命中即止，SPEC §5.2）：
 * 1. Review 会话覆盖 → `ai-review`
 * 2. 含 SPEC 文件编辑 → `spec-engineering`
 * 3. 含测试方案/测试文件编辑（**且不在修复窗口内**）→ `test-planning`
 * 4. 失败测试运行之后的修复性 Prompt/编辑 → `ai-fix`
 * 5. 含测试命令运行 → `ai-testing`
 * 6. 含人工验证语义 Prompt → `manual-verification`
 * 7. 其余 → `ai-code-generation`
 *
 * **spans**：Task 内再按语义锚点（prompt / 测试命令 / review 边界）划分子段，
 * 每段独立分类 —— 这是"一个 Task 跨多个 Stage"的落地形态（决策 D-016）。
 */
import type { Behavior } from "@credit/protocol";
import { type TaskConfig } from "./config.js";
import type { StageId, TaskSpan } from "./types.js";
import type { TestRun } from "./testrun.js";
/** 失败测试运行之后的"修复环节"窗口（算法 §3.5） */
export declare const DEFAULT_FIX_WINDOW_MS = 1800000;
/** spans 中权重低于此值的碎片子段并入相邻（避免人机瞬时交替产生大量 0% 子段） */
export declare const MIN_SPAN_WEIGHT = 0.02;
export interface TimeWindow {
    startTs: number;
    endTs: number;
}
export interface ClassifyContext {
    config: TaskConfig;
    /** 属于 review 会话的 Behavior id 集合 */
    reviewBehaviorIds: Set<string>;
    /** 构成测试运行的 Behavior id 集合 */
    testRunBehaviorIds: Set<string>;
    /** 失败测试运行之后的修复窗口 */
    fixWindows: TimeWindow[];
}
/** 文档文件（md/markdown/txt），**排除 README** —— README 是项目说明，不是规格文档 */
export declare function isDocUri(uri: unknown): boolean;
/**
 * 源码编辑：编辑**非文档**文件。
 * 刻意不依赖 `object.role === 'source'` —— role 由路径规则识别，漏识别时（如 unknown）
 * 会让"已经在写代码"这件事被判成"还在写文档"。
 */
export declare function isCodeEdit(b: Behavior): boolean;
/** 对任意行为窗口判定阶段（规则命中即止） */
export declare function classifyWindow(bs: Behavior[], ctx: ClassifyContext): StageId;
/**
 * Task 内按语义锚点划分子段（供 spans 使用）。
 * 锚点：Dev prompt / 测试命令 / 进入或离开 review。
 */
export declare function splitSubspans(bs: Behavior[], ctx: ClassifyContext): Array<[number, number]>;
export interface StageAnnotation {
    stage: StageId;
    spans: TaskSpan[];
    stageConfidence: number;
}
/** 为单个 Task 的行为序列计算阶段标注（含 spans 与置信度） */
export declare function annotateStages(bs: Behavior[], ctx: ClassifyContext): StageAnnotation;
/** 构建"修复窗口"：每次失败测试运行之后的时间窗 */
export declare function buildFixWindows(runs: TestRun[], windowMs?: number): TimeWindow[];
/** 构造 ClassifyContext */
export declare function makeClassifyContext(behaviors: Behavior[], runs: TestRun[], reviewBehaviorIds: Set<string>, cfgOverride?: Partial<TaskConfig>, fixWindowMs?: number): ClassifyContext;
