import { ensureJsonMode, makeCacheKey, readApiKey, validateJson } from "./port.js";
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * 从响应文本中取出模型输出内容。
 *
 * **关键分支纪律**：响应**是**合法 JSON 却取不到 `choices[0].message.content` 时，
 * 必须返回 `null`（判为 `invalid-json`），**不得回退成整个响应体** ——
 * 否则网关的错误响应（`{"error":…}`）会被当成"合法 JSON 只是过不了 schema"，
 * 把**真实故障伪装成 schema 校验失败**，排障时极易误导（2026-09-07 排查所得）。
 *
 * 只有响应**不是**合法 JSON 时（网关错误页等纯文本），才按纯文本处理。
 */
export function extractContent(rawText) {
    const stripFence = (t) => {
        const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
        return (fence?.[1] ?? t).trim();
    };
    try {
        const parsed = JSON.parse(rawText);
        const c = parsed?.choices?.[0]?.message?.content;
        if (typeof c !== "string")
            return null;
        return stripFence(c) || null;
    }
    catch {
        // 非 JSON 响应（如网关错误页）：按纯文本继续处理
        return stripFence(rawText) || null;
    }
}
/**
 * 宽容 JSON 解析。
 *
 * **为何需要**：即使声明了 `response_format: json_object`，模型仍可能
 * 1. 在 JSON 前后带说明文字（"好的，结果如下：{...}"）；
 * 2. 被输入里的代码带偏，直接续写代码片段（实测：SPEC 里全是 Rust，
 *    模型返回 `rust struct CodecProbeResult {...}`）。
 *
 * 第 1 种可以救回来，第 2 种救不回 —— 但**不应该因此判 error**，
 * 故此处尽力提取平衡的第一个 `{...}` / `[...]`。
 */
export function parseLooseJson(text) {
    const t = String(text ?? "")
        .replace(/```(?:json)?/gi, "")
        .trim();
    if (!t)
        return null;
    try {
        return JSON.parse(t);
    }
    catch {
        /* 继续尝试定位片段 */
    }
    for (const [open, close] of [
        ["{", "}"],
        ["[", "]"],
    ]) {
        const start = t.indexOf(open);
        if (start < 0)
            continue;
        let depth = 0;
        let inStr = false;
        let esc = false;
        for (let i = start; i < t.length; i++) {
            const c = t[i];
            if (inStr) {
                if (esc)
                    esc = false;
                else if (c === "\\")
                    esc = true;
                else if (c === '"')
                    inStr = false;
                continue;
            }
            if (c === '"') {
                inStr = true;
                continue;
            }
            if (c === open)
                depth++;
            else if (c === close) {
                depth--;
                if (depth === 0) {
                    try {
                        return JSON.parse(t.slice(start, i + 1));
                    }
                    catch {
                        break;
                    }
                }
            }
        }
    }
    return null;
}
export function createOpenAILlmPort(opts) {
    const envName = opts.apiKeyEnv ?? "OPENAI_API_KEY";
    const env = opts.env;
    const timeoutMs = opts.timeoutMs ?? 180_000;
    const retry = Math.max(0, opts.retry ?? 1);
    const cache = opts.cache ?? null;
    const fetchImpl = opts.fetchImpl ??
        globalThis.fetch;
    const sleep = opts.sleep ?? defaultSleep;
    const base = opts.baseUrl.replace(/\/+$/, "");
    async function callOnce(spec, model, key) {
        if (!fetchImpl) {
            return {
                ok: false,
                reason: "unavailable",
                message: "运行环境无 fetch 实现",
                retryable: false,
            };
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetchImpl(`${base}/chat/completions`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model,
                    // DeepSeek 系：messages 必须含 "json" 字样，否则 JSON 模式不生效（见 port.ensureJsonMode）
                    messages: ensureJsonMode([
                        { role: "system", content: spec.system },
                        { role: "user", content: spec.user },
                    ]),
                    response_format: { type: "json_object" },
                    temperature: 0,
                }),
                signal: ctrl.signal,
            });
            if (!res.ok) {
                const body = await res.text().catch(() => "");
                // 仅 5xx / 429 值得重试；4xx（鉴权、参数错误）重试无意义
                const retryable = res.status >= 500 || res.status === 429;
                const reason = retryable ? "timeout" : "error";
                return {
                    ok: false,
                    reason,
                    message: `HTTP ${res.status}：${body.slice(0, 200)}`,
                    retryable,
                };
            }
            const raw = await res.text();
            const content = extractContent(raw);
            if (content === null) {
                return {
                    ok: false,
                    reason: "invalid-json",
                    message: `响应结构异常，取不到 choices[0].message.content：${raw.slice(0, 200)}`,
                };
            }
            let json;
            try {
                json = JSON.parse(content);
            }
            catch {
                // 宽容解析：模型可能在 JSON 前后带说明文字
                json = parseLooseJson(content);
                if (json == null) {
                    return {
                        ok: false,
                        reason: "invalid-json",
                        message: `模型输出非合法 JSON：${content.slice(0, 200)}`,
                    };
                }
            }
            const err = validateJson(json, spec.schema);
            if (err)
                return { ok: false, reason: "schema", message: err };
            return { ok: true, json, model, cached: false };
        }
        catch (e) {
            const name = e?.name;
            if (name === "AbortError") {
                return { ok: false, reason: "timeout", message: `超时 ${timeoutMs}ms` };
            }
            return { ok: false, reason: "error", message: String(e?.message ?? e) };
        }
        finally {
            clearTimeout(timer);
        }
    }
    return {
        id: "openai-compatible",
        async isAvailable() {
            return !!(opts.apiKey || readApiKey(envName, env)) && !!fetchImpl;
        },
        async complete(spec) {
            const key = opts.apiKey || readApiKey(envName, env);
            if (!key) {
                return {
                    ok: false,
                    reason: "unavailable",
                    message: `未设置环境变量 ${envName}`,
                };
            }
            if (!fetchImpl) {
                return {
                    ok: false,
                    reason: "unavailable",
                    message: "运行环境无 fetch 实现",
                };
            }
            const model = spec.model ?? opts.model;
            // 缓存：重复计算零 token 消耗（对"调参 → 重算 → 对比"的节奏至关重要）
            if (cache) {
                const hit = cache.get(makeCacheKey(spec, model));
                if (hit !== undefined)
                    return { ok: true, json: hit, model, cached: true };
            }
            let last = {
                ok: false,
                reason: "error",
                message: "未发起调用",
            };
            for (let attempt = 0; attempt <= retry; attempt++) {
                const r = await callOnce(spec, model, key);
                if (r.ok) {
                    if (cache)
                        cache.set(makeCacheKey(spec, model), r.json);
                    return r;
                }
                last = r;
                // 不可重试的失败（无密钥/无 fetch/4xx）立即退出，别浪费配额与时间
                if (r.retryable === false)
                    break;
                if (attempt < retry)
                    await sleep(500 * (attempt + 1));
            }
            return last;
        },
    };
}
