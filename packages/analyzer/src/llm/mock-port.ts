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
import type { LlmCallSpec, LlmPort, LlmResult } from "./port.js";
import { validateJson } from "./port.js";

/** 注册值：JSON 数据、Error（模拟失败）、或函数（动态返回） */
export type MockResponse =
  | unknown
  | Error
  | ((spec: LlmCallSpec) => unknown | Error | Promise<unknown | Error>);

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

export function createMockLlmPort(opts: MockLlmOptions = {}): MockLlmPort {
  const responses = opts.responses ?? {};
  const calls: LlmCallSpec[] = [];
  const available = opts.available ?? Object.keys(responses).length > 0;

  return {
    id: "null", // 对外仍报 null：mock 只是测试替身，不伪装成真实 provider
    calls,
    reset(): void {
      calls.length = 0;
    },
    async isAvailable(): Promise<boolean> {
      return available;
    },
    async complete(spec: LlmCallSpec): Promise<LlmResult> {
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

      let value: unknown;
      try {
        value = typeof reg === "function" ? await reg(spec) : reg;
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
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
