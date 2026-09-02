export function createNullLlmPort() {
    return {
        id: "null",
        async isAvailable() {
            return false;
        },
        async complete(_spec) {
            return {
                ok: false,
                reason: "unavailable",
                message: "NullLlmPort：通道未启用（单测与降级路径）",
            };
        },
    };
}
