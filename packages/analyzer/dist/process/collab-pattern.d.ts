import type { AnalyticLayer } from "./registry.js";
export type CollabPattern = "cruise" | "pair" | "review" | "manual" | "unknown";
export declare const PATTERN_LABELS: Record<CollabPattern, {
    "zh-CN": string;
    "en-US": string;
}>;
export declare const PATTERN_DESC: Record<CollabPattern, {
    "zh-CN": string;
    "en-US": string;
}>;
export interface CollabPatternData {
    pattern: CollabPattern;
    label: {
        "zh-CN": string;
        "en-US": string;
    };
    description: {
        "zh-CN": string;
        "en-US": string;
    };
    signals: {
        total: number;
        aiRatio: number;
        devEditRatio: number;
        readRatio: number;
        promptPerTask: number;
        toolCalls: number;
    };
}
export declare function createCollabPatternLayer(): AnalyticLayer;
