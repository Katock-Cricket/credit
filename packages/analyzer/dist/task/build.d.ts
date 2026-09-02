/**
 * TaskGraph 组装（P2-pre T6，架构 §5.9）。
 *
 * 流水线：切分（C2）→ 测试运行识别 → Review 反推 → 阶段标注（C1）→ Desc 生成 → 自检。
 *
 * **永不抛异常**：任何一步失败都降级继续（LLM 失败→规则 Desc；分类失败→unknown），
 * 保证 Task 识别总能产出结果供可视化与人工核对。
 */
import type { Behavior } from "@credit/protocol";
import type { LlmPort } from "../llm/port.js";
import { type TaskConfig } from "./config.js";
import { type TaskGraph } from "./types.js";
export interface BuildTaskGraphOptions {
    prId: string;
    /** 按 ts 升序的 Behavior 流 */
    behaviors: Behavior[];
    /** LLM 通道；缺省视为不可用（走规则降级） */
    llm?: LlmPort | null;
    taskConfig?: Partial<TaskConfig>;
    /** 记录到 generator.llmModel 的模型名（可空） */
    llmModel?: string | null;
    /** 修复窗口时长（ms） */
    fixWindowMs?: number;
    /** 生成时间戳（注入便于单测） */
    now?: number;
}
export declare function buildTaskGraph(opts: BuildTaskGraphOptions): Promise<TaskGraph>;
