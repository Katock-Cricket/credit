/**
 * AI 参与度光谱（P2-pre T7，决策 D-017）。
 *
 * 把每个 Task 的 `metrics.aiRatio`（AI 行为占比）沿时间轴连成曲线 ——
 * 直观回答"人在哪些环节把关、哪些彻底放手"。这是 AI 协作领域最有说服力的
 * 可视化之一，且**不依赖任何 CREDIT 评分语义**。
 */
import type { Behavior } from "@credit/protocol";
import type { TaskGraph } from "../task/types.js";
import type { AnalyticLayer, AnalyticView } from "./registry.js";

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

export function createAiInvolvementLayer(): AnalyticLayer {
  return {
    id: "ai-involvement",
    name: { "zh-CN": "AI 参与度光谱", "en-US": "AI Involvement" },
    renderAs: "overlay",
    compute(graph: TaskGraph, _behaviors: Behavior[]): AnalyticView {
      const points: AiInvolvementPoint[] = graph.tasks.map((t) => ({
        taskId: t.id,
        seq: t.seq,
        startTs: t.startTs,
        endTs: t.endTs,
        aiRatio: t.metrics.aiRatio,
        stage: t.stage,
        desc: t.desc,
      }));

      const totalBehaviors = graph.tasks.reduce((s, t) => s + t.metrics.behaviorCount, 0);
      const weighted =
        totalBehaviors > 0
          ? graph.tasks.reduce((s, t) => s + t.metrics.aiRatio * t.metrics.behaviorCount, 0) /
            totalBehaviors
          : 0;

      const sorted = [...points].sort((a, b) => b.aiRatio - a.aiRatio);
      const summary =
        points.length === 0
          ? "无 Task 数据"
          : `AI 平均参与 ${(weighted * 100).toFixed(0)}%，` +
            `最高 ${((sorted[0]?.aiRatio ?? 0) * 100).toFixed(0)}%（${sorted[0]?.desc ?? sorted[0]?.taskId ?? "-"}），` +
            `最低 ${((sorted[sorted.length - 1]?.aiRatio ?? 0) * 100).toFixed(0)}%（${sorted[sorted.length - 1]?.desc ?? sorted[sorted.length - 1]?.taskId ?? "-"}）`;

      const warnings: string[] = [];
      // userAccept 缺失会让"AI 生成 vs Dev 修改"的边界模糊，进而影响 aiRatio 的解读
      const hasAccept = graph.tasks.some((t) => t.counts["accept"]);
      if (!hasAccept) {
        warnings.push("本 PR 无 userAccept 事件：AI 与 Dev 编辑的边界由工具调用推断，非精确切分");
      }

      return {
        id: "ai-involvement",
        summary,
        data: {
          points,
          avgAiRatio: Number(weighted.toFixed(4)),
          peak: sorted[0] ?? null,
          trough: sorted[sorted.length - 1] ?? null,
        } satisfies AiInvolvementData,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  };
}
