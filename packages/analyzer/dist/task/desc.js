import { mergeTaskConfig } from "./config.js";
/** 宿主注入的上下文块（喂 LLM 前剥离，否则占大量 token 且无语义） */
const INJECTED_BLOCK = /\[(?:Directory|File|SelectedText|Attachment|Context):[^\]]*\]/gi;
/**
 * 系统生成的固定模板 prompt（用户不可编辑，对归纳无价值）。
 * 命中时以语义化标签替代 —— 样例中 review 的 4 条 prompt 均属此类。
 */
const SYSTEM_TEMPLATES = [
    {
        re: /^perform an independent adversarial review/i,
        label: "执行 AI Review",
    },
    {
        re: /the user approved remediation for selected review findings/i,
        label: "选择性采纳 Review 意见并授权修复",
    },
    {
        re: /the user approved remediation for all review findings/i,
        label: "全盘采纳 Review 意见并授权修复",
    },
    {
        re: /the user dismissed all review findings/i,
        label: "驳回全部 Review 意见",
    },
];
/** 清洗 prompt：剥离注入上下文块、识别系统模板、截断 */
export function cleanPrompt(raw, maxChars) {
    if (typeof raw !== "string" || !raw.trim()) {
        return { text: "", systemTemplate: false, templateLabel: null };
    }
    const stripped = raw.replace(INJECTED_BLOCK, " ").replace(/\s+/g, " ").trim();
    if (!stripped)
        return { text: "", systemTemplate: false, templateLabel: null };
    for (const t of SYSTEM_TEMPLATES) {
        if (t.re.test(stripped)) {
            return { text: "", systemTemplate: true, templateLabel: t.label };
        }
    }
    const text = stripped.length > maxChars ? `${stripped.slice(0, maxChars)}…` : stripped;
    return { text, systemTemplate: false, templateLabel: null };
}
/** 取首句（L1/L4 用） */
function firstSentence(text, maxChars) {
    const m = text.match(/^[^。！？\n.!?]{0,200}[。！？.!?]?/);
    let s = (m?.[0] ?? text).trim();
    if (s.length > maxChars)
        s = `${s.slice(0, maxChars)}…`;
    return s || text.slice(0, maxChars);
}
/** 规则降级（L3–L5） */
export function fallbackDesc(input, cfg) {
    // L3：系统模板 → 语义标签；普通 prompt → 原文（截断）
    if (input.systemTemplate && input.templateLabel) {
        return { desc: input.templateLabel, taskType: "review", source: "prompt" };
    }
    if (input.promptText) {
        const desc = input.promptText.length > cfg.descMaxChars
            ? `${input.promptText.slice(0, cfg.descMaxChars)}…`
            : input.promptText;
        return { desc, taskType: null, source: "prompt" };
    }
    // L4：AI 消息首句
    if (input.agentMessage) {
        return {
            desc: firstSentence(input.agentMessage, cfg.descMaxChars),
            taskType: null,
            source: "agent-message",
        };
    }
    // L5：仅行为摘要可用，Desc 置空
    return { desc: null, taskType: null, source: "rule" };
}
const SYSTEM_PROMPT = `你是软件工程过程分析助手。下面给出一次 PR 中若干"工作片段"的观测信息，请为每个片段归纳一句目标描述。

要求：
1. desc：不超过 30 个中文字符，动宾结构，说明这个片段**想做什么**；不要罗列文件名，不要复述命令原文。
2. taskType：从 feature / fix / test / docs / refactor / spec / review / unknown 中选一个。
3. prompt 字段是开发者当时对 AI 说的话，是判断意图的第一手依据，请优先依据它；systemLabel 是系统自动填充的模板，语义以它为准。
4. 若信息不足，desc 仍给出最贴切的表述，taskType 用 unknown；**不要留空、不要编造未出现的内容**。

严格输出 JSON，不要任何额外文字：
{"tasks":[{"id":"T1","desc":"...","taskType":"feature"}]}`;
function toPayload(t) {
    return {
        id: t.taskId,
        prompt: t.systemTemplate ? null : t.promptText || null,
        systemLabel: t.systemTemplate ? t.templateLabel : null,
        agentMessage: t.agentMessage ? t.agentMessage.slice(0, 400) : null,
        summary: t.behaviorSummary,
        files: t.files.slice(0, 5),
        stage: t.stage,
    };
}
/**
 * 批量生成 Desc 与 taskType。
 *
 * **永不抛异常**：LLM 失败（任意原因）时整批退到规则降级，调用方无感。
 */
export async function generateDescs(inputs, llm, cfgOverride) {
    const cfg = mergeTaskConfig(cfgOverride);
    const results = new Map();
    let llmCalls = 0;
    let fallbackCount = 0;
    if (inputs.length === 0)
        return { results, llmCalls, fallbackCount };
    let available = false;
    try {
        available = await llm.isAvailable();
    }
    catch {
        available = false;
    }
    if (!available) {
        for (const t of inputs) {
            results.set(t.taskId, fallbackDesc(t, cfg));
            fallbackCount++;
        }
        return { results, llmCalls, fallbackCount };
    }
    for (let i = 0; i < inputs.length; i += cfg.maxTasksPerBatch) {
        const batch = inputs.slice(i, i + cfg.maxTasksPerBatch);
        const payload = batch.map(toPayload);
        let ok = false;
        try {
            const r = await llm.complete({
                metricId: "task-desc",
                templateId: "task-desc-v1",
                system: SYSTEM_PROMPT,
                user: JSON.stringify({ tasks: payload }),
                input: { tasks: payload },
                schema: { type: "object", required: ["tasks"] },
            });
            llmCalls++;
            if (r.ok) {
                const parsed = r.json;
                const arr = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
                const byId = new Map(arr.filter((x) => x?.id).map((x) => [String(x.id), x]));
                for (const t of batch) {
                    const hit = byId.get(t.taskId);
                    const desc = typeof hit?.desc === "string" && hit.desc.trim() ? hit.desc.trim() : null;
                    if (desc) {
                        results.set(t.taskId, {
                            desc,
                            taskType: hit?.taskType ?? null,
                            source: "llm",
                        });
                    }
                    else {
                        results.set(t.taskId, fallbackDesc(t, cfg));
                        fallbackCount++;
                    }
                }
                ok = true;
            }
        }
        catch {
            // 落入下方兜底
        }
        if (!ok) {
            for (const t of batch) {
                results.set(t.taskId, fallbackDesc(t, cfg));
                fallbackCount++;
            }
        }
    }
    return { results, llmCalls, fallbackCount };
}
