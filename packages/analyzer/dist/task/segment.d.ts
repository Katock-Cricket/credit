/**
 * Task 切分 C2（P2-pre T3，需规 §3.2 / SPEC §4）。
 *
 * **核心原则（决策 D-023）：切分边界一律走规则，不让 LLM 决定在哪里切。**
 * 理由：规则可解释（"这里切是因为有一条 prompt"）、可重现（golden fixture 稳定）、
 * 零成本、便于用户目视核对。LLM 只处理边界之上的语义（见 desc.ts）。
 *
 * **实测修正（R-009）**：算法方案原以"新会话 sessionId / Git Commit / 边界 Prompt"
 * 为三大强信号。P1 样例数据中 git commit = 0 条、sessionId 长期不变，
 * 故**主信号改为 `promptSubmitted`**（S1），时间空档（S2）退居辅助。
 */
import type { Behavior } from "@credit/protocol";
import { type TaskConfig } from "./config.js";
export interface SegmentResult {
    /** 切分后的簇（按时间序，簇内保持原序） */
    clusters: Behavior[][];
    /** 各信号命中次数（写入 diagnostics.cutSignals） */
    cutSignals: Record<string, number>;
}
/**
 * 切分 Behavior 流为 Task 簇。
 *
 * 信号优先级：S1 prompt > S2 空档 > S3 测试命令 > S4 Review 会话切换 > S5 文件聚簇切换。
 * 同一点被多信号命中只切一次，计数记在**优先级最高**的那个信号上。
 */
export declare function segmentBehaviors(behaviors: Behavior[], cfgOverride?: Partial<TaskConfig>): SegmentResult;
