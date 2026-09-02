import { mergeTaskConfig } from "./config.js";
import { segmentBehaviors } from "./segment.js";
import { detectTestRuns } from "./testrun.js";
import { detectReviewSessions } from "./review.js";
import { annotateStages, makeClassifyContext, DEFAULT_FIX_WINDOW_MS } from "./stage.js";
import { aggregateFiles, buildBehaviorSummary, computeMetrics, inferTaskType } from "./files.js";
import { cleanPrompt, generateDescs, fallbackDesc } from "./desc.js";
import { ALL_STAGES, TASK_GRAPH_VERSION, } from "./types.js";
/** 从 Behavior.id（`<prId>-<seq>`）提取序号 */
function seqOf(b) {
    const m = /-(\d+)$/.exec(b.id);
    return m ? Number(m[1]) : 0;
}
function firstPromptText(bs) {
    for (const b of bs) {
        if (b.action === "prompt.submit") {
            const t = b.context?.promptText;
            if (typeof t === "string" && t.trim())
                return t;
        }
    }
    return null;
}
function firstAgentMessage(bs) {
    for (const b of bs) {
        if (b.action === "agent.message") {
            const t = b.context?.after;
            if (typeof t === "string" && t.trim())
                return t;
        }
    }
    return null;
}
export async function buildTaskGraph(opts) {
    const cfg = mergeTaskConfig(opts.taskConfig);
    const behaviors = [...opts.behaviors].sort((a, b) => a.ts - b.ts);
    const prId = opts.prId;
    const llm = opts.llm ?? null;
    // ── C2 切分 ──
    const { clusters, cutSignals } = segmentBehaviors(behaviors, cfg);
    // ── 测试运行 ──
    const runs = detectTestRuns(behaviors, cfg);
    // ── T5 Review 反推 ──
    const reviewSessions = detectReviewSessions(behaviors, cfg);
    const reviewBehaviorIds = new Set();
    for (const rs of reviewSessions)
        for (const id of rs.behaviorIds)
            reviewBehaviorIds.add(id);
    // ── C1 阶段标注上下文 ──
    const ctx = makeClassifyContext(behaviors, runs, reviewBehaviorIds, cfg, opts.fixWindowMs ?? DEFAULT_FIX_WINDOW_MS);
    // ── 逐簇构建 Task 骨架 ──
    const draft = [];
    let prevEndTs = null;
    clusters.forEach((bs, i) => {
        if (bs.length === 0)
            return;
        const startTs = bs[0].ts;
        const endTs = bs[bs.length - 1].ts;
        const annotation = annotateStages(bs, ctx);
        const files = aggregateFiles(bs);
        const behaviorSummary = buildBehaviorSummary(bs);
        // 该簇内涉及的测试运行（按 behaviorId 落在簇内）
        const ids = new Set(bs.map((b) => b.id));
        const clusterRuns = runs.filter((r) => ids.has(r.behaviorId));
        const counts = {};
        for (const b of bs)
            counts[b.action] = (counts[b.action] ?? 0) + 1;
        const sessionIds = [
            ...new Set(bs.map((b) => b.context?.sessionId).filter((s) => !!s)),
        ];
        const promptIds = bs.filter((b) => b.action === "prompt.submit").map((b) => b.id);
        const task = {
            id: `${prId}-T${i + 1}`,
            prId,
            seq: i + 1,
            startTs,
            endTs,
            durationMs: Math.max(0, endTs - startTs),
            idleBeforeMs: prevEndTs === null ? null : Math.max(0, startTs - prevEndTs),
            bs: bs.map((b) => b.id),
            behaviorRange: [seqOf(bs[0]), seqOf(bs[bs.length - 1])],
            counts,
            desc: null,
            descSource: "rule",
            behaviorSummary,
            fp: {
                taskType: inferTaskType(files, annotation.stage),
                languages: [
                    ...new Set(files.map((f) => f.uri).map(languageOfSafe).filter((x) => !!x)),
                ],
                artifacts: [...new Set(files.map((f) => f.uri).map(artifactOfSafe))].slice(0, 10),
            },
            stage: annotation.stage,
            spans: annotation.spans,
            stageConfidence: annotation.stageConfidence,
            files,
            sessionIds,
            promptIds,
            testRunIds: clusterRuns.map((r) => r.id),
            metrics: computeMetrics(bs, clusterRuns),
        };
        prevEndTs = endTs;
        // ── Desc 输入 ──
        const cleaned = cleanPrompt(firstPromptText(bs), cfg.descMaxInputChars);
        const descInput = {
            taskId: task.id,
            promptText: cleaned.text,
            systemTemplate: cleaned.systemTemplate,
            templateLabel: cleaned.templateLabel,
            agentMessage: firstAgentMessage(bs),
            behaviorSummary,
            files: files.map((f) => f.uri),
            stage: annotation.stage,
        };
        draft.push({ task, descInput, runs: clusterRuns });
    });
    // ── Desc 批量生成（LLM 优先，规则降级）──
    let llmCalls = 0;
    let llmFallbackCount = 0;
    const descSourceDist = {};
    const inputs = draft.map((d) => d.descInput);
    if (llm && inputs.length > 0) {
        const res = await generateDescs(inputs, llm, cfg);
        llmCalls = res.llmCalls;
        llmFallbackCount = res.fallbackCount;
        for (const d of draft) {
            const r = res.results.get(d.task.id);
            if (!r) {
                d.task.desc = null;
                d.task.descSource = "rule";
                continue;
            }
            d.task.desc = r.desc;
            d.task.descSource = r.source;
            if (r.taskType)
                d.task.fp.taskType = r.taskType;
        }
    }
    else {
        for (const d of draft) {
            const r = fallbackDesc(d.descInput, cfg);
            d.task.desc = r.desc;
            d.task.descSource = r.source;
            if (r.taskType)
                d.task.fp.taskType = r.taskType;
            llmFallbackCount++;
        }
    }
    for (const d of draft) {
        descSourceDist[d.task.descSource] = (descSourceDist[d.task.descSource] ?? 0) + 1;
    }
    const tasks = draft.map((d) => d.task);
    // ── 阶段聚合（StageSegment）──
    const totalDuration = tasks.reduce((s, t) => s + t.durationMs, 0);
    const segments = ALL_STAGES.map((stage) => {
        // 成员 = 主 stage 匹配，**或** spans 中含该 stage。
        // 混合 Task 的次要阶段也要计入统计，否则"先备测试数据、再实现"这类 Task 的
        // 次要阶段会从阶段聚合里整体消失。甘特图同样按 span 渲染，二者保持一致。
        const members = tasks.filter((t) => t.stage === stage || t.spans.some((s) => s.stage === stage));
        const present = members.length > 0;
        const startTs = present ? Math.min(...members.map((t) => t.startTs)) : 0;
        const endTs = present ? Math.max(...members.map((t) => t.endTs)) : 0;
        const rangeStart = present ? Math.min(...members.map((t) => t.behaviorRange[0])) : 0;
        const rangeEnd = present ? Math.max(...members.map((t) => t.behaviorRange[1])) : 0;
        const dur = members.reduce((s, t) => s + t.durationMs, 0);
        return {
            stage,
            startTs,
            endTs,
            behaviorRange: [rangeStart, rangeEnd],
            taskIds: members.map((t) => t.id),
            present,
            weightSum: totalDuration > 0 ? Number((dur / totalDuration).toFixed(4)) : 0,
        };
    });
    // ── 自检 ──
    const assigned = new Set();
    for (const t of tasks)
        for (const id of t.bs)
            assigned.add(id);
    const unassigned = behaviors.filter((b) => !assigned.has(b.id)).map((b) => b.id);
    const diagnostics = {
        cutSignals,
        avgTaskDurationMs: tasks.length > 0
            ? Math.round(tasks.reduce((s, t) => s + t.durationMs, 0) / tasks.length)
            : 0,
        mixedStageTaskCount: tasks.filter((t) => t.spans.length > 1).length,
        llmFallbackCount,
        llmCalls,
        descSourceDist,
    };
    return {
        v: TASK_GRAPH_VERSION,
        prId,
        generatedAt: opts.now ?? Date.now(),
        generator: {
            ruleset: "p2-pre-1",
            llmModel: opts.llmModel ?? (llm ? llm.id : null),
            llmCalls,
        },
        stages: segments,
        tasks,
        reviewSessions,
        unassigned,
        diagnostics,
    };
}
// 局部工具：避免 files.ts 的小函数被过度导出
function languageOfSafe(uri) {
    const m = /\.([a-z0-9]+)$/i.exec(uri);
    if (!m)
        return null;
    const map = {
        ts: "TypeScript",
        tsx: "TypeScript",
        js: "JavaScript",
        jsx: "JavaScript",
        py: "Python",
        rs: "Rust",
        go: "Go",
        md: "Markdown",
        json: "JSON",
    };
    return map[m[1].toLowerCase()] ?? null;
}
function artifactOfSafe(uri) {
    const parts = String(uri).split(/[\\/]/);
    return parts[parts.length - 1] || uri;
}
