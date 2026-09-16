/**
 * LLM 中继（P4 · D-051）。
 *
 * **为什么需要**：Worker 进程拿不到 `app.ai.*`（那是 iframe 侧 Bridge 的 API，
 * 见 P4 SPEC 文首 A3），且**没有** worker→host 的调用通道 —— 只有
 * `global.rpcEmit(event, data)` 单向推送。故 LLM 走「Worker 发事件 → iframe 调宿主 AI
 * → `app.call('credit.__llmResult') 回填」的往返。
 *
 * 本模块把该往返封装成 `BitfunAiLike`（`createBitfunLlmPort` 的宿主形参），
 * 上层计算代码零改动，并满足需规 §7「数据不出端、无需 API Key」。
 *
 * 拆成独立模块是为了**可单测**（entry.js 依赖 @credit/* 与原生 IO）。
 */

const DEFAULT_TIMEOUT_MS = 180_000;

/** 待回填的中继请求：id → { resolve, reject, timer } */
const pending = new Map();
let seq = 0;

/** 默认真实发射器（宿主注入 `global.rpcEmit`）；单测可替换 */
let emitFn = (event, data) => {
  if (typeof globalThis.rpcEmit === "function") globalThis.rpcEmit(event, data);
};

function setEmitter(fn) {
  emitFn = typeof fn === "function" ? fn : emitFn;
}

const aiEventName = "credit:llm";
const aiResultMethod = "credit.__llmResult";

/**
 * 生成符合 `BitfunAiLike` 的中继客户端。
 * 单次等待超时与 `DEFAULT_LLM_CONFIG.timeoutMs` 对齐（180s，D-027 教训）。
 */
function createRelayAi({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return {
    complete({ system, user, model }) {
      const id = `llm-${++seq}-${Date.now()}`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("LLM 中继超时：iframe 未在时限内回填结果"));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        try {
          emitFn(aiEventName, { id, system, user, model });
        } catch (e) {
          clearTimeout(timer);
          pending.delete(id);
          reject(e);
        }
      });
    },
  };
}

/** iframe 回填（由 `entry.js` 的 `credit.__llmResult` 调用） */
function resolveLlm({ id, text, error } = {}) {
  const p = pending.get(id);
  if (!p) return { ok: false, error: `无待回填的中继请求：${id}` };
  clearTimeout(p.timer);
  pending.delete(id);
  if (error) p.reject(new Error(String(error)));
  else p.resolve({ text: String(text ?? "") });
  return { ok: true };
}

function pendingCount() {
  return pending.size;
}

module.exports = {
  createRelayAi,
  resolveLlm,
  setEmitter,
  pendingCount,
  aiEventName,
  aiResultMethod,
  DEFAULT_TIMEOUT_MS,
};
