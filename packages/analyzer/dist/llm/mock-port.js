import { validateJson } from "./port.js";
export function createMockLlmPort(opts = {}) {
    const responses = opts.responses ?? {};
    const calls = [];
    const available = opts.available ?? Object.keys(responses).length > 0;
    return {
        id: "null", // 对外仍报 null：mock 只是测试替身，不伪装成真实 provider
        calls,
        reset() {
            calls.length = 0;
        },
        async isAvailable() {
            return available;
        },
        async complete(spec) {
            calls.push(spec);
            const model = spec.model ?? "mock-model";
            if (!available) {
                return { ok: false, reason: "unavailable", message: "MockLlmPort：未启用" };
            }
            const reg = responses[spec.templateId];
            if (reg === undefined) {
                return {
                    ok: false,
                    reason: "error",
                    message: `MockLlmPort：未注册 templateId="${spec.templateId}"`,
                };
            }
            let value;
            try {
                value = typeof reg === "function" ? await reg(spec) : reg;
            }
            catch (e) {
                const msg = String(e?.message ?? e);
                return {
                    ok: false,
                    reason: /timeout|timed?\s*out/i.test(msg) ? "timeout" : "error",
                    message: msg,
                };
            }
            if (value instanceof Error) {
                const msg = value.message;
                return {
                    ok: false,
                    reason: /timeout|timed?\s*out/i.test(msg) ? "timeout" : "invalid-json",
                    message: msg,
                };
            }
            const err = validateJson(value, spec.schema);
            if (err) {
                return { ok: false, reason: "schema", message: `Mock 响应不合规：${err}` };
            }
            return { ok: true, json: value, model, cached: false };
        },
    };
}
