export const PATTERN_LABELS = {
    cruise: { "zh-CN": "巡航式", "en-US": "Cruise" },
    pair: { "zh-CN": "结对式", "en-US": "Pair" },
    review: { "zh-CN": "审阅式", "en-US": "Review" },
    manual: { "zh-CN": "手工式", "en-US": "Manual" },
    unknown: { "zh-CN": "未识别", "en-US": "Unknown" },
};
export const PATTERN_DESC = {
    cruise: {
        "zh-CN": "你把大部分实现交给 AI，自己主要在关键节点验收与纠偏",
        "en-US": "You delegate most implementation to AI and step in at key checkpoints",
    },
    pair: {
        "zh-CN": "你与 AI 高频交替，边说边改，像结对编程",
        "en-US": "You and AI alternate frequently, like pair programming",
    },
    review: {
        "zh-CN": "AI 大量产出的同时，你花了可观精力审阅它的产出",
        "en-US": "AI produces heavily while you spend real effort reviewing",
    },
    manual: {
        "zh-CN": "主要代码由你亲手编写，AI 处于辅助位置",
        "en-US": "You write most code yourself; AI plays a supporting role",
    },
    unknown: { "zh-CN": "行为数据不足，无法判定协作模式", "en-US": "Insufficient data" },
};
/** 判定阈值（可调；AGENTS §9 精神下应进 config，本阶段作为图层内常量并注明） */
const THRESHOLD = {
    /** Dev 编辑占全部编辑的比例超过此值 → 手工式 */
    devEditDominant: 0.5,
    /** 阅读类行为占比超过此值 → 审阅式 */
    readFocused: 0.18,
    /**
     * 平均每 Task 的 prompt 数超过此值 → 结对式。
     *
     * **必须 > 1**：本设计中 S1（Dev prompt）就是主切分信号，因此"每个 Task 有 1 条
     * prompt"是常态而非"结对"。初版阈值 0.6 把 P1 样例（典型巡航式）误判为结对式。
     * 只有**同一 Task 内出现多条 prompt**（人反复插话、高频交替）才构成结对特征。
     */
    promptPerTask: 1.5,
};
export function createCollabPatternLayer() {
    return {
        id: "collab-pattern",
        name: { "zh-CN": "协作模式画像", "en-US": "Collaboration Pattern" },
        renderAs: "panel",
        compute(graph, _behaviors) {
            let total = 0;
            let ai = 0;
            let reads = 0;
            let prompts = 0;
            let toolCalls = 0;
            /** Dev / AI 编辑行数（来自 TaskFileRef.devLines / aiLines，比事件计数更准） */
            let devEditLines = 0;
            let aiEditLines = 0;
            for (const t of graph.tasks) {
                total += t.metrics.behaviorCount;
                ai += t.metrics.aiBehaviors;
                prompts += t.metrics.promptCount;
                for (const [action, n] of Object.entries(t.counts)) {
                    if (action === "agent.tool")
                        toolCalls += n;
                    if (action === "view" || action === "file.scroll" || action === "cursor")
                        reads += n;
                }
                for (const f of t.files) {
                    devEditLines += f.devLines ?? 0;
                    aiEditLines += f.aiLines ?? 0;
                }
            }
            const allEditLines = devEditLines + aiEditLines;
            const signals = {
                total,
                aiRatio: total > 0 ? Number((ai / total).toFixed(4)) : 0,
                devEditRatio: allEditLines > 0 ? Number((devEditLines / allEditLines).toFixed(4)) : 0,
                readRatio: total > 0 ? Number((reads / total).toFixed(4)) : 0,
                promptPerTask: graph.tasks.length > 0 ? Number((prompts / graph.tasks.length).toFixed(2)) : 0,
                toolCalls,
            };
            let pattern = "unknown";
            if (total > 0) {
                if (signals.devEditRatio > THRESHOLD.devEditDominant)
                    pattern = "manual";
                else if (signals.readRatio >= THRESHOLD.readFocused && signals.aiRatio > 0.5)
                    pattern = "review";
                else if (signals.promptPerTask >= THRESHOLD.promptPerTask)
                    pattern = "pair";
                else
                    pattern = "cruise";
            }
            return {
                id: "collab-pattern",
                summary: `${PATTERN_LABELS[pattern]["zh-CN"]}：${PATTERN_DESC[pattern]["zh-CN"]}`,
                data: {
                    pattern,
                    label: PATTERN_LABELS[pattern],
                    description: PATTERN_DESC[pattern],
                    signals,
                },
            };
        },
    };
}
