/**
 * 测试运行识别与结果解析（算法 §2.6 的 P2-pre 精简版）。
 *
 * 与算法方案的差异：本阶段只需支撑**阶段标注**与 Task 指标，故只实现
 * 主流框架的正则 + exitCode 兜底，不做完整解析器表。P2 需要"自动测试通过率"
 * 指标时再按算法 §2.6 补全（届时本文件的输出结构可直接复用）。
 *
 * **Actor 判定**：`terminal.exec` → dev；`agent.tool`(ExecCommand) → ai。
 * 同一命令的 start/end 两条事件按时间邻近合并为一次运行。
 */
import type { Behavior } from "@credit/protocol";
import { type TaskConfig } from "./config.js";
export interface TestRun {
    id: string;
    /** 代表该次运行的 Behavior id（取窗口内最后一条，优先带 exitCode） */
    behaviorId: string;
    cmd: string;
    ts: number;
    actor: "dev" | "ai";
    passed: number | null;
    failed: number | null;
    total: number | null;
    exitCode: number | null;
    /** 是否成功解析出用例计数（false 表示仅靠 exitCode 粗判） */
    parseOk: boolean;
}
/**
 * 识别测试运行。
 * @param behaviors 按 ts 升序
 */
export declare function detectTestRuns(behaviors: Behavior[], cfgOverride?: Partial<TaskConfig>): TestRun[];
/** 是否存在失败运行（供阶段标注的"修复环节"判定） */
export declare function hasFailedRun(runs: TestRun[]): boolean;
