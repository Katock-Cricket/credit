import { isTestCommand, mergeTaskConfig } from "./config.js";
/** 失败测试运行之后的"修复环节"窗口（算法 §3.5） */
export const DEFAULT_FIX_WINDOW_MS = 1_800_000; // 30min
/** spans 中权重低于此值的碎片子段并入相邻（避免人机瞬时交替产生大量 0% 子段） */
export const MIN_SPAN_WEIGHT = 0.02;
function hasAny(text, words) {
    if (typeof text !== "string" || !text)
        return false;
    const t = text.toLowerCase();
    return words.some((w) => t.includes(String(w).toLowerCase()));
}
function inWindows(ts, wins) {
    return wins.some((w) => ts >= w.startTs && ts <= w.endTs);
}
/** 文档文件（md/markdown/txt），**排除 README** —— README 是项目说明，不是规格文档 */
export function isDocUri(uri) {
    if (typeof uri !== "string" || !uri)
        return false;
    if (!/\.(md|markdown|txt)$/i.test(uri))
        return false;
    return !/(^|[\\/])readme/i.test(uri);
}
/**
 * 源码编辑：编辑**非文档**文件。
 * 刻意不依赖 `object.role === 'source'` —— role 由路径规则识别，漏识别时（如 unknown）
 * 会让"已经在写代码"这件事被判成"还在写文档"。
 */
export function isCodeEdit(b) {
    return b.action === "edit" && !isDocUri(b.object?.uri);
}
/** 对任意行为窗口判定阶段（规则命中即止） */
export function classifyWindow(bs, ctx) {
    if (bs.length === 0)
        return "unknown";
    const cfg = ctx.config;
    // 1) Review 会话覆盖
    if (bs.some((b) => ctx.reviewBehaviorIds.has(b.id)))
        return "ai-review";
    const inFix = bs.some((b) => inWindows(b.ts, ctx.fixWindows));
    const hasCodeEdit = bs.some(isCodeEdit);
    const hasDocActivity = bs.some((b) => isDocUri(b.object?.uri) &&
        (b.action === "edit" || b.action === "view" || b.action === "file.scroll" || b.action === "file.open"));
    // 2) 失败之后的修复 —— 只认明确的修复意图。
    //    初版"窗口内有 edit 就算 ai-fix"把大段代码生成误标为修复；
    //    收紧后又一度被人工验证规则抢先（T9「人工验证**发现**杂音→诊断」被判成验证通过）。
    //    "验证发现问题"的主线是修复，故 ai-fix 优先于 manual-verification。
    if (inFix) {
        const fixPrompt = bs.some((b) => b.action === "prompt.submit" && hasAny(b.context?.promptText, cfg.fixWords));
        if (fixPrompt)
            return "ai-fix";
    }
    // 3) 人工验证通过语义
    if (bs.some((b) => b.action === "prompt.submit" &&
        hasAny(b.context?.promptText, cfg.manualVerifyWords))) {
        return "manual-verification";
    }
    // 4) Dev 触发的测试执行 —— 优先于文档类规则，否则"跑测试 + 顺手看了眼报告"
    //    会被 .md 活动判成 SPEC 工程（T8 曾因此误判）。
    {
        const hasTestRun = bs.some((b) => ctx.testRunBehaviorIds.has(b.id));
        if (hasTestRun) {
            const devTriggered = bs.some((b) => ctx.testRunBehaviorIds.has(b.id) && b.actor === "dev");
            if (devTriggered || !hasCodeEdit)
                return "ai-testing";
        }
    }
    // 5) 测试方案准备 —— 覆盖"准备测试数据 / 编写测试用例"。
    //    初版依赖 `role==='test'`，而 Rust 测试是源码内的 `#[cfg(test)] mod tests`，
    //    路径不含 test 字样 → 永远识别不到（用户指出后改为 Prompt 语义判定）。
    if (!inFix) {
        const testArtifactEdit = bs.some((b) => b.action === "edit" && (b.object?.role === "test" || b.object?.role === "test-plan"));
        const testPlanPrompt = bs.some((b) => b.action === "prompt.submit" && hasAny(b.context?.promptText, cfg.testPlanWords));
        if (testArtifactEdit)
            return "test-planning";
        // 已在写代码时不再判"准备测试"—— 那属实现过程（由 spans 的前段承载）
        if (testPlanPrompt && !hasCodeEdit)
            return "test-planning";
    }
    // 6) SPEC 工程 —— 覆盖"调研 → 讨论 → 定边界 → 生成/审阅 SPEC"整段。
    //    初版只认 `edit && role==='spec'`，而 P1 样例里 SPEC 文件**全程只有阅读没有编辑**
    //    （用户在审阅），导致 T2–T5 全部被误标为代码生成（用户指出后修正）。
    const specActivity = bs.some((b) => b.object?.role === "spec" &&
        (b.action === "edit" ||
            b.action === "view" ||
            b.action === "file.scroll" ||
            b.action === "file.open"));
    if (specActivity)
        return "spec-engineering";
    const specPrompt = bs.some((b) => b.action === "prompt.submit" && hasAny(b.context?.promptText, cfg.specWords));
    // 调研/撰写规格文档：有文档活动但还没动源码
    if (!hasCodeEdit && (hasDocActivity || specPrompt))
        return "spec-engineering";
    // 7) 兜底
    return "ai-code-generation";
}
/**
 * Task 内按语义锚点划分子段（供 spans 使用）。
 * 锚点：Dev prompt / 测试命令 / 进入或离开 review。
 */
export function splitSubspans(bs, ctx) {
    const cfg = ctx.config;
    const cuts = new Set();
    for (let i = 1; i < bs.length; i++) {
        const b = bs[i];
        const prev = bs[i - 1];
        if (b.action === "prompt.submit") {
            cuts.add(i);
            continue;
        }
        if (b.action === "terminal.exec" &&
            isTestCommand(b.context?.cmd, cfg.testCmdPatterns)) {
            cuts.add(i);
            continue;
        }
        // 进入 / 离开 review
        if (ctx.reviewBehaviorIds.has(b.id) !== ctx.reviewBehaviorIds.has(prev.id)) {
            cuts.add(i);
            continue;
        }
    }
    // 「开始写代码」是明确的活动转换点。
    // 没有它，像 P1 样例 T6 那样"先准备测试数据、再实现功能"的 Task 会被合成一个
    // 子段，"测试方案准备"这一段就永远看不见（用户指出后补上）。
    const firstCodeEdit = bs.findIndex(isCodeEdit);
    if (firstCodeEdit > 0)
        cuts.add(firstCodeEdit);
    const out = [];
    let start = 0;
    for (const c of [...cuts].sort((a, b) => a - b)) {
        if (c > start)
            out.push([start, c]);
        start = c;
    }
    if (start < bs.length)
        out.push([start, bs.length]);
    return out.length > 0 ? out : [[0, bs.length]];
}
/** 为单个 Task 的行为序列计算阶段标注（含 spans 与置信度） */
export function annotateStages(bs, ctx) {
    if (bs.length === 0) {
        return { stage: "unknown", spans: [], stageConfidence: 0 };
    }
    const ranges = splitSubspans(bs, ctx);
    // 权重按时长；总时长为 0（事件同 ts）时按行为数
    const durations = ranges.map(([s, e]) => {
        const seg = bs.slice(s, e);
        const d = (seg[seg.length - 1]?.ts ?? 0) - (seg[0]?.ts ?? 0);
        return d > 0 ? d : seg.length;
    });
    const total = durations.reduce((a, b) => a + b, 0) || 1;
    const rawSpans = ranges.map(([s, e], i) => {
        const seg = bs.slice(s, e);
        return {
            stage: classifyWindow(seg, ctx),
            startIdx: s,
            endIdx: e,
            weight: Number((durations[i] / total).toFixed(4)),
            startTs: seg[0]?.ts ?? 0,
            endTs: seg[seg.length - 1]?.ts ?? 0,
        };
    });
    // 合并相邻的同 stage 子段：初版未合并，导致 P1 样例中单个 Task 被切成
    // 29 个子段（AI 与人机行为交替时每次交替一个子段），spans 完全失去可读性。
    const coalesce = (list) => {
        const out = [];
        for (const sp of list) {
            const last = out[out.length - 1];
            if (last && last.stage === sp.stage) {
                last.endIdx = sp.endIdx;
                last.endTs = sp.endTs;
                last.weight += sp.weight;
            }
            else {
                out.push({ ...sp });
            }
        }
        return out;
    };
    let spans = coalesce(rawSpans);
    // 过滤碎片子段：权重 < 2% 的并入前一个。
    // 这些碎片来自人机行为的瞬时交替，留着只会让 spans 无法阅读。
    if (spans.length > 1) {
        const kept = [];
        for (const sp of spans) {
            if (sp.weight < MIN_SPAN_WEIGHT && kept.length > 0) {
                const last = kept[kept.length - 1];
                last.endIdx = sp.endIdx;
                last.endTs = sp.endTs;
                last.weight += sp.weight;
            }
            else {
                kept.push({ ...sp });
            }
        }
        spans = coalesce(kept);
    }
    // 权重归一（消除合并与 toFixed 带来的误差）
    const wSum = spans.reduce((s, x) => s + x.weight, 0) || 1;
    for (const sp of spans)
        sp.weight = Number((sp.weight / wSum).toFixed(4));
    // 主阶段 = 权重最大者；并列取更早的
    let best = spans[0];
    for (const sp of spans) {
        if (sp.weight > best.weight)
            best = sp;
    }
    return {
        stage: best.stage,
        spans,
        stageConfidence: Number(best.weight.toFixed(4)),
    };
}
/** 构建"修复窗口"：每次失败测试运行之后的时间窗 */
export function buildFixWindows(runs, windowMs = DEFAULT_FIX_WINDOW_MS) {
    return runs
        .filter((r) => (r.failed ?? 0) > 0)
        .map((r) => ({ startTs: r.ts, endTs: r.ts + windowMs }));
}
/** 构造 ClassifyContext */
export function makeClassifyContext(behaviors, runs, reviewBehaviorIds, cfgOverride, fixWindowMs = DEFAULT_FIX_WINDOW_MS) {
    return {
        config: mergeTaskConfig(cfgOverride),
        reviewBehaviorIds,
        testRunBehaviorIds: new Set(runs.map((r) => r.behaviorId)),
        fixWindows: buildFixWindows(runs, fixWindowMs),
    };
}
