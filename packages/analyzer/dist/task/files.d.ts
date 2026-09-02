/**
 * Task 的附属聚合：文件清单、行为摘要、度量（P2-pre T6）。
 *
 * `behaviorSummary` 与 `desc` 是**两个语义不同的字段**（SPEC §4.4）：
 * - `desc` —— **想做什么**（自然语言目标描述，LLM 或 prompt 原文，可 null）
 * - `behaviorSummary` —— **做了什么**（规则拼接，恒非空，作为 UI 兜底）
 */
import type { Behavior } from "@credit/protocol";
import type { TaskFileRef, TaskMetrics, TaskType } from "./types.js";
import type { TestRun } from "./testrun.js";
/** 从 uri 推断语言（扩展名映射，不做内容探测） */
export declare function languageOf(uri: string): string | null;
/** 取文件名（工件名） */
export declare function artifactOf(uri: string): string;
/** 聚合 Task 涉及的文件 */
export declare function aggregateFiles(bs: Behavior[]): TaskFileRef[];
/** 规则拼接的行为摘要（**恒非空**） */
export declare function buildBehaviorSummary(bs: Behavior[]): string;
export declare function computeMetrics(bs: Behavior[], runs: TestRun[]): TaskMetrics;
/** 规则推断任务类型（LLM 不可用时的兜底；有 LLM 时以其输出为准） */
export declare function inferTaskType(files: TaskFileRef[], stage: string): TaskType;
