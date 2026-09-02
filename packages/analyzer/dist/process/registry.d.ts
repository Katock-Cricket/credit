/**
 * 过程分析插件接口（P2-pre T7，架构 §5.10；决策 D-017）。
 *
 * **设计意图**：可视化层**不内置任何具体分析**，只提供注册接口。
 * 新增一种分析 = 加一个注册项，不动渲染框架、不改 `TaskGraph` schema ——
 * 这是"可视化层预留扩展位"的落地形态。
 *
 * **插件异常隔离**：单插件抛错 → 该图层单独降级为"不可用"，
 * 不影响时间线主视图与其他图层（同架构 §3.3 单指标错误隔离纪律）。
 */
import type { Behavior } from "@credit/protocol";
import type { TaskGraph } from "../task/types.js";
export type AnalyticRenderAs = "overlay" | "panel" | "badge";
export interface AnalyticView {
    id: string;
    /** 一句话结论（直接给 UI 展示） */
    summary: string;
    /** 插件自定义的渲染数据，由 view 层按 renderAs 消费 */
    data: unknown;
    /** 数据缺失提示（如"无 userAccept，AI 行标记不可得"） */
    warnings?: string[];
}
export interface AnalyticLayer {
    id: string;
    name: {
        "zh-CN": string;
        "en-US": string;
    };
    renderAs: AnalyticRenderAs;
    compute(graph: TaskGraph, behaviors: Behavior[]): AnalyticView;
}
export interface AnalyticRegistry {
    readonly layers: readonly AnalyticLayer[];
    /** 执行全部图层（逐个异常隔离） */
    runAll(graph: TaskGraph, behaviors: Behavior[]): AnalyticView[];
    /** 执行单个图层；未注册返回 null，抛错返回降级视图 */
    run(id: string, graph: TaskGraph, behaviors: Behavior[]): AnalyticView | null;
}
export declare function createAnalyticRegistry(layers: AnalyticLayer[]): AnalyticRegistry;
