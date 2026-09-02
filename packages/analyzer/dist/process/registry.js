function unavailableView(layer, message) {
    return {
        id: layer.id,
        summary: "该分析不可用",
        data: null,
        warnings: [message],
    };
}
export function createAnalyticRegistry(layers) {
    const byId = new Map(layers.map((l) => [l.id, l]));
    return {
        layers,
        runAll(graph, behaviors) {
            const out = [];
            for (const l of layers) {
                try {
                    out.push(l.compute(graph, behaviors));
                }
                catch (e) {
                    out.push(unavailableView(l, String(e?.message ?? e)));
                }
            }
            return out;
        },
        run(id, graph, behaviors) {
            const l = byId.get(id);
            if (!l)
                return null;
            try {
                return l.compute(graph, behaviors);
            }
            catch (e) {
                return unavailableView(l, String(e?.message ?? e));
            }
        },
    };
}
