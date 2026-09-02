const EXT_LANG = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    mjs: "JavaScript",
    py: "Python",
    rs: "Rust",
    go: "Go",
    java: "Java",
    kt: "Kotlin",
    cpp: "C++",
    c: "C",
    cs: "C#",
    css: "CSS",
    html: "HTML",
    vue: "Vue",
    md: "Markdown",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    toml: "TOML",
    sh: "Shell",
};
/** 从 uri 推断语言（扩展名映射，不做内容探测） */
export function languageOf(uri) {
    const m = /\.([a-z0-9]+)$/i.exec(uri);
    if (!m)
        return null;
    return EXT_LANG[m[1].toLowerCase()] ?? null;
}
/** 取文件名（工件名） */
export function artifactOf(uri) {
    const parts = String(uri).split(/[\\/]/);
    return parts[parts.length - 1] || uri;
}
function diffLineCount(diff) {
    if (!Array.isArray(diff))
        return 0;
    let n = 0;
    for (const h of diff) {
        const hunk = h;
        if (Array.isArray(hunk.lines)) {
            n += hunk.lines.length;
        }
        else if (typeof hunk.startLine === "number" && typeof hunk.endLine === "number") {
            n += Math.max(1, Math.abs(hunk.endLine - hunk.startLine) + 1);
        }
    }
    return n;
}
/** 聚合 Task 涉及的文件 */
export function aggregateFiles(bs) {
    const m = new Map();
    for (const b of bs) {
        const uri = b.object?.kind === "file" ? b.object.uri : undefined;
        if (!uri)
            continue;
        let ref = m.get(uri);
        if (!ref) {
            ref = {
                uri,
                role: (b.object?.role ?? "unknown"),
                actions: [],
                touchedLines: 0,
            };
            m.set(uri, ref);
        }
        if (!ref.actions.includes(b.action))
            ref.actions.push(b.action);
        // role：优先取非 unknown 的标注
        const role = b.object?.role;
        if (ref.role === "unknown" && role && role !== "unknown")
            ref.role = role;
        const lr = b.object?.lineRange;
        if (lr && Array.isArray(lr) && lr.length === 2) {
            ref.touchedLines += Math.max(1, Math.abs(Number(lr[1]) - Number(lr[0])) + 1);
        }
        else if (b.action === "edit") {
            ref.touchedLines += diffLineCount(b.context?.diff);
        }
        if (b.action === "edit") {
            const n = diffLineCount(b.context?.diff) || 1;
            if (b.actor === "ai")
                ref.aiLines = (ref.aiLines ?? 0) + n;
            else
                ref.devLines = (ref.devLines ?? 0) + n;
        }
    }
    return [...m.values()];
}
/** 规则拼接的行为摘要（**恒非空**） */
export function buildBehaviorSummary(bs) {
    if (bs.length === 0)
        return "无行为记录";
    const editFiles = new Set();
    const readFiles = new Set();
    const cmds = [];
    let prompts = 0;
    let toolCalls = 0;
    for (const b of bs) {
        const uri = b.object?.kind === "file" ? b.object.uri : undefined;
        switch (b.action) {
            case "edit":
                if (uri)
                    editFiles.add(uri);
                break;
            case "view":
            case "file.scroll":
            case "cursor":
            case "file.open":
                if (uri)
                    readFiles.add(uri);
                break;
            case "terminal.exec": {
                const c = typeof b.context?.cmd === "string" ? b.context.cmd.trim() : "";
                if (c)
                    cmds.push(c);
                break;
            }
            case "prompt.submit":
                prompts++;
                break;
            case "agent.tool":
                toolCalls++;
                break;
            default:
                break;
        }
    }
    const parts = [];
    if (editFiles.size > 0)
        parts.push(`编辑 ${editFiles.size} 文件`);
    if (cmds.length > 0) {
        const uniq = [...new Set(cmds)];
        parts.push(`执行 ${uniq[0]}${cmds.length > 1 ? ` 等 ${uniq.length} 条命令` : ""}`);
    }
    if (prompts > 0)
        parts.push(`提交 ${prompts} 条 prompt`);
    if (toolCalls > 0)
        parts.push(`AI 调用 ${toolCalls} 次工具`);
    if (readFiles.size > 0)
        parts.push(`阅读 ${readFiles.size} 文件`);
    return parts.length > 0 ? parts.join(" · ") : `${bs.length} 条行为`;
}
/** Dev 活跃时长：累加相邻 Dev 行为的间隔，单段上限 cappedGapMs（避免空档虚高） */
function devActiveMs(bs, cappedGapMs = 300_000) {
    const dev = bs.filter((b) => b.actor === "dev").map((b) => b.ts);
    if (dev.length < 2)
        return 0;
    let total = 0;
    for (let i = 1; i < dev.length; i++) {
        total += Math.min(dev[i] - dev[i - 1], cappedGapMs);
    }
    return total;
}
export function computeMetrics(bs, runs) {
    const devBehaviors = bs.filter((b) => b.actor === "dev").length;
    const aiBehaviors = bs.length - devBehaviors;
    const passed = runs.reduce((s, r) => s + (r.passed ?? 0), 0);
    const failed = runs.reduce((s, r) => s + (r.failed ?? 0), 0);
    const anyCounted = runs.some((r) => r.passed !== null || r.failed !== null);
    return {
        behaviorCount: bs.length,
        devBehaviors,
        aiBehaviors,
        aiRatio: bs.length > 0 ? Number((aiBehaviors / bs.length).toFixed(4)) : 0,
        devActiveMs: devActiveMs(bs),
        promptCount: bs.filter((b) => b.action === "prompt.submit").length,
        testRunCount: runs.length,
        testPassed: anyCounted ? passed : null,
        testFailed: anyCounted ? failed : null,
    };
}
/** 规则推断任务类型（LLM 不可用时的兜底；有 LLM 时以其输出为准） */
export function inferTaskType(files, stage) {
    if (stage === "ai-review")
        return "review";
    if (stage === "ai-fix")
        return "fix";
    if (stage === "ai-testing" || stage === "test-planning")
        return "test";
    if (stage === "spec-engineering")
        return "spec";
    if (files.some((f) => /\.(md|markdown)$/i.test(f.uri)))
        return "docs";
    return "feature";
}
