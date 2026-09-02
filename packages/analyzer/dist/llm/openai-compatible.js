import { makeCacheKey, readApiKey, validateJson } from "./port.js";
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 从响应文本中取出模型输出内容（兼容纯 JSON 响应与 ```json 围栏） */
export function extractContent(rawText) {
    let text = rawText;
    try {
        const parsed = JSON.parse(rawText);
        const c = parsed?.choices?.[0]?.message?.content;
        if (typeof c === "string")
            text = c;
    }
    catch {
        // 非 JSON 响应（如网关错误页）：按纯文本继续处理
    }
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence?.[1])
        text = fence[1];
    const trimmed = text.trim();
    return trimmed || null;
}
export function createOpenAILlmPort(opts) {
    const envName = opts.apiKeyEnv ?? "OPENAI_API_KEY";
    const env = opts.env;
    const timeoutMs = opts.timeoutMs ?? 60_000;
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
                    messages: [
                        { role: "system", content: spec.system },
                        { role: "user", content: spec.user },
                    ],
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
                return {
                    ok: false,
                    reason: "invalid-json",
                    message: `模型输出非合法 JSON：${content.slice(0, 200)}`,
                };
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
