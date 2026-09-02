/**
 * AI Review 语义反推（P2-pre T5，决策 D-015）。
 *
 * **为何反推而不新建 `review-bridge`**：用户未必使用 Bitfun 内置 review 子 agent，
 * 也可能以自定义规则与主 agent 交互完成审阅 —— 只认内置形态会漏判后者。
 *
 * **三级置信度**（SPEC §6）：
 * - L1 强：会话 id 具 review 子会话特征 / 工具名为 `submit_code_review`
 * - L2 中：Dev Prompt 含审阅语义词
 * - L3 弱：AI 消息含 finding 结构化输出
 *
 * **产出落 `tasks/<prId>.json`，不回写 `behaviors/`** —— 采集层是证据、分析层是推断，
 * 二者不得混流（架构 §1.1 单向数据流）。
 */
import type { Behavior } from "@credit/protocol";
import { type TaskConfig } from "./config.js";
import type { ReviewSession } from "./types.js";
type Level = "L1" | "L2" | "L3";
export interface ReviewSignal {
    level: Level;
    /**
     * 是否为**锚点**（能发起一轮 review）。
     *
     * 关键区分：初版只要 sessionId 是 review 子会话就判 L1，导致该会话下的
     * **每一条** AI 消息/工具调用都成锚点 —— 结果"按 Review 意见修复"的整段执行
     * 被算进 review 会话（P1 样例中第 2 轮吞掉 99 条行为、跨度 17 分钟）。
     * 现只有**发起性行为**（Dev prompt / review 专用工具）才算锚点。
     */
    anchor: boolean;
}
/** 单条 behavior 的 review 信号（无命中返回 null） */
export declare function reviewSignalOf(b: Behavior, cfg: TaskConfig): ReviewSignal | null;
/** 单条 behavior 是否属于 review（供 S4 切分信号与阶段归类共用） */
export declare function isReviewBehavior(b: Behavior, cfgIn?: Partial<TaskConfig>): boolean;
/**
 * 识别 Review 会话。
 *
 * 分组：按 `sessionId` 聚组；同组内若间隔超过 `idleGapMs` 则拆为多轮
 * （用户用主 agent 做 review 时，多轮 review 会落在同一 sessionId 下）。
 */
export declare function detectReviewSessions(behaviors: Behavior[], cfgOverride?: Partial<TaskConfig>): ReviewSession[];
export {};
