export function createAiInvolvementLayer() {
    return {
        id: "ai-involvement",
        name: { "zh-CN": "AI 参与度光谱", "en-US": "AI Involvement" },
        renderAs: "overlay",
        compute(graph, _behaviors) {
            const points = graph.tasks.map((t) => ({
                taskId: t.id,
                seq: t.seq,
                startTs: t.startTs,
                endTs: t.endTs,
                aiRatio: t.metrics.aiRatio,
                stage: t.stage,
                desc: t.desc,
            }));
            const totalBehaviors = graph.tasks.reduce((s, t) => s + t.metrics.behaviorCount, 0);
            const weighted = totalBehaviors > 0
                ? graph.tasks.reduce((s, t) => s + t.metrics.aiRatio * t.metrics.behaviorCount, 0) /
                    totalBehaviors
                : 0;
            const sorted = [...points].sort((a, b) => b.aiRatio - a.aiRatio);
            const summary = points.length === 0
                ? "无 Task 数据"
                : `AI 平均参与 ${(weighted * 100).toFixed(0)}%，` +
                    `最高 ${((sorted[0]?.aiRatio ?? 0) * 100).toFixed(0)}%（${sorted[0]?.desc ?? sorted[0]?.taskId ?? "-"}），` +
                    `最低 ${((sorted[sorted.length - 1]?.aiRatio ?? 0) * 100).toFixed(0)}%（${sorted[sorted.length - 1]?.desc ?? sorted[sorted.length - 1]?.taskId ?? "-"}）`;
            const warnings = [];
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
                },
                warnings: warnings.length > 0 ? warnings : undefined,
            };
        },
    };
}
