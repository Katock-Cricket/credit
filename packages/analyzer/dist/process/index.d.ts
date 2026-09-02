import type { AnalyticLayer } from "./registry.js";
export * from "./registry.js";
export * from "./ai-involvement.js";
export * from "./collab-pattern.js";
/** P2-pre 默认注册的两个图层 */
export declare function defaultAnalyticLayers(): AnalyticLayer[];
/** 默认注册表（含 P2-pre 两层） */
export declare function createDefaultAnalyticRegistry(): import("./registry.js").AnalyticRegistry;
