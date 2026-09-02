/**
 * Task.Desc 生成（P2-pre T4，SPEC §4.4；决策 D-018 修订 + D-023）。
 *
 * **核心**：主切分信号是 `promptSubmitted`，而 **Dev 的 prompt 本身就是用户用
 * 自然语言写下的目标描述**。因此 **LLM 的输入必须包含 prompt 原文** —— LLM 的作用
 * 不是凭空生成，而是在"用户第一手意图 + 行为上下文"之上做归纳与补全。
 *
 * **降级链**（LLM 优先，规则兜底）：
 * - L0 LLM(prompt 原文 + behaviorSummary) → `descSource: 'llm'`
 * - L1 LLM(agent.message + behaviorSummary) → `'llm'`
 * - L2 LLM(仅 behaviorSummary) → `'llm'`
 * - L3 prompt 原文截断 → `'prompt'`
 * - L4 agent.message 首句 → `'agent-message'`
 * - L5 无可得 → `desc = null`，`'rule'`
 */
import type { LlmPort } from "../llm/port.js";
import { type TaskConfig } from "./config.js";
import type { DescSource, StageId, TaskType } from "./types.js";
export interface CleanedPrompt {
    /** 清洗后的文本（系统模板时为空串） */
    text: string;
    systemTemplate: boolean;
    /** 系统模板的语义化标签 */
    templateLabel: string | null;
}
/** 清洗 prompt：剥离注入上下文块、识别系统模板、截断 */
export declare function cleanPrompt(raw: string | null | undefined, maxChars: number): CleanedPrompt;
export interface DescTaskInput {
    taskId: string;
    /** 清洗后的 prompt 文本（系统模板为 ""） */
    promptText: string;
    systemTemplate: boolean;
    templateLabel: string | null;
    agentMessage: string | null;
    behaviorSummary: string;
    files: string[];
    stage: StageId;
}
export interface DescResult {
    desc: string | null;
    taskType: TaskType | null;
    source: DescSource;
}
/** 规则降级（L3–L5） */
export declare function fallbackDesc(input: DescTaskInput, cfg: TaskConfig): DescResult;
export interface DescBatchResult {
    results: Map<string, DescResult>;
    llmCalls: number;
    fallbackCount: number;
}
/**
 * 批量生成 Desc 与 taskType。
 *
 * **永不抛异常**：LLM 失败（任意原因）时整批退到规则降级，调用方无感。
 */
export declare function generateDescs(inputs: DescTaskInput[], llm: LlmPort, cfgOverride?: Partial<TaskConfig>): Promise<DescBatchResult>;
