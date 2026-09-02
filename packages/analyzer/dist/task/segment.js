import { isTestCommand, mergeTaskConfig } from "./config.js";
/** 取行为关联的文件 uri（仅 file 类；其余返回 null） */
function fileUriOf(b) {
    return b.object?.kind === "file" && b.object.uri ? b.object.uri : null;
}
/** 是否 Review 会话（供 S4 用：跨会话切换才切） */
function sessionIdOf(b) {
    return b.context?.sessionId ?? null;
}
/**
 * 切分 Behavior 流为 Task 簇。
 *
 * 信号优先级：S1 prompt > S2 空档 > S3 测试命令 > S4 Review 会话切换 > S5 文件聚簇切换。
 * 同一点被多信号命中只切一次，计数记在**优先级最高**的那个信号上。
 */
export function segmentBehaviors(behaviors, cfgOverride) {
    const cfg = mergeTaskConfig(cfgOverride);
    const cutSignals = {
        prompt: 0,
        idleGap: 0,
        testCmd: 0,
        reviewSwitch: 0,
        fileSwitch: 0,
    };
    if (behaviors.length === 0)
        return { clusters: [], cutSignals };
    /** 在下标 i 之前切一刀（i > 0） */
    const cuts = new Set();
    let activeFile = null;
    const lastTouched = new Map();
    for (let i = 1; i < behaviors.length; i++) {
        const b = behaviors[i];
        const prev = behaviors[i - 1];
        // ── S1：Dev prompt（主信号，每一次发言 = 一次意图切换）──
        if (b.action === "prompt.submit") {
            cuts.add(i);
            cutSignals.prompt = (cutSignals.prompt ?? 0) + 1;
            // 仍然更新文件状态，避免后续 S5 误判
            const f = fileUriOf(b);
            if (f) {
                activeFile = f;
                lastTouched.set(f, b.ts);
            }
            continue;
        }
        // ── S2：时间空档 ──
        if (b.ts - prev.ts > cfg.idleGapMs) {
            cuts.add(i);
            cutSignals.idleGap = (cutSignals.idleGap ?? 0) + 1;
            const f = fileUriOf(b);
            if (f) {
                activeFile = f;
                lastTouched.set(f, b.ts);
            }
            continue;
        }
        // ── S3：Dev 执行测试/构建命令 ──
        // 只算 Dev 触发的：Agent 跑命令属"正在进行的 Task 内部"行为，
        // 若计入会产生大量无意义切点（样例中 AI 的 ExecCommand 有 67 次）。
        if (b.action === "terminal.exec" &&
            b.actor === "dev" &&
            isTestCommand(b.context?.cmd, cfg.testCmdPatterns)) {
            cuts.add(i);
            cutSignals.testCmd = (cutSignals.testCmd ?? 0) + 1;
            continue;
        }
        // ── S4：Review 会话切换（进入/离开 review 子会话）──
        const curSid = sessionIdOf(b);
        const prevSid = sessionIdOf(prev);
        if (curSid && prevSid && curSid !== prevSid) {
            cuts.add(i);
            cutSignals.reviewSwitch = (cutSignals.reviewSwitch ?? 0) + 1;
            continue;
        }
        // ── S5：活跃文件聚簇切换（默认关闭，见 TaskConfig.enableFileSwitch）──
        const f = fileUriOf(b);
        if (f) {
            if (cfg.enableFileSwitch && f !== activeFile) {
                const prevTouch = lastTouched.get(f);
                if (prevTouch === undefined || b.ts - prevTouch > cfg.fileIdleMs) {
                    cuts.add(i);
                    cutSignals.fileSwitch = (cutSignals.fileSwitch ?? 0) + 1;
                }
                activeFile = f;
            }
            lastTouched.set(f, b.ts);
        }
    }
    // ── 按切点切片 ──
    const raw = [];
    let start = 0;
    for (const c of [...cuts].sort((a, b) => a - b)) {
        if (c > start)
            raw.push(behaviors.slice(start, c));
        start = c;
    }
    if (start < behaviors.length)
        raw.push(behaviors.slice(start));
    // ── 噪声抑制：< minClusterSize 的碎片并入相邻簇 ──
    const merged = [];
    for (const cl of raw) {
        if (merged.length > 0 && cl.length < cfg.minClusterSize) {
            const last = merged[merged.length - 1];
            merged[merged.length - 1] = last.concat(cl);
        }
        else {
            merged.push(cl);
        }
    }
    // 末尾簇太小 → 并入前一个（否则会留下一个孤立的噪声 Task）
    if (merged.length > 1) {
        const last = merged[merged.length - 1];
        if (last.length < cfg.minClusterSize) {
            merged.pop();
            const prevLast = merged[merged.length - 1];
            merged[merged.length - 1] = prevLast.concat(last);
        }
    }
    return { clusters: merged, cutSignals };
}
