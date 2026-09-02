import type { AnalyticLayer } from "./registry.js";
export interface AiInvolvementPoint {
    taskId: string;
    seq: number;
    startTs: number;
    endTs: number;
    aiRatio: number;
    stage: string;
    desc: string | null;
}
export interface AiInvolvementData {
    points: AiInvolvementPoint[];
    /** 按行为总数加权的平均 AI 占比 */
    avgAiRatio: number;
    /** AI 占比最高的 Task（委托最彻底的一段） */
    peak: AiInvolvementPoint | null;
    /** AI 占比最低的 Task（人介入最深的一段） */
    trough: AiInvolvementPoint | null;
}
export declare function createAiInvolvementLayer(): AnalyticLayer;
