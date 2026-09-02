import { makeCacheKey, validateJson } from "./port.js";
export function createBitfunLlmPort(opts) {
    const cache = opts.cache ?? null;
    const defaultModel = opts.model ?? "fast";
    const fallbackModel = opts.fallbackModel ?? "primary";
    return {
        id: "bitfun",
        async isAvailable() {
            return !!opts.ai;
        },
        async complete(spec) {
            const ai = opts.ai;
            if (!ai) {
                return {
                    ok: false,
                    reason: "unavailable",
                    message: "BitfunLlmPort：未注入 app.ai（P4 前预期如此）",
                };
            }
            const model = spec.model ?? defaultModel;
            if (cache) {
                const hit = cache.get(makeCacheKey(spec, model));
                if (hit !== undefined)
                    return { ok: true, json: hit, model, cached: true };
            }
            // 降级链：fast → primary（架构 §7.2 / 算法 §2.8）
            for (const m of [model, fallbackModel]) {
                try {
                    const res = await ai.complete({ system: spec.system, user: spec.user, model: m });
                    const text = typeof res === "string" ? res : (res?.text ?? "");
                    let json;
                    try {
                        json = JSON.parse(text);
                    }
                    catch {
                        continue; // 换下一个模型
                    }
                    const err = validateJson(json, spec.schema);
                    if (err)
                        continue;
                    if (cache)
                        cache.set(makeCacheKey(spec, model), json);
                    return { ok: true, json, model: m, cached: false };
                }
                catch {
                    // 单模型失败 → 尝试降级模型
                    continue;
                }
            }
            return {
                ok: false,
                reason: "error",
                message: `BitfunLlmPort：${model} 与 ${fallbackModel} 均失败`,
            };
        },
    };
}
