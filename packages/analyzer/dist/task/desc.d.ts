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
/**
 * Desc 生成的 system prompt。
 *
 * **必须含 `json` 字样**（`ensureJsonMode` 会兜底，但此处显式写出更清晰）：
 * DeepSeek 系模型的 JSON 模式要求 messages 中出现 json 关键字，否则返回空内容。
 * 单测 `llm.test.ts` 对此有断言，**改这个模板时不要删掉 "JSON" 二字**。
 */
export declare const SYSTEM_PROMPT = "\u4F60\u662F\u8F6F\u4EF6\u5DE5\u7A0B\u8FC7\u7A0B\u5206\u6790\u52A9\u624B\u3002\u4E0B\u9762\u7ED9\u51FA\u4E00\u6B21 PR \u4E2D\u82E5\u5E72\"\u5DE5\u4F5C\u7247\u6BB5\"\u7684\u89C2\u6D4B\u4FE1\u606F\uFF0C\u8BF7\u4E3A\u6BCF\u4E2A\u7247\u6BB5\u5F52\u7EB3\u4E00\u53E5\u76EE\u6807\u63CF\u8FF0\u3002\n\n\u8981\u6C42\uFF1A\n1. desc\uFF1A\u4E0D\u8D85\u8FC7 30 \u4E2A\u4E2D\u6587\u5B57\u7B26\uFF0C\u52A8\u5BBE\u7ED3\u6784\uFF0C\u8BF4\u660E\u8FD9\u4E2A\u7247\u6BB5**\u60F3\u505A\u4EC0\u4E48**\uFF1B\u4E0D\u8981\u7F57\u5217\u6587\u4EF6\u540D\uFF0C\u4E0D\u8981\u590D\u8FF0\u547D\u4EE4\u539F\u6587\u3002\n2. taskType\uFF1A\u4ECE feature / fix / test / docs / refactor / spec / review / unknown \u4E2D\u9009\u4E00\u4E2A\u3002\n3. prompt \u5B57\u6BB5\u662F\u5F00\u53D1\u8005\u5F53\u65F6\u5BF9 AI \u8BF4\u7684\u8BDD\uFF0C\u662F\u5224\u65AD\u610F\u56FE\u7684\u7B2C\u4E00\u624B\u4F9D\u636E\uFF0C\u8BF7\u4F18\u5148\u4F9D\u636E\u5B83\uFF1BsystemLabel \u662F\u7CFB\u7EDF\u81EA\u52A8\u586B\u5145\u7684\u6A21\u677F\uFF0C\u8BED\u4E49\u4EE5\u5B83\u4E3A\u51C6\u3002\n4. \u82E5\u4FE1\u606F\u4E0D\u8DB3\uFF0Cdesc \u4ECD\u7ED9\u51FA\u6700\u8D34\u5207\u7684\u8868\u8FF0\uFF0CtaskType \u7528 unknown\uFF1B**\u4E0D\u8981\u7559\u7A7A\u3001\u4E0D\u8981\u7F16\u9020\u672A\u51FA\u73B0\u7684\u5185\u5BB9**\u3002\n\n\u4E25\u683C\u8F93\u51FA JSON\uFF0C\u4E0D\u8981\u4EFB\u4F55\u989D\u5916\u6587\u5B57\uFF1A\n{\"tasks\":[{\"id\":\"T1\",\"desc\":\"...\",\"taskType\":\"feature\"}]}";
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
