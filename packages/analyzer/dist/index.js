/**
 * @credit/analyzer 公共入口（P2-pre 起）。
 *
 * 承载：过程建模（Task/Stage）+ 过程分析插件 +（P2 起）指标计算与画像。
 * 运行位置：MiniApp Worker（P4）/ 仓内原型 Node server（P2-pre）。
 * LLM 与文件访问一律经 Port 注入，保证核心逻辑可在 Node 单测环境全离线跑通。
 */
export * from "./llm/index.js";
export * from "./task/types.js";
export * from "./task/config.js";
export * from "./task/segment.js";
export * from "./task/testrun.js";
export * from "./task/review.js";
export * from "./task/stage.js";
export * from "./task/desc.js";
export * from "./task/files.js";
export * from "./task/build.js";
export * from "./process/index.js";
