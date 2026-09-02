/**
 * MockLlmPort —— 按 templateId 注册固定响应（单测用，决策 D-023）。
 *
 * 支持三种模式（算法 §9「LLM mock 三模式」）：
 * 1. 合法 JSON：返回注册值；
 * 2. 非法 JSON：注册值为 `Error` 实例，或直接注册 `invalid-json` 响应；
 * 3. 超时：注册值为 `Error`，message 含 "timeout"。
 *
 * 同时记录全部调用，供断言"调用次数 / 批量调用是否合并"使用。
 */
import type { LlmCallSpec, LlmPort } from "./port.js";
/** 注册值：JSON 数据、Error（模拟失败）、或函数（动态返回） */
export type MockResponse = unknown | Error | ((spec: LlmCallSpec) => unknown | Error | Promise<unknown | Error>);
export interface MockLlmOptions {
    /** templateId → 响应 */
    responses?: Record<string, MockResponse>;
    /** isAvailable 的返回值（默认 true，除非无 responses） */
    available?: boolean;
}
export interface MockLlmPort extends LlmPort {
    /** 收到的全部调用（断言用） */
    readonly calls: LlmCallSpec[];
    /** 清空调用记录 */
    reset(): void;
}
export declare function createMockLlmPort(opts?: MockLlmOptions): MockLlmPort;
