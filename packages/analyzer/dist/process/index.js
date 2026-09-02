/**
 * 过程分析层汇总（P2-pre T7）。
 *
 * 已注册：`ai-involvement`（AI 参与度光谱）、`collab-pattern`（协作模式画像）。
 * 后续候选（接口已预留，**未实现**）：返工与卡点分析、注意力审计、自动工作摘要、
 * 成本归属、SPEC 漂移检测 —— 加一个注册项即可，不动渲染框架与 schema。
 */
import { createAnalyticRegistry } from "./registry.js";
import { createAiInvolvementLayer } from "./ai-involvement.js";
import { createCollabPatternLayer } from "./collab-pattern.js";
export * from "./registry.js";
export * from "./ai-involvement.js";
export * from "./collab-pattern.js";
/** P2-pre 默认注册的两个图层 */
export function defaultAnalyticLayers() {
    return [createAiInvolvementLayer(), createCollabPatternLayer()];
}
/** 默认注册表（含 P2-pre 两层） */
export function createDefaultAnalyticRegistry() {
    return createAnalyticRegistry(defaultAnalyticLayers());
}
