/* 自动生成（apps/miniapp/build.mjs）—— 源：source/worker/entry.js + @credit/*；请勿直接编辑本文件 */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../packages/analyzer/dist/llm/port.js
function hasJsonKeyword(messages) {
  return messages.some((m) => /\bjson\b/i.test(m.content ?? ""));
}
function ensureJsonMode(messages) {
  if (hasJsonKeyword(messages))
    return messages;
  const sysIdx = messages.findIndex((m) => m.role === "system");
  if (sysIdx >= 0) {
    const next = [...messages];
    next[sysIdx] = {
      role: "system",
      content: `${messages[sysIdx].content}
${JSON_MODE_HINT}`
    };
    return next;
  }
  return [{ role: "system", content: JSON_MODE_HINT }, ...messages];
}
function readApiKey(envName, env = globalThis.process?.env ?? {}) {
  const v = env[envName];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function stable(x) {
  if (Array.isArray(x))
    return x.map(stable);
  if (x && typeof x === "object") {
    const src = x;
    const out = {};
    for (const k of Object.keys(src).sort())
      out[k] = stable(src[k]);
    return out;
  }
  return x;
}
function hashInput(x) {
  const s = JSON.stringify(stable(x)) ?? "null";
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = h * prime & mask;
  }
  return h.toString(16).padStart(16, "0");
}
function makeCacheKey(spec, model) {
  return hashInput({
    metricId: spec.metricId,
    templateId: spec.templateId,
    model,
    input: spec.input
  });
}
function createMemoryCache() {
  const m = /* @__PURE__ */ new Map();
  return {
    get: (k) => m.get(k),
    set: (k, v) => void m.set(k, v)
  };
}
function validateJson(json, schema) {
  if (schema.type === "object") {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return `\u671F\u671B object\uFF0C\u5B9E\u9645 ${Array.isArray(json) ? "array" : typeof json}`;
    }
  }
  if (schema.type === "array" && !Array.isArray(json)) {
    return `\u671F\u671B array\uFF0C\u5B9E\u9645 ${typeof json}`;
  }
  if (schema.required && schema.required.length > 0) {
    if (!json || typeof json !== "object")
      return `\u671F\u671B object \u4EE5\u6821\u9A8C required`;
    const obj = json;
    const missing = schema.required.filter((k) => obj[k] === void 0);
    if (missing.length > 0)
      return `\u7F3A\u5C11\u5B57\u6BB5\uFF1A${missing.join(", ")}`;
  }
  return null;
}
var JSON_MODE_HINT, DEFAULT_LLM_CONFIG;
var init_port = __esm({
  "../../packages/analyzer/dist/llm/port.js"() {
    "use strict";
    JSON_MODE_HINT = "\uFF08\u8BF7\u4E25\u683C\u4EE5 json \u683C\u5F0F\u8F93\u51FA\uFF0C\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u989D\u5916\u6587\u5B57\uFF09";
    DEFAULT_LLM_CONFIG = {
      provider: "openai-compatible",
      openaiCompatible: {
        baseUrl: "https://api.chatanywhere.tech/v1",
        model: "deepseek-v4-flash",
        apiKeyEnv: "OPENAI_API_KEY"
      },
      bitfun: { model: "fast", fallbackModel: "primary" },
      /**
       * 180s —— **推理模型（reasoning）单次调用实测 47s**，原 60s 余量仅 13s，
       * 网络一波动就超时（`deepseek-v4-flash` 的 completion 中 reasoning_tokens 占绝大部分）。
       * 超时属可重试失败，但重试会让单次建模耗时翻倍，故默认直接给足。
       */
      timeoutMs: 18e4,
      retryPerModel: 1,
      cacheEnabled: true,
      descMaxInputChars: 1200,
      maxTasksPerBatch: 30
    };
  }
});

// ../../packages/analyzer/dist/llm/null-port.js
function createNullLlmPort() {
  return {
    id: "null",
    async isAvailable() {
      return false;
    },
    async complete(_spec) {
      return {
        ok: false,
        reason: "unavailable",
        message: "NullLlmPort\uFF1A\u901A\u9053\u672A\u542F\u7528\uFF08\u5355\u6D4B\u4E0E\u964D\u7EA7\u8DEF\u5F84\uFF09"
      };
    }
  };
}
var init_null_port = __esm({
  "../../packages/analyzer/dist/llm/null-port.js"() {
    "use strict";
  }
});

// ../../packages/analyzer/dist/llm/mock-port.js
function createMockLlmPort(opts = {}) {
  const responses = opts.responses ?? {};
  const calls = [];
  const available = opts.available ?? Object.keys(responses).length > 0;
  return {
    id: "null",
    // 对外仍报 null：mock 只是测试替身，不伪装成真实 provider
    calls,
    reset() {
      calls.length = 0;
    },
    async isAvailable() {
      return available;
    },
    async complete(spec) {
      calls.push(spec);
      const model = spec.model ?? "mock-model";
      if (!available) {
        return { ok: false, reason: "unavailable", message: "MockLlmPort\uFF1A\u672A\u542F\u7528" };
      }
      const reg = responses[spec.templateId];
      if (reg === void 0) {
        return {
          ok: false,
          reason: "error",
          message: `MockLlmPort\uFF1A\u672A\u6CE8\u518C templateId="${spec.templateId}"`
        };
      }
      let value;
      try {
        value = typeof reg === "function" ? await reg(spec) : reg;
      } catch (e) {
        const msg = String(e?.message ?? e);
        return {
          ok: false,
          reason: /timeout|timed?\s*out/i.test(msg) ? "timeout" : "error",
          message: msg
        };
      }
      if (value instanceof Error) {
        const msg = value.message;
        return {
          ok: false,
          reason: /timeout|timed?\s*out/i.test(msg) ? "timeout" : "invalid-json",
          message: msg
        };
      }
      const err = validateJson(value, spec.schema);
      if (err) {
        return { ok: false, reason: "schema", message: `Mock \u54CD\u5E94\u4E0D\u5408\u89C4\uFF1A${err}` };
      }
      return { ok: true, json: value, model, cached: false };
    }
  };
}
var init_mock_port = __esm({
  "../../packages/analyzer/dist/llm/mock-port.js"() {
    "use strict";
    init_port();
  }
});

// ../../packages/analyzer/dist/llm/openai-compatible.js
function extractContent(rawText) {
  const stripFence = (t) => {
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    return (fence?.[1] ?? t).trim();
  };
  try {
    const parsed = JSON.parse(rawText);
    const c = parsed?.choices?.[0]?.message?.content;
    if (typeof c !== "string")
      return null;
    return stripFence(c) || null;
  } catch {
    return stripFence(rawText) || null;
  }
}
function parseLooseJson(text) {
  const t = String(text ?? "").replace(/```(?:json)?/gi, "").trim();
  if (!t)
    return null;
  try {
    return JSON.parse(t);
  } catch {
  }
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"]
  ]) {
    const start = t.indexOf(open);
    if (start < 0)
      continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) {
        if (esc)
          esc = false;
        else if (c === "\\")
          esc = true;
        else if (c === '"')
          inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === open)
        depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(t.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}
function createOpenAILlmPort(opts) {
  const envName = opts.apiKeyEnv ?? "OPENAI_API_KEY";
  const env = opts.env;
  const timeoutMs = opts.timeoutMs ?? 18e4;
  const retry = Math.max(0, opts.retry ?? 1);
  const cache = opts.cache ?? null;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const base = opts.baseUrl.replace(/\/+$/, "");
  async function callOnce(spec, model, key) {
    if (!fetchImpl) {
      return {
        ok: false,
        reason: "unavailable",
        message: "\u8FD0\u884C\u73AF\u5883\u65E0 fetch \u5B9E\u73B0",
        retryable: false
      };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model,
          // DeepSeek 系：messages 必须含 "json" 字样，否则 JSON 模式不生效（见 port.ensureJsonMode）
          messages: ensureJsonMode([
            { role: "system", content: spec.system },
            { role: "user", content: spec.user }
          ]),
          response_format: { type: "json_object" },
          temperature: 0
        }),
        signal: ctrl.signal
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const retryable = res.status >= 500 || res.status === 429;
        const reason = retryable ? "timeout" : "error";
        return {
          ok: false,
          reason,
          message: `HTTP ${res.status}\uFF1A${body.slice(0, 200)}`,
          retryable
        };
      }
      const raw = await res.text();
      const content = extractContent(raw);
      if (content === null) {
        return {
          ok: false,
          reason: "invalid-json",
          message: `\u54CD\u5E94\u7ED3\u6784\u5F02\u5E38\uFF0C\u53D6\u4E0D\u5230 choices[0].message.content\uFF1A${raw.slice(0, 200)}`
        };
      }
      let json;
      try {
        json = JSON.parse(content);
      } catch {
        json = parseLooseJson(content);
        if (json == null) {
          return {
            ok: false,
            reason: "invalid-json",
            message: `\u6A21\u578B\u8F93\u51FA\u975E\u5408\u6CD5 JSON\uFF1A${content.slice(0, 200)}`
          };
        }
      }
      const err = validateJson(json, spec.schema);
      if (err)
        return { ok: false, reason: "schema", message: err };
      return { ok: true, json, model, cached: false };
    } catch (e) {
      const name = e?.name;
      if (name === "AbortError") {
        return { ok: false, reason: "timeout", message: `\u8D85\u65F6 ${timeoutMs}ms` };
      }
      return { ok: false, reason: "error", message: String(e?.message ?? e) };
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    id: "openai-compatible",
    async isAvailable() {
      return !!(opts.apiKey || readApiKey(envName, env)) && !!fetchImpl;
    },
    async complete(spec) {
      const key = opts.apiKey || readApiKey(envName, env);
      if (!key) {
        return {
          ok: false,
          reason: "unavailable",
          message: `\u672A\u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF ${envName}`
        };
      }
      if (!fetchImpl) {
        return {
          ok: false,
          reason: "unavailable",
          message: "\u8FD0\u884C\u73AF\u5883\u65E0 fetch \u5B9E\u73B0"
        };
      }
      const model = spec.model ?? opts.model;
      if (cache) {
        const hit = cache.get(makeCacheKey(spec, model));
        if (hit !== void 0)
          return { ok: true, json: hit, model, cached: true };
      }
      let last = {
        ok: false,
        reason: "error",
        message: "\u672A\u53D1\u8D77\u8C03\u7528"
      };
      for (let attempt = 0; attempt <= retry; attempt++) {
        const r = await callOnce(spec, model, key);
        if (r.ok) {
          if (cache)
            cache.set(makeCacheKey(spec, model), r.json);
          return r;
        }
        last = r;
        if (r.retryable === false)
          break;
        if (attempt < retry)
          await sleep(500 * (attempt + 1));
      }
      return last;
    }
  };
}
var defaultSleep;
var init_openai_compatible = __esm({
  "../../packages/analyzer/dist/llm/openai-compatible.js"() {
    "use strict";
    init_port();
    defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
  }
});

// ../../packages/analyzer/dist/llm/bitfun-port.js
function createBitfunLlmPort(opts) {
  const cache = opts.cache ?? null;
  const defaultModel = opts.model ?? "fast";
  const fallbackModel = opts.fallbackModel ?? "primary";
  return {
    id: "bitfun",
    async isAvailable() {
      return !!opts.ai;
    },
    async complete(spec) {
      const ai = opts.ai;
      if (!ai) {
        return {
          ok: false,
          reason: "unavailable",
          message: "BitfunLlmPort\uFF1A\u672A\u6CE8\u5165 app.ai\uFF08P4 \u524D\u9884\u671F\u5982\u6B64\uFF09"
        };
      }
      const model = spec.model ?? defaultModel;
      if (cache) {
        const hit = cache.get(makeCacheKey(spec, model));
        if (hit !== void 0)
          return { ok: true, json: hit, model, cached: true };
      }
      for (const m of [model, fallbackModel]) {
        try {
          const res = await ai.complete({ system: spec.system, user: spec.user, model: m });
          const text = typeof res === "string" ? res : res?.text ?? "";
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            continue;
          }
          const err = validateJson(json, spec.schema);
          if (err)
            continue;
          if (cache)
            cache.set(makeCacheKey(spec, model), json);
          return { ok: true, json, model: m, cached: false };
        } catch {
          continue;
        }
      }
      return {
        ok: false,
        reason: "error",
        message: `BitfunLlmPort\uFF1A${model} \u4E0E ${fallbackModel} \u5747\u5931\u8D25`
      };
    }
  };
}
var init_bitfun_port = __esm({
  "../../packages/analyzer/dist/llm/bitfun-port.js"() {
    "use strict";
    init_port();
  }
});

// ../../packages/analyzer/dist/llm/index.js
var init_llm = __esm({
  "../../packages/analyzer/dist/llm/index.js"() {
    "use strict";
    init_port();
    init_null_port();
    init_mock_port();
    init_openai_compatible();
    init_bitfun_port();
  }
});

// ../../packages/analyzer/dist/task/types.js
var ALL_STAGES, STAGE_LABELS, TASK_GRAPH_VERSION;
var init_types = __esm({
  "../../packages/analyzer/dist/task/types.js"() {
    "use strict";
    ALL_STAGES = [
      "spec-engineering",
      "test-planning",
      "ai-code-generation",
      "ai-testing",
      "ai-fix",
      "manual-verification",
      "ai-review"
    ];
    STAGE_LABELS = {
      "spec-engineering": { "zh-CN": "SPEC\u5DE5\u7A0B", "en-US": "SPEC Engineering" },
      "test-planning": { "zh-CN": "\u6D4B\u8BD5\u65B9\u6848\u51C6\u5907", "en-US": "Test Planning" },
      "ai-code-generation": { "zh-CN": "AI\u4EE3\u7801\u751F\u6210", "en-US": "AI Code Generation" },
      "ai-testing": { "zh-CN": "AI\u8F6F\u4EF6\u6D4B\u8BD5", "en-US": "AI Testing" },
      "ai-fix": { "zh-CN": "AI\u4EE3\u7801\u4FEE\u590D", "en-US": "AI Fix" },
      "manual-verification": { "zh-CN": "\u4EBA\u5DE5\u8865\u6D4B\u9A8C\u8BC1", "en-US": "Manual Verification" },
      "ai-review": { "zh-CN": "AI Review", "en-US": "AI Review" },
      unknown: { "zh-CN": "\u672A\u5F52\u7C7B", "en-US": "Unclassified" }
    };
    TASK_GRAPH_VERSION = "1.0";
  }
});

// ../../packages/analyzer/dist/task/config.js
function mergeTaskConfig(override) {
  return override ? { ...DEFAULT_TASK_CONFIG, ...override } : { ...DEFAULT_TASK_CONFIG };
}
function isTestCommand(cmd, patterns) {
  if (!cmd)
    return false;
  const c = String(cmd).toLowerCase();
  return patterns.some((p) => c.includes(p.toLowerCase()));
}
var DEFAULT_TEST_CMD_PATTERNS, DEFAULT_REVIEW_SESSION_PATTERN, DEFAULT_REVIEW_TOOL_NAMES, DEFAULT_REVIEW_PROMPT_WORDS, DEFAULT_FINDING_PATTERNS, DEFAULT_SPEC_WORDS, DEFAULT_TEST_PLAN_WORDS, DEFAULT_MANUAL_VERIFY_WORDS, DEFAULT_FIX_WORDS, DEFAULT_TASK_CONFIG;
var init_config = __esm({
  "../../packages/analyzer/dist/task/config.js"() {
    "use strict";
    DEFAULT_TEST_CMD_PATTERNS = [
      "npm test",
      "npx jest",
      "npx vitest",
      "yarn test",
      "pnpm test",
      "pytest",
      "python -m pytest",
      "go test",
      "mvn test",
      "gradle test",
      "cargo test",
      "make test",
      "dotnet test",
      "bun test",
      "deno test"
    ];
    DEFAULT_REVIEW_SESSION_PATTERN = "review_child_review";
    DEFAULT_REVIEW_TOOL_NAMES = ["submit_code_review"];
    DEFAULT_REVIEW_PROMPT_WORDS = [
      "review",
      "\u5BA1\u67E5",
      "\u5BA1\u9605",
      "\u8BC4\u5BA1",
      "\u4EE3\u7801\u8BC4\u5BA1",
      "adversarial"
    ];
    DEFAULT_FINDING_PATTERNS = [
      "severity",
      "blocking",
      "must fix",
      "## \u95EE\u9898",
      "finding",
      "\u5EFA\u8BAE\u4FEE\u6539",
      "review finding"
    ];
    DEFAULT_SPEC_WORDS = [
      "SPEC",
      "\u89C4\u683C",
      "\u9700\u6C42",
      "\u8FB9\u754C",
      "\u8303\u56F4",
      "\u5212\u5B9A",
      "\u6309\u65B9\u6848",
      "\u65B9\u6848A",
      "\u65B9\u6848B",
      "\u65B9\u6848\u4E00",
      "\u65B9\u6848\u4E8C",
      "\u8C03\u7814",
      "\u63A2\u7D22\u73B0\u6709",
      "\u53EF\u884C\u6027",
      "\u9A8C\u6536\u6807\u51C6",
      "scope",
      "requirement"
    ];
    DEFAULT_TEST_PLAN_WORDS = [
      "\u6D4B\u8BD5\u7528\u4F8B",
      "\u6D4B\u8BD5\u65B9\u6848",
      "\u6D4B\u8BD5\u8BA1\u5212",
      "\u6D4B\u8BD5\u9A8C\u6536",
      "\u9A8C\u6536\u7528\u4F8B",
      "\u7F16\u5199\u6D4B\u8BD5",
      "\u5199\u6D4B\u8BD5",
      "\u8865\u5145\u6D4B\u8BD5",
      "\u589E\u52A0.*\u7528\u4F8B",
      "\u8FB9\u754C\u7528\u4F8B",
      "\u5F02\u5E38\u7528\u4F8B",
      "\u6D4B\u8BD5\u9A71\u52A8",
      "\u6D4B\u8BD5\u97F3\u9891",
      "\u6D4B\u8BD5\u6570\u636E",
      "test case",
      "test plan"
    ];
    DEFAULT_MANUAL_VERIFY_WORDS = [
      "\u4EBA\u5DE5\u9A8C\u8BC1",
      "\u4EBA\u5DE5\u590D\u6D4B",
      "\u4EBA\u5DE5\u6D4B\u8BD5",
      "\u624B\u52A8\u9A8C\u8BC1",
      "\u624B\u52A8\u6D4B\u8BD5",
      "\u6211\u8BD5\u4E86",
      "\u6211\u6D4B\u4E86",
      "\u5B9E\u6D4B",
      "\u5B9E\u9645\u64CD\u4F5C",
      "dev\u9A8C\u8BC1",
      "manual test",
      "manually verified",
      "i tested",
      "i tried"
    ];
    DEFAULT_FIX_WORDS = [
      "\u4FEE\u590D",
      "\u4FEE\u4E00\u4E0B",
      "\u62A5\u9519",
      "\u89E3\u51B3\u8FD9\u4E2A",
      "\u5931\u8D25\u539F\u56E0",
      "\u8FD8\u662F\u4E0D\u884C",
      "\u4ECD\u7136\u5931\u8D25",
      "\u8BCA\u65AD",
      "\u539F\u56E0",
      "\u4F9D\u7136",
      "remediation",
      "fix",
      "error",
      "failed",
      "not working",
      "still broken"
    ];
    DEFAULT_TASK_CONFIG = {
      idleGapMs: 18e5,
      // 30min
      minClusterSize: 3,
      fileIdleMs: 6e5,
      // 10min
      enableFileSwitch: false,
      descMaxChars: 80,
      descMaxInputChars: 1200,
      maxTasksPerBatch: 30,
      testCmdPatterns: [...DEFAULT_TEST_CMD_PATTERNS],
      reviewSessionPattern: DEFAULT_REVIEW_SESSION_PATTERN,
      reviewToolNames: [...DEFAULT_REVIEW_TOOL_NAMES],
      reviewPromptWords: [...DEFAULT_REVIEW_PROMPT_WORDS],
      findingPatterns: [...DEFAULT_FINDING_PATTERNS],
      manualVerifyWords: [...DEFAULT_MANUAL_VERIFY_WORDS],
      fixWords: [...DEFAULT_FIX_WORDS],
      specWords: [...DEFAULT_SPEC_WORDS],
      testPlanWords: [...DEFAULT_TEST_PLAN_WORDS]
    };
  }
});

// ../../packages/analyzer/dist/task/segment.js
function fileUriOf(b) {
  return b.object?.kind === "file" && b.object.uri ? b.object.uri : null;
}
function sessionIdOf(b) {
  return b.context?.sessionId ?? null;
}
function segmentBehaviors(behaviors, cfgOverride) {
  const cfg = mergeTaskConfig(cfgOverride);
  const cutSignals = {
    prompt: 0,
    idleGap: 0,
    testCmd: 0,
    reviewSwitch: 0,
    fileSwitch: 0
  };
  if (behaviors.length === 0)
    return { clusters: [], cutSignals };
  const cuts = /* @__PURE__ */ new Set();
  let activeFile = null;
  const lastTouched = /* @__PURE__ */ new Map();
  for (let i = 1; i < behaviors.length; i++) {
    const b = behaviors[i];
    const prev = behaviors[i - 1];
    if (b.action === "prompt.submit") {
      cuts.add(i);
      cutSignals.prompt = (cutSignals.prompt ?? 0) + 1;
      const f2 = fileUriOf(b);
      if (f2) {
        activeFile = f2;
        lastTouched.set(f2, b.ts);
      }
      continue;
    }
    if (b.ts - prev.ts > cfg.idleGapMs) {
      cuts.add(i);
      cutSignals.idleGap = (cutSignals.idleGap ?? 0) + 1;
      const f2 = fileUriOf(b);
      if (f2) {
        activeFile = f2;
        lastTouched.set(f2, b.ts);
      }
      continue;
    }
    if (b.action === "terminal.exec" && b.actor === "dev" && isTestCommand(b.context?.cmd, cfg.testCmdPatterns)) {
      cuts.add(i);
      cutSignals.testCmd = (cutSignals.testCmd ?? 0) + 1;
      continue;
    }
    const curSid = sessionIdOf(b);
    const prevSid = sessionIdOf(prev);
    if (curSid && prevSid && curSid !== prevSid) {
      cuts.add(i);
      cutSignals.reviewSwitch = (cutSignals.reviewSwitch ?? 0) + 1;
      continue;
    }
    const f = fileUriOf(b);
    if (f) {
      if (cfg.enableFileSwitch && f !== activeFile) {
        const prevTouch = lastTouched.get(f);
        if (prevTouch === void 0 || b.ts - prevTouch > cfg.fileIdleMs) {
          cuts.add(i);
          cutSignals.fileSwitch = (cutSignals.fileSwitch ?? 0) + 1;
        }
        activeFile = f;
      }
      lastTouched.set(f, b.ts);
    }
  }
  const raw = [];
  let start = 0;
  for (const c of [...cuts].sort((a, b) => a - b)) {
    if (c > start)
      raw.push(behaviors.slice(start, c));
    start = c;
  }
  if (start < behaviors.length)
    raw.push(behaviors.slice(start));
  const merged = [];
  for (const cl of raw) {
    if (merged.length > 0 && cl.length < cfg.minClusterSize) {
      const last = merged[merged.length - 1];
      merged[merged.length - 1] = last.concat(cl);
    } else {
      merged.push(cl);
    }
  }
  if (merged.length > 1) {
    const last = merged[merged.length - 1];
    if (last.length < cfg.minClusterSize) {
      merged.pop();
      const prevLast = merged[merged.length - 1];
      merged[merged.length - 1] = prevLast.concat(last);
    }
  }
  return { clusters: merged, cutSignals };
}
var init_segment = __esm({
  "../../packages/analyzer/dist/task/segment.js"() {
    "use strict";
    init_config();
  }
});

// ../../packages/analyzer/dist/task/testrun.js
function parseOutput(output, exitCode) {
  const text = typeof output === "string" ? output : "";
  if (text) {
    let m = text.match(RE_CARGO);
    if (m) {
      const passed = Number(m[2]);
      const failed = Number(m[3]);
      return { passed, failed, total: passed + failed, parseOk: true };
    }
    m = text.match(RE_JEST_FAIL);
    if (m) {
      return {
        failed: Number(m[1]),
        passed: Number(m[2]),
        total: Number(m[3]),
        parseOk: true
      };
    }
    m = text.match(RE_JEST_PASS);
    if (m)
      return { passed: Number(m[1]), failed: 0, total: Number(m[2]), parseOk: true };
    m = text.match(RE_PYTEST);
    if (m) {
      const passed = Number(m[1]);
      const failed = m[2] ? Number(m[2]) : 0;
      return { passed, failed, total: passed + failed, parseOk: true };
    }
    if (RE_GO_OK.test(text) || RE_GO_FAIL.test(text)) {
      const failed = (text.match(/^---\s*FAIL:/gm) ?? []).length;
      const okCount = (text.match(/^ok\s+\S+/gm) ?? []).length;
      return { passed: okCount, failed, total: okCount + failed, parseOk: true };
    }
  }
  if (exitCode !== null && exitCode !== void 0) {
    return exitCode === 0 ? { passed: null, failed: 0, total: null, parseOk: false } : { passed: null, failed: 1, total: null, parseOk: false };
  }
  return { passed: null, failed: null, total: null, parseOk: false };
}
function cmdOf(b) {
  if (b.action === "terminal.exec") {
    const c = b.context?.cmd;
    return typeof c === "string" && c.trim() ? c : null;
  }
  if (b.action === "agent.tool") {
    const tool = String(b.context?.toolName ?? "");
    if (!/exec|bash|shell|command/i.test(tool))
      return null;
    const inp = b.context?.toolInput;
    const c = inp?.cmd ?? inp?.command;
    return typeof c === "string" && c.trim() ? c : null;
  }
  return null;
}
function detectTestRuns(behaviors, cfgOverride) {
  const cfg = mergeTaskConfig(cfgOverride);
  const candidates = [];
  for (const b of behaviors) {
    const cmd = cmdOf(b);
    if (!cmd)
      continue;
    if (!isTestCommand(cmd, cfg.testCmdPatterns))
      continue;
    candidates.push({ b, cmd, actor: b.actor === "ai" ? "ai" : "dev" });
  }
  if (candidates.length === 0)
    return [];
  const runs = [];
  let i = 0;
  while (i < candidates.length) {
    const c0 = candidates[i];
    let j = i + 1;
    let last = c0;
    while (j < candidates.length && candidates[j].cmd === c0.cmd && candidates[j].b.ts - last.b.ts < DEDUP_MS) {
      last = candidates[j];
      j++;
    }
    const group = candidates.slice(i, j);
    const withCode = group.filter((g) => g.b.context?.exitCode !== null && g.b.context?.exitCode !== void 0);
    const pick = withCode[withCode.length - 1] ?? group[group.length - 1];
    const exitCode = pick.b.context?.exitCode === void 0 ? null : pick.b.context.exitCode ?? null;
    const parsed = parseOutput(typeof pick.b.context?.output === "string" ? pick.b.context.output : null, exitCode);
    runs.push({
      id: `run-${runs.length + 1}`,
      behaviorId: pick.b.id,
      cmd: c0.cmd,
      ts: c0.b.ts,
      actor: c0.actor,
      passed: parsed.passed,
      failed: parsed.failed,
      total: parsed.total,
      exitCode,
      parseOk: parsed.parseOk
    });
    i = j;
  }
  return runs;
}
function hasFailedRun(runs) {
  return runs.some((r) => (r.failed ?? 0) > 0);
}
var DEDUP_MS, RE_CARGO, RE_JEST_FAIL, RE_JEST_PASS, RE_PYTEST, RE_GO_OK, RE_GO_FAIL;
var init_testrun = __esm({
  "../../packages/analyzer/dist/task/testrun.js"() {
    "use strict";
    init_config();
    DEDUP_MS = 5e3;
    RE_CARGO = /test result:\s*(ok|FAILED)\.\s*(\d+)\s*passed;\s*(\d+)\s*failed/i;
    RE_JEST_FAIL = /Tests:\s*(\d+)\s*failed[\s\S]{0,80}?(\d+)\s*passed[\s\S]{0,80}?(\d+)\s*total/i;
    RE_JEST_PASS = /Tests:\s*(\d+)\s*passed[\s\S]{0,80}?(\d+)\s*total/i;
    RE_PYTEST = /(\d+)\s*passed(?:[,\s]+(\d+)\s*failed)?/i;
    RE_GO_OK = /^ok\s+\S+/m;
    RE_GO_FAIL = /^---\s*FAIL:/m;
  }
});

// ../../packages/analyzer/dist/task/review.js
function hasAny(text, words) {
  if (!text)
    return false;
  const t = String(text).toLowerCase();
  return words.some((w) => t.includes(String(w).toLowerCase()));
}
function reviewSignalOf(b, cfg) {
  const sid = b.context?.sessionId ?? "";
  const tool = b.context?.toolName ?? "";
  const isReviewSid = !!cfg.reviewSessionPattern && sid.toLowerCase().includes(cfg.reviewSessionPattern.toLowerCase());
  const isReviewTool = cfg.reviewToolNames.some((n) => tool.toLowerCase() === n.toLowerCase());
  if (isReviewSid && b.action === "prompt.submit" || isReviewTool) {
    return { level: "L1", anchor: true };
  }
  if (b.action === "prompt.submit") {
    const text = b.context?.promptText ?? "";
    if (hasAny(text, cfg.reviewPromptWords))
      return { level: "L2", anchor: true };
  }
  if (isReviewSid)
    return { level: "L1", anchor: false };
  if (b.action === "agent.message") {
    const text = typeof b.context?.after === "string" ? b.context.after : "";
    if (hasAny(text, cfg.findingPatterns))
      return { level: "L3", anchor: false };
  }
  return null;
}
function isReviewBehavior(b, cfgIn) {
  return reviewSignalOf(b, mergeTaskConfig(cfgIn)) !== null;
}
function detectDisposition(behaviors) {
  for (const b of behaviors) {
    if (b.action !== "prompt.submit")
      continue;
    const t = String(b.context?.promptText ?? "");
    if (!t)
      continue;
    const low = t.toLowerCase();
    if (/selected\s+review\s+findings|selected\s+findings|remediation\s+for\s+selected/i.test(low)) {
      return { disposition: "selected", evidence: b.id };
    }
    if (/dismiss|won'?t\s*fix|不修|忽略/i.test(low)) {
      return { disposition: "dismissed", evidence: b.id };
    }
    if (/all\s+findings|fix\s+all|全部修复|全部采纳/i.test(low)) {
      return { disposition: "all", evidence: b.id };
    }
  }
  return { disposition: null, evidence: "" };
}
function detectReviewSessions(behaviors, cfgOverride) {
  const cfg = mergeTaskConfig(cfgOverride);
  const hits = [];
  for (const b of behaviors) {
    const sig = reviewSignalOf(b, cfg);
    if (sig)
      hits.push({ b, level: sig.level });
  }
  if (hits.length === 0)
    return [];
  const anchors = hits.filter((h) => reviewSignalOf(h.b, cfg)?.anchor);
  if (anchors.length === 0)
    return [];
  const groups = /* @__PURE__ */ new Map();
  for (const h of anchors) {
    const key = h.b.context?.sessionId || "anon";
    const arr = groups.get(key) ?? [];
    arr.push(h);
    groups.set(key, arr);
  }
  const rounds = [];
  for (const [sid, items] of groups) {
    items.sort((x, y) => x.b.ts - y.b.ts);
    let cur = [];
    for (const it of items) {
      const prev = cur[cur.length - 1];
      if (prev && it.b.ts - prev.b.ts > cfg.idleGapMs && cur.length > 0) {
        rounds.push({ sid, items: cur });
        cur = [];
      }
      cur.push(it);
    }
    if (cur.length > 0)
      rounds.push({ sid, items: cur });
  }
  if (rounds.length === 0)
    return [];
  rounds.sort((a, b) => (a.items[0]?.b.ts ?? 0) - (b.items[0]?.b.ts ?? 0));
  const starts = rounds.map((r) => r.items[0].b.ts);
  const sessions = rounds.map((r, i) => {
    const bs = r.items.map((x) => x.b);
    const startTs = starts[i];
    const lastAnchorTs = bs[bs.length - 1].ts;
    const nextStart = starts[i + 1];
    const endTs = Math.min(nextStart ?? Number.POSITIVE_INFINITY, lastAnchorTs + EXEC_WINDOW_MS);
    const all = hits.filter((h) => h.b.ts >= startTs && h.b.ts <= endTs).map((h) => h.b).sort((a, b) => a.ts - b.ts);
    const level = r.items.reduce((acc, x) => LEVEL_RANK[x.level] > LEVEL_RANK[acc] ? x.level : acc, "L3");
    const { disposition, evidence } = detectDisposition(all);
    return {
      id: `review-${i + 1}`,
      sessionId: r.sid,
      level,
      confidence: LEVEL_CONFIDENCE[level],
      startTs,
      endTs,
      behaviorIds: all.map((x) => x.id),
      roundIndex: i + 1,
      disposition,
      evidence
    };
  });
  return sessions;
}
var LEVEL_CONFIDENCE, LEVEL_RANK, EXEC_WINDOW_MS;
var init_review = __esm({
  "../../packages/analyzer/dist/task/review.js"() {
    "use strict";
    init_config();
    LEVEL_CONFIDENCE = { L1: 0.9, L2: 0.6, L3: 0.3 };
    LEVEL_RANK = { L1: 3, L2: 2, L3: 1 };
    EXEC_WINDOW_MS = 18e4;
  }
});

// ../../packages/analyzer/dist/task/stage.js
function hasAny2(text, words) {
  if (typeof text !== "string" || !text)
    return false;
  const t = text.toLowerCase();
  return words.some((w) => t.includes(String(w).toLowerCase()));
}
function inWindows(ts, wins) {
  return wins.some((w) => ts >= w.startTs && ts <= w.endTs);
}
function isDocUri(uri) {
  if (typeof uri !== "string" || !uri)
    return false;
  if (!/\.(md|markdown|txt)$/i.test(uri))
    return false;
  return !/(^|[\\/])readme/i.test(uri);
}
function isCodeEdit(b) {
  return b.action === "edit" && !isDocUri(b.object?.uri);
}
function classifyWindow(bs, ctx) {
  if (bs.length === 0)
    return "unknown";
  const cfg = ctx.config;
  if (bs.some((b) => ctx.reviewBehaviorIds.has(b.id)))
    return "ai-review";
  const inFix = bs.some((b) => inWindows(b.ts, ctx.fixWindows));
  const hasCodeEdit = bs.some(isCodeEdit);
  const hasDocActivity = bs.some((b) => isDocUri(b.object?.uri) && (b.action === "edit" || b.action === "view" || b.action === "file.scroll" || b.action === "file.open"));
  if (inFix) {
    const fixPrompt = bs.some((b) => b.action === "prompt.submit" && hasAny2(b.context?.promptText, cfg.fixWords));
    if (fixPrompt)
      return "ai-fix";
  }
  if (bs.some((b) => b.action === "prompt.submit" && hasAny2(b.context?.promptText, cfg.manualVerifyWords))) {
    return "manual-verification";
  }
  {
    const hasTestRun = bs.some((b) => ctx.testRunBehaviorIds.has(b.id));
    if (hasTestRun) {
      const devTriggered = bs.some((b) => ctx.testRunBehaviorIds.has(b.id) && b.actor === "dev");
      if (devTriggered || !hasCodeEdit)
        return "ai-testing";
    }
  }
  if (!inFix) {
    const testArtifactEdit = bs.some((b) => b.action === "edit" && (b.object?.role === "test" || b.object?.role === "test-plan"));
    const testPlanPrompt = bs.some((b) => b.action === "prompt.submit" && hasAny2(b.context?.promptText, cfg.testPlanWords));
    if (testArtifactEdit)
      return "test-planning";
    if (testPlanPrompt && !hasCodeEdit)
      return "test-planning";
  }
  const specActivity = bs.some((b) => b.object?.role === "spec" && (b.action === "edit" || b.action === "view" || b.action === "file.scroll" || b.action === "file.open"));
  if (specActivity)
    return "spec-engineering";
  const specPrompt = bs.some((b) => b.action === "prompt.submit" && hasAny2(b.context?.promptText, cfg.specWords));
  if (!hasCodeEdit && (hasDocActivity || specPrompt))
    return "spec-engineering";
  return "ai-code-generation";
}
function splitSubspans(bs, ctx) {
  const cfg = ctx.config;
  const cuts = /* @__PURE__ */ new Set();
  for (let i = 1; i < bs.length; i++) {
    const b = bs[i];
    const prev = bs[i - 1];
    if (b.action === "prompt.submit") {
      cuts.add(i);
      continue;
    }
    if (b.action === "terminal.exec" && isTestCommand(b.context?.cmd, cfg.testCmdPatterns)) {
      cuts.add(i);
      continue;
    }
    if (ctx.reviewBehaviorIds.has(b.id) !== ctx.reviewBehaviorIds.has(prev.id)) {
      cuts.add(i);
      continue;
    }
  }
  const firstCodeEdit = bs.findIndex(isCodeEdit);
  if (firstCodeEdit > 0)
    cuts.add(firstCodeEdit);
  const out = [];
  let start = 0;
  for (const c of [...cuts].sort((a, b) => a - b)) {
    if (c > start)
      out.push([start, c]);
    start = c;
  }
  if (start < bs.length)
    out.push([start, bs.length]);
  return out.length > 0 ? out : [[0, bs.length]];
}
function annotateStages(bs, ctx) {
  if (bs.length === 0) {
    return { stage: "unknown", spans: [], stageConfidence: 0 };
  }
  const ranges = splitSubspans(bs, ctx);
  const durations = ranges.map(([s, e]) => {
    const seg = bs.slice(s, e);
    const d = (seg[seg.length - 1]?.ts ?? 0) - (seg[0]?.ts ?? 0);
    return d > 0 ? d : seg.length;
  });
  const total = durations.reduce((a, b) => a + b, 0) || 1;
  const rawSpans = ranges.map(([s, e], i) => {
    const seg = bs.slice(s, e);
    return {
      stage: classifyWindow(seg, ctx),
      startIdx: s,
      endIdx: e,
      weight: Number((durations[i] / total).toFixed(4)),
      startTs: seg[0]?.ts ?? 0,
      endTs: seg[seg.length - 1]?.ts ?? 0
    };
  });
  const coalesce = (list) => {
    const out = [];
    for (const sp of list) {
      const last = out[out.length - 1];
      if (last && last.stage === sp.stage) {
        last.endIdx = sp.endIdx;
        last.endTs = sp.endTs;
        last.weight += sp.weight;
      } else {
        out.push({ ...sp });
      }
    }
    return out;
  };
  let spans = coalesce(rawSpans);
  if (spans.length > 1) {
    const kept = [];
    for (const sp of spans) {
      if (sp.weight < MIN_SPAN_WEIGHT && kept.length > 0) {
        const last = kept[kept.length - 1];
        last.endIdx = sp.endIdx;
        last.endTs = sp.endTs;
        last.weight += sp.weight;
      } else {
        kept.push({ ...sp });
      }
    }
    spans = coalesce(kept);
  }
  const wSum = spans.reduce((s, x) => s + x.weight, 0) || 1;
  for (const sp of spans)
    sp.weight = Number((sp.weight / wSum).toFixed(4));
  let best = spans[0];
  for (const sp of spans) {
    if (sp.weight > best.weight)
      best = sp;
  }
  return {
    stage: best.stage,
    spans,
    stageConfidence: Number(best.weight.toFixed(4))
  };
}
function buildFixWindows(runs, windowMs = DEFAULT_FIX_WINDOW_MS) {
  return runs.filter((r) => (r.failed ?? 0) > 0).map((r) => ({ startTs: r.ts, endTs: r.ts + windowMs }));
}
function makeClassifyContext(behaviors, runs, reviewBehaviorIds, cfgOverride, fixWindowMs = DEFAULT_FIX_WINDOW_MS) {
  return {
    config: mergeTaskConfig(cfgOverride),
    reviewBehaviorIds,
    testRunBehaviorIds: new Set(runs.map((r) => r.behaviorId)),
    fixWindows: buildFixWindows(runs, fixWindowMs)
  };
}
var DEFAULT_FIX_WINDOW_MS, MIN_SPAN_WEIGHT;
var init_stage = __esm({
  "../../packages/analyzer/dist/task/stage.js"() {
    "use strict";
    init_config();
    DEFAULT_FIX_WINDOW_MS = 18e5;
    MIN_SPAN_WEIGHT = 0.02;
  }
});

// ../../packages/analyzer/dist/task/desc.js
function cleanPrompt(raw, maxChars) {
  if (typeof raw !== "string" || !raw.trim()) {
    return { text: "", systemTemplate: false, templateLabel: null };
  }
  const stripped = raw.replace(INJECTED_BLOCK, " ").replace(/\s+/g, " ").trim();
  if (!stripped)
    return { text: "", systemTemplate: false, templateLabel: null };
  for (const t of SYSTEM_TEMPLATES) {
    if (t.re.test(stripped)) {
      return { text: "", systemTemplate: true, templateLabel: t.label };
    }
  }
  const text = stripped.length > maxChars ? `${stripped.slice(0, maxChars)}\u2026` : stripped;
  return { text, systemTemplate: false, templateLabel: null };
}
function firstSentence(text, maxChars) {
  const m = text.match(/^[^。！？\n.!?]{0,200}[。！？.!?]?/);
  let s = (m?.[0] ?? text).trim();
  if (s.length > maxChars)
    s = `${s.slice(0, maxChars)}\u2026`;
  return s || text.slice(0, maxChars);
}
function fallbackDesc(input, cfg) {
  if (input.systemTemplate && input.templateLabel) {
    return { desc: input.templateLabel, taskType: "review", source: "prompt" };
  }
  if (input.promptText) {
    const desc = input.promptText.length > cfg.descMaxChars ? `${input.promptText.slice(0, cfg.descMaxChars)}\u2026` : input.promptText;
    return { desc, taskType: null, source: "prompt" };
  }
  if (input.agentMessage) {
    return {
      desc: firstSentence(input.agentMessage, cfg.descMaxChars),
      taskType: null,
      source: "agent-message"
    };
  }
  return { desc: null, taskType: null, source: "rule" };
}
function toPayload(t) {
  return {
    id: t.taskId,
    prompt: t.systemTemplate ? null : t.promptText || null,
    systemLabel: t.systemTemplate ? t.templateLabel : null,
    agentMessage: t.agentMessage ? t.agentMessage.slice(0, 400) : null,
    summary: t.behaviorSummary,
    files: t.files.slice(0, 5),
    stage: t.stage
  };
}
async function generateDescs(inputs, llm, cfgOverride) {
  const cfg = mergeTaskConfig(cfgOverride);
  const results = /* @__PURE__ */ new Map();
  let llmCalls = 0;
  let fallbackCount = 0;
  if (inputs.length === 0)
    return { results, llmCalls, fallbackCount };
  let available = false;
  try {
    available = await llm.isAvailable();
  } catch {
    available = false;
  }
  if (!available) {
    for (const t of inputs) {
      results.set(t.taskId, fallbackDesc(t, cfg));
      fallbackCount++;
    }
    return { results, llmCalls, fallbackCount };
  }
  for (let i = 0; i < inputs.length; i += cfg.maxTasksPerBatch) {
    const batch = inputs.slice(i, i + cfg.maxTasksPerBatch);
    const payload = batch.map(toPayload);
    let ok2 = false;
    try {
      const r = await llm.complete({
        metricId: "task-desc",
        templateId: "task-desc-v1",
        system: SYSTEM_PROMPT,
        user: JSON.stringify({ tasks: payload }),
        input: { tasks: payload },
        schema: { type: "object", required: ["tasks"] }
      });
      llmCalls++;
      if (r.ok) {
        const parsed = r.json;
        const arr = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
        const byId = new Map(arr.filter((x) => x?.id).map((x) => [String(x.id), x]));
        for (const t of batch) {
          const hit = byId.get(t.taskId);
          const desc = typeof hit?.desc === "string" && hit.desc.trim() ? hit.desc.trim() : null;
          if (desc) {
            results.set(t.taskId, {
              desc,
              taskType: hit?.taskType ?? null,
              source: "llm"
            });
          } else {
            results.set(t.taskId, fallbackDesc(t, cfg));
            fallbackCount++;
          }
        }
        ok2 = true;
      }
    } catch {
    }
    if (!ok2) {
      for (const t of batch) {
        results.set(t.taskId, fallbackDesc(t, cfg));
        fallbackCount++;
      }
    }
  }
  return { results, llmCalls, fallbackCount };
}
var INJECTED_BLOCK, SYSTEM_TEMPLATES, SYSTEM_PROMPT;
var init_desc = __esm({
  "../../packages/analyzer/dist/task/desc.js"() {
    "use strict";
    init_config();
    INJECTED_BLOCK = /\[(?:Directory|File|SelectedText|Attachment|Context):[^\]]*\]/gi;
    SYSTEM_TEMPLATES = [
      {
        re: /^perform an independent adversarial review/i,
        label: "\u6267\u884C AI Review"
      },
      {
        re: /the user approved remediation for selected review findings/i,
        label: "\u9009\u62E9\u6027\u91C7\u7EB3 Review \u610F\u89C1\u5E76\u6388\u6743\u4FEE\u590D"
      },
      {
        re: /the user approved remediation for all review findings/i,
        label: "\u5168\u76D8\u91C7\u7EB3 Review \u610F\u89C1\u5E76\u6388\u6743\u4FEE\u590D"
      },
      {
        re: /the user dismissed all review findings/i,
        label: "\u9A73\u56DE\u5168\u90E8 Review \u610F\u89C1"
      }
    ];
    SYSTEM_PROMPT = `\u4F60\u662F\u8F6F\u4EF6\u5DE5\u7A0B\u8FC7\u7A0B\u5206\u6790\u52A9\u624B\u3002\u4E0B\u9762\u7ED9\u51FA\u4E00\u6B21 PR \u4E2D\u82E5\u5E72"\u5DE5\u4F5C\u7247\u6BB5"\u7684\u89C2\u6D4B\u4FE1\u606F\uFF0C\u8BF7\u4E3A\u6BCF\u4E2A\u7247\u6BB5\u5F52\u7EB3\u4E00\u53E5\u76EE\u6807\u63CF\u8FF0\u3002

\u8981\u6C42\uFF1A
1. desc\uFF1A\u4E0D\u8D85\u8FC7 30 \u4E2A\u4E2D\u6587\u5B57\u7B26\uFF0C\u52A8\u5BBE\u7ED3\u6784\uFF0C\u8BF4\u660E\u8FD9\u4E2A\u7247\u6BB5**\u60F3\u505A\u4EC0\u4E48**\uFF1B\u4E0D\u8981\u7F57\u5217\u6587\u4EF6\u540D\uFF0C\u4E0D\u8981\u590D\u8FF0\u547D\u4EE4\u539F\u6587\u3002
2. taskType\uFF1A\u4ECE feature / fix / test / docs / refactor / spec / review / unknown \u4E2D\u9009\u4E00\u4E2A\u3002
3. prompt \u5B57\u6BB5\u662F\u5F00\u53D1\u8005\u5F53\u65F6\u5BF9 AI \u8BF4\u7684\u8BDD\uFF0C\u662F\u5224\u65AD\u610F\u56FE\u7684\u7B2C\u4E00\u624B\u4F9D\u636E\uFF0C\u8BF7\u4F18\u5148\u4F9D\u636E\u5B83\uFF1BsystemLabel \u662F\u7CFB\u7EDF\u81EA\u52A8\u586B\u5145\u7684\u6A21\u677F\uFF0C\u8BED\u4E49\u4EE5\u5B83\u4E3A\u51C6\u3002
4. \u82E5\u4FE1\u606F\u4E0D\u8DB3\uFF0Cdesc \u4ECD\u7ED9\u51FA\u6700\u8D34\u5207\u7684\u8868\u8FF0\uFF0CtaskType \u7528 unknown\uFF1B**\u4E0D\u8981\u7559\u7A7A\u3001\u4E0D\u8981\u7F16\u9020\u672A\u51FA\u73B0\u7684\u5185\u5BB9**\u3002

\u4E25\u683C\u8F93\u51FA JSON\uFF0C\u4E0D\u8981\u4EFB\u4F55\u989D\u5916\u6587\u5B57\uFF1A
{"tasks":[{"id":"T1","desc":"...","taskType":"feature"}]}`;
  }
});

// ../../packages/analyzer/dist/task/files.js
function languageOf(uri) {
  const m = /\.([a-z0-9]+)$/i.exec(uri);
  if (!m)
    return null;
  return EXT_LANG[m[1].toLowerCase()] ?? null;
}
function artifactOf(uri) {
  const parts = String(uri).split(/[\\/]/);
  return parts[parts.length - 1] || uri;
}
function diffLineCount(diff) {
  if (!Array.isArray(diff))
    return 0;
  let n = 0;
  for (const h of diff) {
    const hunk = h;
    if (Array.isArray(hunk.lines)) {
      n += hunk.lines.length;
    } else if (typeof hunk.startLine === "number" && typeof hunk.endLine === "number") {
      n += Math.max(1, Math.abs(hunk.endLine - hunk.startLine) + 1);
    }
  }
  return n;
}
function aggregateFiles(bs) {
  const m = /* @__PURE__ */ new Map();
  for (const b of bs) {
    const uri = b.object?.kind === "file" ? b.object.uri : void 0;
    if (!uri)
      continue;
    let ref = m.get(uri);
    if (!ref) {
      ref = {
        uri,
        role: b.object?.role ?? "unknown",
        actions: [],
        touchedLines: 0
      };
      m.set(uri, ref);
    }
    if (!ref.actions.includes(b.action))
      ref.actions.push(b.action);
    const role = b.object?.role;
    if (ref.role === "unknown" && role && role !== "unknown")
      ref.role = role;
    const lr = b.object?.lineRange;
    if (lr && Array.isArray(lr) && lr.length === 2) {
      ref.touchedLines += Math.max(1, Math.abs(Number(lr[1]) - Number(lr[0])) + 1);
    } else if (b.action === "edit") {
      ref.touchedLines += diffLineCount(b.context?.diff);
    }
    if (b.action === "edit") {
      const n = diffLineCount(b.context?.diff) || 1;
      if (b.actor === "ai")
        ref.aiLines = (ref.aiLines ?? 0) + n;
      else
        ref.devLines = (ref.devLines ?? 0) + n;
    }
  }
  return [...m.values()];
}
function buildBehaviorSummary(bs) {
  if (bs.length === 0)
    return "\u65E0\u884C\u4E3A\u8BB0\u5F55";
  const editFiles = /* @__PURE__ */ new Set();
  const readFiles = /* @__PURE__ */ new Set();
  const cmds = [];
  let prompts = 0;
  let toolCalls = 0;
  for (const b of bs) {
    const uri = b.object?.kind === "file" ? b.object.uri : void 0;
    switch (b.action) {
      case "edit":
        if (uri)
          editFiles.add(uri);
        break;
      case "view":
      case "file.scroll":
      case "cursor":
      case "file.open":
        if (uri)
          readFiles.add(uri);
        break;
      case "terminal.exec": {
        const c = typeof b.context?.cmd === "string" ? b.context.cmd.trim() : "";
        if (c)
          cmds.push(c);
        break;
      }
      case "prompt.submit":
        prompts++;
        break;
      case "agent.tool":
        toolCalls++;
        break;
      default:
        break;
    }
  }
  const parts = [];
  if (editFiles.size > 0)
    parts.push(`\u7F16\u8F91 ${editFiles.size} \u6587\u4EF6`);
  if (cmds.length > 0) {
    const uniq = [...new Set(cmds)];
    parts.push(`\u6267\u884C ${uniq[0]}${cmds.length > 1 ? ` \u7B49 ${uniq.length} \u6761\u547D\u4EE4` : ""}`);
  }
  if (prompts > 0)
    parts.push(`\u63D0\u4EA4 ${prompts} \u6761 prompt`);
  if (toolCalls > 0)
    parts.push(`AI \u8C03\u7528 ${toolCalls} \u6B21\u5DE5\u5177`);
  if (readFiles.size > 0)
    parts.push(`\u9605\u8BFB ${readFiles.size} \u6587\u4EF6`);
  return parts.length > 0 ? parts.join(" \xB7 ") : `${bs.length} \u6761\u884C\u4E3A`;
}
function devActiveMs(bs, cappedGapMs = 3e5) {
  const dev = bs.filter((b) => b.actor === "dev").map((b) => b.ts);
  if (dev.length < 2)
    return 0;
  let total = 0;
  for (let i = 1; i < dev.length; i++) {
    total += Math.min(dev[i] - dev[i - 1], cappedGapMs);
  }
  return total;
}
function computeMetrics(bs, runs) {
  const devBehaviors = bs.filter((b) => b.actor === "dev").length;
  const aiBehaviors = bs.length - devBehaviors;
  const passed = runs.reduce((s, r) => s + (r.passed ?? 0), 0);
  const failed = runs.reduce((s, r) => s + (r.failed ?? 0), 0);
  const anyCounted = runs.some((r) => r.passed !== null || r.failed !== null);
  return {
    behaviorCount: bs.length,
    devBehaviors,
    aiBehaviors,
    aiRatio: bs.length > 0 ? Number((aiBehaviors / bs.length).toFixed(4)) : 0,
    devActiveMs: devActiveMs(bs),
    promptCount: bs.filter((b) => b.action === "prompt.submit").length,
    testRunCount: runs.length,
    testPassed: anyCounted ? passed : null,
    testFailed: anyCounted ? failed : null
  };
}
function inferTaskType(files, stage) {
  if (stage === "ai-review")
    return "review";
  if (stage === "ai-fix")
    return "fix";
  if (stage === "ai-testing" || stage === "test-planning")
    return "test";
  if (stage === "spec-engineering")
    return "spec";
  if (files.some((f) => /\.(md|markdown)$/i.test(f.uri)))
    return "docs";
  return "feature";
}
var EXT_LANG;
var init_files = __esm({
  "../../packages/analyzer/dist/task/files.js"() {
    "use strict";
    EXT_LANG = {
      ts: "TypeScript",
      tsx: "TypeScript",
      js: "JavaScript",
      jsx: "JavaScript",
      mjs: "JavaScript",
      py: "Python",
      rs: "Rust",
      go: "Go",
      java: "Java",
      kt: "Kotlin",
      cpp: "C++",
      c: "C",
      cs: "C#",
      css: "CSS",
      html: "HTML",
      vue: "Vue",
      md: "Markdown",
      json: "JSON",
      yaml: "YAML",
      yml: "YAML",
      toml: "TOML",
      sh: "Shell"
    };
  }
});

// ../../packages/analyzer/dist/task/spectrum.js
function computeTaskSpectrum(bs, opts = {}) {
  if (bs.length === 0)
    return [];
  const maxSegments = Math.max(1, Math.floor(opts.maxSegments ?? DEFAULT_MAX_SEGMENTS));
  const startTs = bs[0].ts;
  const endTs = bs[bs.length - 1].ts;
  const aiCount = bs.filter((b) => b.actor === "ai").length;
  const overallAi = bs.length > 0 ? round(aiCount / bs.length) : 0;
  if (bs.length < MIN_BEHAVIORS_FOR_DISTRIBUTION || endTs <= startTs) {
    return [{ t: 0.5, ai: overallAi }];
  }
  const segments = Math.min(maxSegments, bs.length);
  const span = endTs - startTs;
  const buckets = Array.from({ length: segments }, () => [0, 0]);
  for (const b of bs) {
    const ratio2 = (b.ts - startTs) / span;
    const idx = Math.min(segments - 1, Math.floor(ratio2 * segments));
    const bucket = buckets[idx];
    bucket[0] += 1;
    if (b.actor === "ai")
      bucket[1] += 1;
  }
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const bucket = buckets[Math.min(i, segments - 1)];
    const [total, ai] = bucket;
    const value = total > 0 ? round(ai / total) : overallAi;
    points.push({ t: round(i / segments), ai: value });
  }
  return points;
}
function overallAiRatio(bs) {
  if (bs.length === 0)
    return 0;
  return round(bs.filter((b) => b.actor === "ai").length / bs.length);
}
var DEFAULT_MAX_SEGMENTS, MIN_BEHAVIORS_FOR_DISTRIBUTION, round;
var init_spectrum = __esm({
  "../../packages/analyzer/dist/task/spectrum.js"() {
    "use strict";
    DEFAULT_MAX_SEGMENTS = 10;
    MIN_BEHAVIORS_FOR_DISTRIBUTION = 4;
    round = (n, digits = 4) => {
      const f = 10 ** digits;
      return Math.round(n * f) / f;
    };
  }
});

// ../../packages/analyzer/dist/task/build.js
function seqOf(b) {
  const m = /-(\d+)$/.exec(b.id);
  return m ? Number(m[1]) : 0;
}
function firstPromptText(bs) {
  for (const b of bs) {
    if (b.action === "prompt.submit") {
      const t = b.context?.promptText;
      if (typeof t === "string" && t.trim())
        return t;
    }
  }
  return null;
}
function firstAgentMessage(bs) {
  for (const b of bs) {
    if (b.action === "agent.message") {
      const t = b.context?.after;
      if (typeof t === "string" && t.trim())
        return t;
    }
  }
  return null;
}
async function buildTaskGraph(opts) {
  const cfg = mergeTaskConfig(opts.taskConfig);
  const behaviors = [...opts.behaviors].sort((a, b) => a.ts - b.ts);
  const prId = opts.prId;
  const llm = opts.llm ?? null;
  const { clusters, cutSignals } = segmentBehaviors(behaviors, cfg);
  const runs = detectTestRuns(behaviors, cfg);
  const reviewSessions = detectReviewSessions(behaviors, cfg);
  const reviewBehaviorIds = /* @__PURE__ */ new Set();
  for (const rs of reviewSessions)
    for (const id of rs.behaviorIds)
      reviewBehaviorIds.add(id);
  const ctx = makeClassifyContext(behaviors, runs, reviewBehaviorIds, cfg, opts.fixWindowMs ?? DEFAULT_FIX_WINDOW_MS);
  const draft = [];
  let prevEndTs = null;
  clusters.forEach((bs, i) => {
    if (bs.length === 0)
      return;
    const startTs = bs[0].ts;
    const endTs = bs[bs.length - 1].ts;
    const annotation = annotateStages(bs, ctx);
    const files = aggregateFiles(bs);
    const behaviorSummary = buildBehaviorSummary(bs);
    const ids = new Set(bs.map((b) => b.id));
    const clusterRuns = runs.filter((r) => ids.has(r.behaviorId));
    const counts = {};
    for (const b of bs)
      counts[b.action] = (counts[b.action] ?? 0) + 1;
    const sessionIds = [
      ...new Set(bs.map((b) => b.context?.sessionId).filter((s) => !!s))
    ];
    const promptIds = bs.filter((b) => b.action === "prompt.submit").map((b) => b.id);
    const task = {
      id: `${prId}-T${i + 1}`,
      prId,
      seq: i + 1,
      startTs,
      endTs,
      durationMs: Math.max(0, endTs - startTs),
      idleBeforeMs: prevEndTs === null ? null : Math.max(0, startTs - prevEndTs),
      bs: bs.map((b) => b.id),
      behaviorRange: [seqOf(bs[0]), seqOf(bs[bs.length - 1])],
      counts,
      desc: null,
      descSource: "rule",
      behaviorSummary,
      fp: {
        taskType: inferTaskType(files, annotation.stage),
        languages: [
          ...new Set(files.map((f) => f.uri).map(languageOfSafe).filter((x) => !!x))
        ],
        artifacts: [...new Set(files.map((f) => f.uri).map(artifactOfSafe))].slice(0, 10)
      },
      stage: annotation.stage,
      spans: annotation.spans,
      stageConfidence: annotation.stageConfidence,
      files,
      sessionIds,
      promptIds,
      testRunIds: clusterRuns.map((r) => r.id),
      metrics: computeMetrics(bs, clusterRuns),
      // 人机主导权的时间分布（后端预计算，前端直接用于渐变渲染）
      spectrum: computeTaskSpectrum(bs)
    };
    prevEndTs = endTs;
    const cleaned = cleanPrompt(firstPromptText(bs), cfg.descMaxInputChars);
    const descInput = {
      taskId: task.id,
      promptText: cleaned.text,
      systemTemplate: cleaned.systemTemplate,
      templateLabel: cleaned.templateLabel,
      agentMessage: firstAgentMessage(bs),
      behaviorSummary,
      files: files.map((f) => f.uri),
      stage: annotation.stage
    };
    draft.push({ task, descInput, runs: clusterRuns });
  });
  let llmCalls = 0;
  let llmFallbackCount = 0;
  const descSourceDist = {};
  const inputs = draft.map((d) => d.descInput);
  if (llm && inputs.length > 0) {
    const res = await generateDescs(inputs, llm, cfg);
    llmCalls = res.llmCalls;
    llmFallbackCount = res.fallbackCount;
    for (const d of draft) {
      const r = res.results.get(d.task.id);
      if (!r) {
        d.task.desc = null;
        d.task.descSource = "rule";
        continue;
      }
      d.task.desc = r.desc;
      d.task.descSource = r.source;
      if (r.taskType)
        d.task.fp.taskType = r.taskType;
    }
  } else {
    for (const d of draft) {
      const r = fallbackDesc(d.descInput, cfg);
      d.task.desc = r.desc;
      d.task.descSource = r.source;
      if (r.taskType)
        d.task.fp.taskType = r.taskType;
      llmFallbackCount++;
    }
  }
  for (const d of draft) {
    descSourceDist[d.task.descSource] = (descSourceDist[d.task.descSource] ?? 0) + 1;
  }
  const tasks = draft.map((d) => d.task);
  const totalDuration = tasks.reduce((s, t) => s + t.durationMs, 0);
  const segments = ALL_STAGES.map((stage) => {
    const members = tasks.filter((t) => t.stage === stage || t.spans.some((s) => s.stage === stage));
    const present = members.length > 0;
    const startTs = present ? Math.min(...members.map((t) => t.startTs)) : 0;
    const endTs = present ? Math.max(...members.map((t) => t.endTs)) : 0;
    const rangeStart = present ? Math.min(...members.map((t) => t.behaviorRange[0])) : 0;
    const rangeEnd = present ? Math.max(...members.map((t) => t.behaviorRange[1])) : 0;
    const dur = members.reduce((s, t) => s + t.durationMs, 0);
    return {
      stage,
      startTs,
      endTs,
      behaviorRange: [rangeStart, rangeEnd],
      taskIds: members.map((t) => t.id),
      present,
      weightSum: totalDuration > 0 ? Number((dur / totalDuration).toFixed(4)) : 0
    };
  });
  const assigned = /* @__PURE__ */ new Set();
  for (const t of tasks)
    for (const id of t.bs)
      assigned.add(id);
  const unassigned = behaviors.filter((b) => !assigned.has(b.id)).map((b) => b.id);
  const diagnostics = {
    cutSignals,
    avgTaskDurationMs: tasks.length > 0 ? Math.round(tasks.reduce((s, t) => s + t.durationMs, 0) / tasks.length) : 0,
    mixedStageTaskCount: tasks.filter((t) => t.spans.length > 1).length,
    llmFallbackCount,
    llmCalls,
    descSourceDist
  };
  return {
    v: TASK_GRAPH_VERSION,
    prId,
    generatedAt: opts.now ?? Date.now(),
    generator: {
      ruleset: "p2-pre-1",
      llmModel: opts.llmModel ?? (llm ? llm.id : null),
      llmCalls
    },
    stages: segments,
    tasks,
    reviewSessions,
    unassigned,
    diagnostics
  };
}
function languageOfSafe(uri) {
  const m = /\.([a-z0-9]+)$/i.exec(uri);
  if (!m)
    return null;
  const map = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    py: "Python",
    rs: "Rust",
    go: "Go",
    md: "Markdown",
    json: "JSON"
  };
  return map[m[1].toLowerCase()] ?? null;
}
function artifactOfSafe(uri) {
  const parts = String(uri).split(/[\\/]/);
  return parts[parts.length - 1] || uri;
}
var init_build = __esm({
  "../../packages/analyzer/dist/task/build.js"() {
    "use strict";
    init_config();
    init_segment();
    init_testrun();
    init_review();
    init_stage();
    init_files();
    init_spectrum();
    init_desc();
    init_types();
  }
});

// ../../packages/analyzer/dist/process/registry.js
function unavailableView(layer, message) {
  return {
    id: layer.id,
    summary: "\u8BE5\u5206\u6790\u4E0D\u53EF\u7528",
    data: null,
    warnings: [message]
  };
}
function createAnalyticRegistry(layers) {
  const byId = new Map(layers.map((l) => [l.id, l]));
  return {
    layers,
    runAll(graph, behaviors) {
      const out = [];
      for (const l of layers) {
        try {
          out.push(l.compute(graph, behaviors));
        } catch (e) {
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
      } catch (e) {
        return unavailableView(l, String(e?.message ?? e));
      }
    }
  };
}
var init_registry = __esm({
  "../../packages/analyzer/dist/process/registry.js"() {
    "use strict";
  }
});

// ../../packages/analyzer/dist/process/ai-involvement.js
function createAiInvolvementLayer() {
  return {
    id: "ai-involvement",
    name: { "zh-CN": "AI \u53C2\u4E0E\u5EA6\u5149\u8C31", "en-US": "AI Involvement" },
    renderAs: "overlay",
    compute(graph, _behaviors) {
      const points = graph.tasks.map((t) => ({
        taskId: t.id,
        seq: t.seq,
        startTs: t.startTs,
        endTs: t.endTs,
        aiRatio: t.metrics.aiRatio,
        stage: t.stage,
        desc: t.desc
      }));
      const totalBehaviors = graph.tasks.reduce((s, t) => s + t.metrics.behaviorCount, 0);
      const weighted = totalBehaviors > 0 ? graph.tasks.reduce((s, t) => s + t.metrics.aiRatio * t.metrics.behaviorCount, 0) / totalBehaviors : 0;
      const sorted = [...points].sort((a, b) => b.aiRatio - a.aiRatio);
      const summary = points.length === 0 ? "\u65E0 Task \u6570\u636E" : `AI \u5E73\u5747\u53C2\u4E0E ${(weighted * 100).toFixed(0)}%\uFF0C\u6700\u9AD8 ${((sorted[0]?.aiRatio ?? 0) * 100).toFixed(0)}%\uFF08${sorted[0]?.desc ?? sorted[0]?.taskId ?? "-"}\uFF09\uFF0C\u6700\u4F4E ${((sorted[sorted.length - 1]?.aiRatio ?? 0) * 100).toFixed(0)}%\uFF08${sorted[sorted.length - 1]?.desc ?? sorted[sorted.length - 1]?.taskId ?? "-"}\uFF09`;
      const warnings = [];
      const hasAccept = graph.tasks.some((t) => t.counts["accept"]);
      if (!hasAccept) {
        warnings.push("\u672C PR \u65E0 userAccept \u4E8B\u4EF6\uFF1AAI \u4E0E Dev \u7F16\u8F91\u7684\u8FB9\u754C\u7531\u5DE5\u5177\u8C03\u7528\u63A8\u65AD\uFF0C\u975E\u7CBE\u786E\u5207\u5206");
      }
      return {
        id: "ai-involvement",
        summary,
        data: {
          points,
          avgAiRatio: Number(weighted.toFixed(4)),
          peak: sorted[0] ?? null,
          trough: sorted[sorted.length - 1] ?? null
        },
        warnings: warnings.length > 0 ? warnings : void 0
      };
    }
  };
}
var init_ai_involvement = __esm({
  "../../packages/analyzer/dist/process/ai-involvement.js"() {
    "use strict";
  }
});

// ../../packages/analyzer/dist/process/collab-pattern.js
function createCollabPatternLayer() {
  return {
    id: "collab-pattern",
    name: { "zh-CN": "\u534F\u4F5C\u6A21\u5F0F\u753B\u50CF", "en-US": "Collaboration Pattern" },
    renderAs: "panel",
    compute(graph, _behaviors) {
      let total = 0;
      let ai = 0;
      let reads = 0;
      let prompts = 0;
      let toolCalls = 0;
      let devEditLines = 0;
      let aiEditLines = 0;
      for (const t of graph.tasks) {
        total += t.metrics.behaviorCount;
        ai += t.metrics.aiBehaviors;
        prompts += t.metrics.promptCount;
        for (const [action, n] of Object.entries(t.counts)) {
          if (action === "agent.tool")
            toolCalls += n;
          if (action === "view" || action === "file.scroll" || action === "cursor")
            reads += n;
        }
        for (const f of t.files) {
          devEditLines += f.devLines ?? 0;
          aiEditLines += f.aiLines ?? 0;
        }
      }
      const allEditLines = devEditLines + aiEditLines;
      const signals = {
        total,
        aiRatio: total > 0 ? Number((ai / total).toFixed(4)) : 0,
        devEditRatio: allEditLines > 0 ? Number((devEditLines / allEditLines).toFixed(4)) : 0,
        readRatio: total > 0 ? Number((reads / total).toFixed(4)) : 0,
        promptPerTask: graph.tasks.length > 0 ? Number((prompts / graph.tasks.length).toFixed(2)) : 0,
        toolCalls
      };
      let pattern = "unknown";
      if (total > 0) {
        if (signals.devEditRatio > THRESHOLD.devEditDominant)
          pattern = "manual";
        else if (signals.readRatio >= THRESHOLD.readFocused && signals.aiRatio > 0.5)
          pattern = "review";
        else if (signals.promptPerTask >= THRESHOLD.promptPerTask)
          pattern = "pair";
        else
          pattern = "cruise";
      }
      return {
        id: "collab-pattern",
        summary: `${PATTERN_LABELS[pattern]["zh-CN"]}\uFF1A${PATTERN_DESC[pattern]["zh-CN"]}`,
        data: {
          pattern,
          label: PATTERN_LABELS[pattern],
          description: PATTERN_DESC[pattern],
          signals
        }
      };
    }
  };
}
var PATTERN_LABELS, PATTERN_DESC, THRESHOLD;
var init_collab_pattern = __esm({
  "../../packages/analyzer/dist/process/collab-pattern.js"() {
    "use strict";
    PATTERN_LABELS = {
      cruise: { "zh-CN": "\u5DE1\u822A\u5F0F", "en-US": "Cruise" },
      pair: { "zh-CN": "\u7ED3\u5BF9\u5F0F", "en-US": "Pair" },
      review: { "zh-CN": "\u5BA1\u9605\u5F0F", "en-US": "Review" },
      manual: { "zh-CN": "\u624B\u5DE5\u5F0F", "en-US": "Manual" },
      unknown: { "zh-CN": "\u672A\u8BC6\u522B", "en-US": "Unknown" }
    };
    PATTERN_DESC = {
      cruise: {
        "zh-CN": "\u4F60\u628A\u5927\u90E8\u5206\u5B9E\u73B0\u4EA4\u7ED9 AI\uFF0C\u81EA\u5DF1\u4E3B\u8981\u5728\u5173\u952E\u8282\u70B9\u9A8C\u6536\u4E0E\u7EA0\u504F",
        "en-US": "You delegate most implementation to AI and step in at key checkpoints"
      },
      pair: {
        "zh-CN": "\u4F60\u4E0E AI \u9AD8\u9891\u4EA4\u66FF\uFF0C\u8FB9\u8BF4\u8FB9\u6539\uFF0C\u50CF\u7ED3\u5BF9\u7F16\u7A0B",
        "en-US": "You and AI alternate frequently, like pair programming"
      },
      review: {
        "zh-CN": "AI \u5927\u91CF\u4EA7\u51FA\u7684\u540C\u65F6\uFF0C\u4F60\u82B1\u4E86\u53EF\u89C2\u7CBE\u529B\u5BA1\u9605\u5B83\u7684\u4EA7\u51FA",
        "en-US": "AI produces heavily while you spend real effort reviewing"
      },
      manual: {
        "zh-CN": "\u4E3B\u8981\u4EE3\u7801\u7531\u4F60\u4EB2\u624B\u7F16\u5199\uFF0CAI \u5904\u4E8E\u8F85\u52A9\u4F4D\u7F6E",
        "en-US": "You write most code yourself; AI plays a supporting role"
      },
      unknown: { "zh-CN": "\u884C\u4E3A\u6570\u636E\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u5224\u5B9A\u534F\u4F5C\u6A21\u5F0F", "en-US": "Insufficient data" }
    };
    THRESHOLD = {
      /** Dev 编辑占全部编辑的比例超过此值 → 手工式 */
      devEditDominant: 0.5,
      /** 阅读类行为占比超过此值 → 审阅式 */
      readFocused: 0.18,
      /**
       * 平均每 Task 的 prompt 数超过此值 → 结对式。
       *
       * **必须 > 1**：本设计中 S1（Dev prompt）就是主切分信号，因此"每个 Task 有 1 条
       * prompt"是常态而非"结对"。初版阈值 0.6 把 P1 样例（典型巡航式）误判为结对式。
       * 只有**同一 Task 内出现多条 prompt**（人反复插话、高频交替）才构成结对特征。
       */
      promptPerTask: 1.5
    };
  }
});

// ../../packages/analyzer/dist/process/index.js
function defaultAnalyticLayers() {
  return [createAiInvolvementLayer(), createCollabPatternLayer()];
}
function createDefaultAnalyticRegistry() {
  return createAnalyticRegistry(defaultAnalyticLayers());
}
var init_process = __esm({
  "../../packages/analyzer/dist/process/index.js"() {
    "use strict";
    init_registry();
    init_ai_involvement();
    init_collab_pattern();
    init_registry();
    init_ai_involvement();
    init_collab_pattern();
  }
});

// ../../packages/analyzer/dist/credit/types.js
var init_types2 = __esm({
  "../../packages/analyzer/dist/credit/types.js"() {
    "use strict";
  }
});

// ../../packages/analyzer/dist/credit/config.js
function mergeCreditConfig(over) {
  if (!over)
    return { ...DEFAULT_CREDIT_CONFIG };
  return {
    ...DEFAULT_CREDIT_CONFIG,
    ...over,
    aggregation: { ...DEFAULT_CREDIT_CONFIG.aggregation, ...over.aggregation },
    reading: { ...DEFAULT_CREDIT_CONFIG.reading, ...over.reading },
    review: { ...DEFAULT_CREDIT_CONFIG.review, ...over.review },
    spec: { ...DEFAULT_CREDIT_CONFIG.spec, ...over.spec },
    diff: { ...DEFAULT_CREDIT_CONFIG.diff, ...over.diff },
    test: { ...DEFAULT_CREDIT_CONFIG.test, ...over.test },
    manualTest: { ...DEFAULT_CREDIT_CONFIG.manualTest, ...over.manualTest },
    ordinal: { ...DEFAULT_CREDIT_CONFIG.ordinal, ...over.ordinal },
    planReview: { ...DEFAULT_CREDIT_CONFIG.planReview, ...over.planReview },
    stagedPlan: { ...DEFAULT_CREDIT_CONFIG.stagedPlan, ...over.stagedPlan },
    decisionAttribution: {
      ...DEFAULT_CREDIT_CONFIG.decisionAttribution,
      ...over.decisionAttribution
    },
    profile: { ...DEFAULT_CREDIT_CONFIG.profile, ...over.profile },
    degraded: { ...DEFAULT_CREDIT_CONFIG.degraded, ...over.degraded }
  };
}
var DEFAULT_CREDIT_CONFIG;
var init_config2 = __esm({
  "../../packages/analyzer/dist/credit/config.js"() {
    "use strict";
    DEFAULT_CREDIT_CONFIG = {
      aggregation: { procWeight: 0.8, devWeight: 0.2, defaultStrategy: "equal" },
      reading: { readDwellMs: 500, scrollSampleMs: 200 },
      review: { coverageRatio: 0.3, dwellMs: 1e4, testCoverageRatio: 0.1, testDwellMs: 5e3 },
      spec: {
        filePatterns: ["**/SPEC*.md", "**/*spec*.md", "**/*\u9700\u6C42*.md", "**/*\u89C4\u683C*.md", "**/spec/**"],
        excludePatterns: ["node_modules/**", "dist/**"],
        minContentChars: 200
      },
      diff: {
        largeChangeThreshold: 100,
        acceptMaxLines: 800,
        coreFileExcludePatterns: [
          "**/*.lock",
          "**/*.min.*",
          "**/dist/**",
          "**/build/**",
          "**/*.generated.*",
          "**/*.snap",
          "**/assets/**"
        ]
      },
      test: { cmdPatterns: [], failureReviewWindowMs: 9e5, fixPhaseWindowMs: 18e5 },
      planReview: { dwellMs: 1e4 },
      stagedPlan: {
        todoTools: [
          "TodoWrite",
          "todo_write",
          "todo_update",
          "update_todo",
          "write_todos",
          "create_todo",
          "todo",
          "plan"
        ],
        minSteps: 2,
        minSnapshots: 2,
        minCompleted: 2
      },
      manualTest: { tailWindowRatio: 0.25, minPrompts: 10 },
      decisionAttribution: { minDecisions: 3 },
      profile: {
        // log：score = 100 × log10(1+L) / log10(1+500000) —— 1k≈53、10k≈70、10万≈88、50万=100
        proficiency: { scale: "log", fullMarkLines: 5e5 },
        collabTiers: [1e3, 1e4, 5e4],
        recentN: 10
      },
      ordinal: { threeTier: [0, 50, 100], reviewRounds: [0, 60, 80, 100], collabLinesTier: [10, 40, 70, 100] },
      degraded: { conservativeScore: 50 }
    };
  }
});

// ../../packages/analyzer/dist/shared/uri.js
function canonicalUri(uri) {
  let u = String(uri ?? "").trim();
  if (u.startsWith("inmemory://")) {
    const seg = u.slice("inmemory://".length).split("/");
    u = seg.slice(2).join("/");
  } else if (u.startsWith("file://")) {
    u = u.slice("file://".length).replace(/^\//, "");
  }
  try {
    u = decodeURIComponent(u);
  } catch {
  }
  u = u.replace(/^\/([a-zA-Z]:)/, "$1");
  return u.replace(/\\/g, "/");
}
function normUri(uri) {
  return canonicalUri(uri).toLowerCase();
}
function isAbsolutePath(uri) {
  const c = canonicalUri(uri);
  return /^[a-zA-Z]:\//.test(c) || c.startsWith("/");
}
function resolveGitUri(gitUri, knownUris) {
  const g = normUri(gitUri);
  if (!g)
    return gitUri;
  const cands = knownUris.filter((u) => normUri(u) === g || normUri(u).endsWith(`/${g}`));
  if (cands.length === 0)
    return gitUri;
  const abs = cands.find((u) => isAbsolutePath(u));
  return canonicalUri(abs ?? cands[0]);
}
function buildUriAlias(uris) {
  const canon = uris.map((raw) => ({ raw, c: canonicalUri(raw) }));
  const abs = canon.filter((x) => isAbsolutePath(x.c));
  const alias = /* @__PURE__ */ new Map();
  for (const x of canon) {
    if (isAbsolutePath(x.c)) {
      alias.set(x.raw, x.c);
      continue;
    }
    const host = abs.find((a) => normUri(a.c).endsWith(`/${normUri(x.c)}`));
    alias.set(x.raw, host ? host.c : x.c);
  }
  return alias;
}
function collectFileUris(behaviors) {
  const set = /* @__PURE__ */ new Set();
  for (const b of behaviors) {
    if (b.object?.kind === "file" && b.object.uri)
      set.add(canonicalUri(b.object.uri));
  }
  return [...set];
}
var init_uri = __esm({
  "../../packages/analyzer/dist/shared/uri.js"() {
    "use strict";
  }
});

// ../../packages/analyzer/dist/shared/reading.js
function lineRangeOf(b) {
  const lr = b.object?.lineRange;
  if (!Array.isArray(lr) || lr.length !== 2)
    return null;
  const a = Number(lr[0]);
  const c = Number(lr[1]);
  if (!Number.isFinite(a) || !Number.isFinite(c))
    return null;
  return a <= c ? [a, c] : [c, a];
}
function buildReadingTrace(behaviors, cfg) {
  const byUri = {};
  const readSets = /* @__PURE__ */ new Map();
  const cursorSets = /* @__PURE__ */ new Map();
  let scrollCount = 0;
  const rawUris = behaviors.filter((b) => b.object?.kind === "file" && b.object?.uri).map((b) => b.object.uri);
  const alias = buildUriAlias(rawUris);
  for (const b of behaviors) {
    if (b.object?.kind !== "file")
      continue;
    const raw = b.object.uri ?? "";
    if (!raw)
      continue;
    if (b.action === "file.scroll")
      scrollCount++;
    const key = normUri(raw);
    const display = alias.get(raw) ?? canonicalUri(raw);
    let trace = byUri[key];
    if (!trace) {
      trace = { uri: display, dwellMs: 0, readLines: [], cursorLines: [] };
      byUri[key] = trace;
      readSets.set(key, /* @__PURE__ */ new Set());
      cursorSets.set(key, /* @__PURE__ */ new Set());
    }
    const dwell = Number(b.context?.dwellMs ?? 0) || 0;
    const range = lineRangeOf(b);
    if (READ_ACTIONS.has(b.action)) {
      trace.dwellMs += dwell;
      if (range) {
        const set = readSets.get(key);
        for (let i = range[0]; i <= range[1]; i++)
          set.add(i);
      }
    } else if (b.action === "cursor") {
      trace.dwellMs += dwell;
      if (range && dwell >= cfg.readDwellMs) {
        const set = cursorSets.get(key);
        for (let i = range[0]; i <= range[1]; i++)
          set.add(i);
      }
    }
  }
  for (const key of Object.keys(byUri)) {
    byUri[key].readLines = [...readSets.get(key) ?? []].sort((a, b) => a - b);
    byUri[key].cursorLines = [...cursorSets.get(key) ?? []].sort((a, b) => a - b);
  }
  return { byUri, scrollAvailable: scrollCount > 0 };
}
function traceOf(idx, uri) {
  const n = normUri(uri);
  const direct = idx.byUri[n];
  if (direct)
    return direct;
  for (const k of Object.keys(idx.byUri)) {
    if (k === n || k.endsWith(`/${n}`))
      return idx.byUri[k];
  }
  return { uri, dwellMs: 0, readLines: [], cursorLines: [] };
}
var READ_ACTIONS;
var init_reading = __esm({
  "../../packages/analyzer/dist/shared/reading.js"() {
    "use strict";
    init_uri();
    READ_ACTIONS = /* @__PURE__ */ new Set(["view", "file.scroll", "file.open"]);
  }
});

// ../../packages/analyzer/dist/shared/diff-parser.js
function isMeaningfulLine(text) {
  if (!text.trim())
    return false;
  return !PURE_SYMBOL.test(text);
}
function parseUnifiedDiff(patch) {
  const files = [];
  let cur = null;
  let newLineNo = 0;
  for (const raw of String(patch ?? "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("diff --git ")) {
      cur = null;
      continue;
    }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      if (p === "/dev/null") {
        cur = null;
        continue;
      }
      const uri = p.replace(/^b\//, "");
      cur = { uri, addedLines: [], addedTexts: [], totalAdded: 0, totalDeleted: 0 };
      files.push(cur);
      continue;
    }
    if (line.startsWith("@@")) {
      const m = /@@\s*-\d+(?:,\d+)?\s*\+(\d+)(?:,(\d+))?\s*@@/.exec(line);
      newLineNo = m ? Number(m[1]) : 0;
      continue;
    }
    if (!cur)
      continue;
    if (line.startsWith("+")) {
      const text = line.slice(1);
      cur.addedLines.push(newLineNo);
      cur.addedTexts.push(text);
      cur.totalAdded++;
      newLineNo++;
    } else if (line.startsWith("-")) {
      cur.totalDeleted++;
    } else if (line.startsWith(" ") || line === "") {
      newLineNo++;
    }
  }
  return files;
}
var PURE_SYMBOL;
var init_diff_parser = __esm({
  "../../packages/analyzer/dist/shared/diff-parser.js"() {
    "use strict";
    PURE_SYMBOL = /^[\s{}()[\];,/*+=<>|&!?.:'"`@#$%^*~\\-]*$/;
  }
});

// ../../packages/analyzer/dist/shared/core-diff.js
function matchGlob(uri, pattern) {
  const norm = uri.replace(/\\/g, "/");
  const esc = pattern.replace(/\\/g, "/").replace(/[.+^${}()|[\]]/g, "\\$&").replace(/\*\*\//g, "\0").replace(/\*\*/g, "").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?").replace(/\u0001/g, ".*");
  return new RegExp(`^${esc}$`).test(norm);
}
function isExcludedFile(uri, patterns) {
  return patterns.some((p) => matchGlob(uri, p));
}
function lineRangeOf2(b) {
  const lr = b.object?.lineRange;
  if (Array.isArray(lr) && lr.length === 2) {
    const a = Number(lr[0]);
    const c = Number(lr[1]);
    if (Number.isFinite(a) && Number.isFinite(c))
      return a <= c ? [a, c] : [c, a];
  }
  const diff = b.context?.diff;
  if (Array.isArray(diff)) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const h of diff) {
      const hunk = h;
      const s = Number(hunk.startLine);
      const e = Number(hunk.endLine);
      if (Number.isFinite(s) && Number.isFinite(e)) {
        lo = Math.min(lo, s);
        hi = Math.max(hi, e);
      }
    }
    if (lo <= hi)
      return [lo, hi];
  }
  return null;
}
function buildCoreDiff(git2, behaviors, cfg) {
  const out = {
    files: {},
    totalCoreNew: 0,
    totalCoreAll: 0,
    aiLines: {},
    devEditedLines: {}
  };
  if (!git2.available || !git2.files)
    return out;
  const knownUris = collectFileUris(behaviors);
  for (const raw of git2.files) {
    const f = { ...raw, uri: resolveGitUri(raw.uri, knownUris) };
    if (isExcludedFile(f.uri, cfg.coreFileExcludePatterns))
      continue;
    const lines = f.addedLines ?? [];
    const texts = f.addedTexts ?? [];
    const core = [];
    for (let i = 0; i < lines.length; i++) {
      const text = texts[i] ?? "";
      if (texts.length > 0 && !isMeaningfulLine(text))
        continue;
      core.push(lines[i]);
    }
    out.files[f.uri] = { coreNewLines: core, totalAdded: f.added, totalDeleted: f.deleted };
    out.totalCoreNew += core.length;
    out.totalCoreAll += f.added + f.deleted;
  }
  const ai = /* @__PURE__ */ new Map();
  const dev = /* @__PURE__ */ new Map();
  const coreOf = (uri) => {
    const direct = out.files[uri];
    if (direct)
      return new Set(direct.coreNewLines);
    let hit;
    for (const k of Object.keys(out.files)) {
      if (normUri(k) === normUri(uri)) {
        hit = k;
        break;
      }
    }
    return new Set(hit ? out.files[hit].coreNewLines : []);
  };
  for (const b of behaviors) {
    if (b.object?.kind !== "file")
      continue;
    const uri = b.object.uri;
    if (!uri)
      continue;
    const core = coreOf(uri);
    if (core.size === 0)
      continue;
    const range = lineRangeOf2(b);
    if (!range)
      continue;
    const hit = [];
    for (let i = range[0]; i <= range[1]; i++)
      if (core.has(i))
        hit.push(i);
    if (hit.length === 0)
      continue;
    const isAi = b.actor === "ai";
    const isAccept = b.action === "accept";
    if (isAi || isAccept) {
      const s = ai.get(uri) ?? /* @__PURE__ */ new Set();
      for (const l of hit)
        s.add(l);
      ai.set(uri, s);
    }
    if (b.action === "edit" && !isAi) {
      const s = dev.get(uri) ?? /* @__PURE__ */ new Set();
      for (const l of hit)
        s.add(l);
      dev.set(uri, s);
    }
  }
  for (const [uri, devSet] of dev) {
    const aiSet = ai.get(uri);
    if (aiSet)
      for (const l of devSet)
        aiSet.delete(l);
  }
  for (const [uri, s] of ai)
    out.aiLines[uri] = [...s].sort((a, b) => a - b);
  for (const [uri, s] of dev)
    out.devEditedLines[uri] = [...s].sort((a, b) => a - b);
  return out;
}
var init_core_diff = __esm({
  "../../packages/analyzer/dist/shared/core-diff.js"() {
    "use strict";
    init_diff_parser();
    init_uri();
  }
});

// ../../packages/analyzer/dist/shared/spec-docs.js
function isSpecUri(uri, cfg) {
  if (!uri)
    return false;
  if (/(^|[\\/])readme/i.test(uri))
    return false;
  if (cfg.excludePatterns.some((p) => matchGlob(uri, p)))
    return false;
  return cfg.filePatterns.some((p) => matchGlob(uri, p));
}
function isTestUri(uri) {
  if (!uri)
    return false;
  const lower = uri.replace(/\\/g, "/").toLowerCase();
  return /(^|\/)(tests?|spec|__tests__)\//.test(lower) || /\.(test|spec)\.[a-z]+$/.test(lower) || /_test\.[a-z]+$/.test(lower) || /(^|\/)test_[^/]*\.[a-z]+$/.test(lower);
}
function splitSpecItems(content) {
  const text = String(content ?? "");
  if (!text.trim())
    return [];
  const lines = text.split(/\r?\n/);
  const marks = [];
  lines.forEach((l, i) => {
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h && h[2].trim()) {
      marks.push({ idx: i, text: h[2].trim() });
      return;
    }
    const n = /^\s*(?:\d+[.、)]|[-*+]\s*\[(?:REQ|x| )\])\s+(.*)$/.exec(l);
    if (n && n[1].trim())
      marks.push({ idx: i, text: n[1].trim() });
  });
  if (marks.length < 2)
    return [{ id: "R1", text: text.trim() }];
  return marks.map((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].idx : lines.length;
    return { id: `R${i + 1}`, text: lines.slice(m.idx, end).join("\n").trim() };
  });
}
function stripCodeBlocks(md) {
  let t = String(md ?? "");
  t = t.replace(/```[\s\S]*?```/g, "\n[\u4EE3\u7801\u5757\u5DF2\u7701\u7565]\n");
  t = t.replace(/~~~[\s\S]*?~~~/g, "\n[\u4EE3\u7801\u5757\u5DF2\u7701\u7565]\n");
  t = t.replace(/`[^`\n]{1,120}`/g, "`\u2026`");
  return t;
}
function collectSpecUris(behaviors, gitFiles, cfg) {
  const set = /* @__PURE__ */ new Set();
  for (const b of behaviors) {
    if (b.object?.kind === "file" && b.object.uri && isSpecUri(b.object.uri, cfg)) {
      set.add(b.object.uri);
    }
  }
  for (const u of gitFiles)
    if (isSpecUri(u, cfg))
      set.add(u);
  return [...set];
}
async function loadSpecDocs(uris, fs, cfg) {
  const out = [];
  for (const uri of uris) {
    const content = fs ? await fs.readFile(uri) : null;
    if (content == null)
      continue;
    if (content.trim().length < cfg.minContentChars)
      continue;
    out.push({ uri, content, items: splitSpecItems(content) });
  }
  return out;
}
var init_spec_docs = __esm({
  "../../packages/analyzer/dist/shared/spec-docs.js"() {
    "use strict";
    init_core_diff();
  }
});

// ../../packages/analyzer/dist/shared/llm-json.js
async function llmJson(llm, spec) {
  if (!llm)
    return { ok: false, unavailable: true, data: null, rationale: "LLM \u901A\u9053\u672A\u6CE8\u5165" };
  const available = await llm.isAvailable().catch(() => false);
  if (!available) {
    return { ok: false, unavailable: true, data: null, rationale: "LLM \u4E0D\u53EF\u7528\uFF08\u65E0\u5BC6\u94A5\u6216\u901A\u9053\u672A\u5C31\u7EEA\uFF09" };
  }
  const rawUser = String(spec.user ?? "");
  const truncated = rawUser.length > MAX_INPUT_CHARS;
  const user = truncated ? rawUser.slice(0, MAX_INPUT_CHARS) : rawUser;
  if (truncated) {
    console.warn(`[credit] LLM \u8F93\u5165\u8D85\u4E0A\u9650\u88AB\u622A\u65AD\uFF1A${spec.metricId}/${spec.templateId} ${rawUser.length} \u2192 ${MAX_INPUT_CHARS} \u5B57\u7B26`);
  }
  let r;
  try {
    r = await llm.complete({
      metricId: spec.metricId,
      templateId: spec.templateId,
      system: spec.system,
      user,
      input: user,
      schema: spec.schema ?? EMPTY_SCHEMA,
      model: spec.model
    });
  } catch (e) {
    return {
      ok: false,
      unavailable: false,
      data: null,
      rationale: `LLM \u8C03\u7528\u5F02\u5E38\uFF1A${String(e?.message ?? e)}`
    };
  }
  if (!r.ok) {
    return {
      ok: false,
      // 只有"通道不可用"算 unavailable；超时/非法JSON/其他异常都是真失败
      unavailable: r.reason === "unavailable",
      data: null,
      rationale: `LLM \u5931\u8D25\uFF08${r.reason}\uFF09\uFF1A${r.message}`
    };
  }
  return {
    ok: true,
    unavailable: false,
    data: r.json,
    rationale: r.cached ? "LLM \u5224\u5B9A\uFF08\u547D\u4E2D\u7F13\u5B58\uFF09" : "LLM \u5224\u5B9A"
  };
}
function asArray(v) {
  return Array.isArray(v) ? v : [];
}
function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp01to100(v) {
  if (!Number.isFinite(v))
    return 0;
  return Math.max(0, Math.min(100, v));
}
var EMPTY_SCHEMA, MAX_INPUT_CHARS;
var init_llm_json = __esm({
  "../../packages/analyzer/dist/shared/llm-json.js"() {
    "use strict";
    EMPTY_SCHEMA = { type: "object" };
    MAX_INPUT_CHARS = 12e3;
  }
});

// ../../packages/analyzer/dist/shared/rtm.js
function extractTestCases(content, uri) {
  const out = [];
  const lines = String(content ?? "").split(/\r?\n/);
  let n = 0;
  const push = (name) => {
    n += 1;
    out.push({ id: `${uri}#${n}`, name: name.slice(0, 120), uri });
  };
  let prevIsTestAttr = false;
  let inTestModule = false;
  for (const raw of lines) {
    const l = raw.trim();
    if (/^#\[cfg\(test\)\]/.test(l)) {
      inTestModule = true;
      continue;
    }
    if (/^#\[test\]/.test(l) || /^#\[tokio::test\]/.test(l)) {
      prevIsTestAttr = true;
      continue;
    }
    let m = /^(?:test|it)\s*\(\s*['"`](.{1,120}?)['"`]/.exec(l);
    if (m) {
      push(m[1]);
      prevIsTestAttr = false;
      continue;
    }
    m = /^def\s+(test_\w+)/.exec(l);
    if (m) {
      push(m[1]);
      prevIsTestAttr = false;
      continue;
    }
    m = /^func\s+(Test\w+)/.exec(l);
    if (m) {
      push(m[1]);
      prevIsTestAttr = false;
      continue;
    }
    m = /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\(/.exec(l);
    if (m) {
      if (prevIsTestAttr || inTestModule && /test/i.test(m[1]))
        push(m[1]);
      prevIsTestAttr = false;
      continue;
    }
    if (l !== "")
      prevIsTestAttr = false;
  }
  return out;
}
function pickArray(data, keys) {
  if (!data || typeof data !== "object")
    return [];
  const rec = data;
  for (const k of keys) {
    const v = rec[k];
    if (Array.isArray(v))
      return v;
  }
  return [];
}
async function buildRtm(args) {
  const specItems = args.specs.flatMap((s) => s.items.map((it) => ({ id: `${s.uri}::${it.id}`, text: it.text.slice(0, 300) })));
  const testCases = [];
  for (const uri of args.testUris) {
    const content = args.fs ? await args.fs.readFile(uri) : null;
    if (content == null)
      continue;
    testCases.push(...extractTestCases(content, uri));
  }
  const matrix = {
    specItems,
    testCases,
    specToTest: {},
    specToTask: {},
    diffToTest: {},
    specCoverage: 0,
    llmOk: false
  };
  for (const f of args.gitFiles) {
    const dir = f.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    const base = (f.replace(/\\/g, "/").split("/").pop() ?? "").replace(/\.[^.]+$/, "");
    const hits = testCases.filter((t) => {
      const td = t.uri.replace(/\\/g, "/");
      const tdir = td.split("/").slice(0, -1).join("/");
      return tdir === dir || td.toLowerCase().includes(base.toLowerCase());
    }).map((t) => t.id);
    if (hits.length)
      matrix.diffToTest[f] = hits;
  }
  if (specItems.length === 0 || testCases.length === 0) {
    return {
      ...matrix,
      error: `\u8DF3\u8FC7 LLM \u5339\u914D\uFF1ASPEC \u6761\u76EE ${specItems.length} \u4E2A\u3001\u6D4B\u8BD5\u7528\u4F8B ${testCases.length} \u4E2A`
    };
  }
  const user = JSON.stringify({
    specItems: specItems.slice(0, 25).map((s) => ({ id: s.id, text: s.text.slice(0, 300) })),
    testCases: testCases.slice(0, 60).map((t) => ({ id: t.id, name: t.name, uri: t.uri })),
    taskIds: args.taskIds.slice(0, 20)
  });
  const r = await llmJson(args.llm, {
    metricId: "rtm",
    templateId: "rtm-v1",
    system: RTM_SYSTEM,
    user,
    // 不强校验字段名：模型可能改名，改由 pickArray 容忍；
    // 强校验只会把"字段名不同"误报成"LLM 不可用"，排查成本极高
    schema: { type: "object" }
  });
  if (!r.ok || !r.data) {
    return { ...matrix, error: r.rationale };
  }
  matrix.llmOk = true;
  const mappings = pickArray(r.data, ["mappings", "results", "items", "matches"]);
  const taskMap = pickArray(r.data, ["taskMap", "taskToSpec", "taskMappings", "tasks"]);
  for (const m of asArray(mappings)) {
    const reqId = String(m?.reqId ?? "");
    if (!reqId)
      continue;
    const conf = Number(m?.confidence ?? 0);
    if (conf >= 0.6)
      matrix.specToTest[reqId] = (m?.testIds ?? []).map(String);
  }
  for (const t of asArray(taskMap)) {
    const reqId = String(t?.reqId ?? "");
    if (reqId)
      matrix.specToTask[reqId] = (t?.taskIds ?? []).map(String);
  }
  const covered = Object.values(matrix.specToTest).filter((v) => v.length > 0).length;
  matrix.specCoverage = specItems.length > 0 ? covered / specItems.length : 0;
  return matrix;
}
var RTM_SYSTEM;
var init_rtm = __esm({
  "../../packages/analyzer/dist/shared/rtm.js"() {
    "use strict";
    init_llm_json();
    RTM_SYSTEM = `\u4F60\u662F\u9700\u6C42-\u6D4B\u8BD5\u8FFD\u6EAF\u5206\u6790\u52A9\u624B\u3002\u4E0B\u9762\u7ED9\u51FA SPEC \u6761\u76EE\u4E0E\u6D4B\u8BD5\u7528\u4F8B\u6E05\u5355\uFF0C\u8BF7\u5224\u65AD\u6BCF\u4E2A SPEC \u6761\u76EE\u7531\u54EA\u4E9B\u6D4B\u8BD5\u7528\u4F8B\u8986\u76D6\u3002

\u8981\u6C42\uFF1A
1. \u4F9D\u636E\u7528\u4F8B\u540D\u79F0\u4E0E\u6761\u76EE\u8BED\u4E49\u5339\u914D\uFF0C\u4E0D\u8981\u81C6\u9020\u4E0D\u5B58\u5728\u7684\u7528\u4F8B\uFF1B
2. confidence \u4E3A 0\u20131 \u7684\u7F6E\u4FE1\u5EA6\uFF0C\u65E0\u6CD5\u5224\u65AD\u65F6\u7ED9\u4F4E\u503C\uFF1B
3. \u53EA\u8F93\u51FA json\uFF0C**\u5B57\u6BB5\u540D\u5FC5\u987B\u4E25\u683C\u5982\u4E0B**\uFF0C\u4E0D\u8981\u6539\u540D\u3001\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u5176\u4ED6\u6587\u5B57\uFF1A

{"mappings":[{"reqId":"R1","testIds":["x.rs#1"],"confidence":0.9}],"taskMap":[{"reqId":"R1","taskIds":["T1"]}]}`;
  }
});

// ../../packages/analyzer/dist/shared/spec-quality.js
function parseVerifiability(data) {
  const rec = data ?? {};
  const v = rec.verifiability;
  if (v && typeof v === "object") {
    const o = v;
    const ids2 = Array.isArray(o.verifiableIds) ? o.verifiableIds.map(String) : [];
    return { verifiableIds: ids2, itemCount: Number(o.itemCount ?? ids2.length) || ids2.length };
  }
  if (Array.isArray(rec.verifiableIds)) {
    const ids2 = rec.verifiableIds.map(String);
    return { verifiableIds: ids2, itemCount: Number(rec.itemCount ?? ids2.length) || ids2.length };
  }
  const items = pickArray2(data, ["items", "verifiability", "clauses"]);
  const ids = items.filter((i) => i.hasAcceptance && i.isQuantified && i.hasTestMapping).map((i) => String(i.id ?? ""));
  return { verifiableIds: ids, itemCount: items.length || ids.length };
}
function pickArray2(data, keys) {
  if (!data || typeof data !== "object")
    return [];
  const rec = data;
  for (const k of keys) {
    if (Array.isArray(rec[k]))
      return rec[k];
  }
  return [];
}
async function buildSpecQuality(args) {
  const empty = {
    ok: false,
    dims: [],
    conflicts: [],
    verifiability: { verifiableIds: [], itemCount: 0 }
  };
  const content = args.specs.map((s) => s.content).join("\n\n");
  if (!content.trim())
    return { ...empty, error: "SPEC \u5185\u5BB9\u4E3A\u7A7A" };
  const specText = stripCodeBlocks(content).slice(0, 8e3);
  const r = await llmJson(args.llm, {
    metricId: "spec-quality",
    // **v2**：输出结构变了（逐条判定 → 只回全满足 id 列表），必须升版使旧缓存失效
    templateId: "spec-quality-v2",
    system: SYS,
    user: `\u4E0B\u9762\u662F SPEC \u6587\u6863\u5168\u6587\uFF0C\u8BF7\u5B8C\u6210\u5B8C\u6574\u6027 / \u4E00\u81F4\u6027 / \u53EF\u9A8C\u8BC1\u6027\u4E09\u9879\u8BC4\u5BA1\u3002
\u6761\u76EE\u6807\u8BC6\u4E3A ${args.itemIds.slice(0, 40).join(", ") || "R1, R2, \u2026"}\u3002

=== SPEC \u5F00\u59CB ===
${specText}
=== SPEC \u7ED3\u675F ===`,
    schema: { type: "object" }
  });
  if (!r.ok || !r.data)
    return { ...empty, error: r.rationale };
  return {
    ok: true,
    dims: pickArray2(r.data, ["dims", "dimensions", "completeness"]).map((d) => ({
      dim: String(d.dim ?? d.name ?? ""),
      present: Boolean(d.present ?? d.covered),
      quote: d.quote == null ? void 0 : String(d.quote)
    })),
    conflicts: pickArray2(r.data, ["conflicts", "contradictions", "inconsistencies"]).map((c) => ({
      pair: String(c.pair ?? ""),
      reason: String(c.reason ?? "")
    })),
    verifiability: parseVerifiability(r.data)
  };
}
var SYS;
var init_spec_quality = __esm({
  "../../packages/analyzer/dist/shared/spec-quality.js"() {
    "use strict";
    init_llm_json();
    init_spec_docs();
    SYS = `\u4F60\u662F SPEC \u8D28\u91CF\u8BC4\u5BA1\u52A9\u624B\u3002\u4E0B\u9762\u662F\u4E00\u4EFD SPEC \u6587\u6863\u5168\u6587\uFF0C\u8BF7**\u540C\u65F6**\u5B8C\u6210\u4E09\u9879\u8BC4\u5BA1\uFF1A

1. **\u5B8C\u6574\u6027**\uFF08dims\uFF09\uFF1A\u6309\u516D\u4E2A\u7EF4\u5EA6\u5224\u65AD\u662F\u5426\u8986\u76D6 \u2014\u2014 \u76EE\u6807\u3001\u8303\u56F4\u3001\u4E3B\u8DEF\u5F84\u3001\u8FB9\u754C\u3001\u9519\u8BEF\u8DEF\u5F84\u3001\u975E\u529F\u80FD\u7EA6\u675F\uFF1B
2. **\u4E00\u81F4\u6027**\uFF08conflicts\uFF09\uFF1A\u627E\u51FA**\u4E92\u76F8\u77DB\u76FE**\u7684\u6761\u6B3E\u5BF9\uFF08\u5FC5\u987B A vs \u5FC5\u987B B\u3001\u8303\u56F4/\u9ED8\u8BA4\u503C\u51B2\u7A81\uFF09\uFF0C
   \u6CA1\u6709\u5C31\u8F93\u51FA\u7A7A\u6570\u7EC4\uFF0C**\u4E0D\u8981\u628A"\u8868\u8FF0\u4E0D\u540C\u4F46\u542B\u4E49\u4E00\u81F4"\u7B97\u4F5C\u51B2\u7A81**\uFF1B
3. **\u53EF\u9A8C\u8BC1\u6027**\uFF08verifiability\uFF09\uFF1A\u5BF9\u6BCF\u4E2A\u6761\u76EE\uFF08\u7528 R1/R2\u2026 \u6807\u8BC6\uFF09\u5224\u65AD\u662F\u5426**\u540C\u65F6**\u6EE1\u8DB3\u4E09\u4E2A\u6761\u4EF6 \u2014\u2014
   \u5199\u660E\u53EF\u5224\u5B9A\u7684\u9A8C\u6536\u6807\u51C6\u3001\u542B\u53EF\u91CF\u5316\u6307\u6807\uFF08\u6570\u503C/\u9608\u503C/\u65F6\u5EF6/\u8986\u76D6\u7387\uFF09\u3001\u80FD\u5BF9\u5E94\u5177\u4F53\u6D4B\u8BD5\u7528\u4F8B\u3002
   **\u53EA\u5217\u51FA\u4E09\u4E2A\u6761\u4EF6\u5168\u6EE1\u8DB3\u7684\u6761\u76EE id**\uFF0C\u5E76\u7ED9\u51FA\u4F60\u770B\u5230\u7684\u6761\u76EE\u603B\u6570\u3002

\u53EA\u8F93\u51FA json\uFF0C\u5B57\u6BB5\u540D**\u5FC5\u987B\u4E25\u683C\u5982\u4E0B**\uFF0C\u4E0D\u8981\u6539\u540D\uFF1A
{"dims":[{"dim":"\u76EE\u6807","present":true,"quote":"..."}],"conflicts":[{"pair":"R1|R3","reason":"..."}],"verifiability":{"verifiableIds":["R1","R3"],"itemCount":31}}`;
  }
});

// ../../packages/analyzer/dist/profile/pr-keywords.js
function extOf(uri) {
  const m = /\.([a-z0-9]+)$/i.exec(String(uri ?? ""));
  return m ? m[1].toLowerCase() : "";
}
function languageDistribution(gitDiff) {
  const count = /* @__PURE__ */ new Map();
  for (const f of gitDiff?.files ?? []) {
    const lang = EXT_LANG2[extOf(f.uri)];
    if (lang)
      count.set(lang, (count.get(lang) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]);
}
function dedupeKeywords(list, max = 10) {
  if (!Array.isArray(list))
    return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const raw of list) {
    const k = String(raw ?? "").trim().slice(0, 24);
    if (!k)
      continue;
    const key = k.toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    out.push(k);
    if (out.length >= max)
      break;
  }
  return out;
}
async function extractPrKeywords(opts) {
  const descs = opts.tasks.map((t) => String(t.desc ?? "").trim()).filter(Boolean).slice(0, 20).map((d) => `- ${d.slice(0, 200)}`);
  const langs = languageDistribution(opts.gitDiff);
  const langText = langs.slice(0, 6).map(([l, n]) => `${l}\xD7${n}`).join("\u3001") || "\uFF08\u65E0 git diff\uFF09";
  const user = `\u672C\u6B21 PR \u7684\u4EFB\u52A1\u63CF\u8FF0\uFF1A
${descs.join("\n") || "\uFF08\u65E0 Task \u63CF\u8FF0\uFF09"}

\u6587\u4EF6\u8BED\u8A00\u5206\u5E03\uFF1A${langText}

\u8BF7\u63D0\u53D6\u6280\u672F\u5173\u952E\u8BCD\u3002`;
  const r = await llmJson(opts.llm, {
    metricId: "pr-keywords",
    templateId: "pr-keywords-v1",
    system: SYS2,
    user,
    schema: { type: "object" }
  });
  if (r.ok && r.data) {
    const keywords = dedupeKeywords(r.data.keywords);
    if (keywords.length > 0)
      return { ok: true, keywords, rationale: "LLM \u63D0\u53D6" };
  }
  const fallback = langs.slice(0, 3).map(([l]) => l);
  return {
    ok: false,
    keywords: fallback,
    rationale: r.ok ? "LLM \u8FD4\u56DE\u4E3A\u7A7A\uFF0C\u6309\u8BED\u8A00\u5206\u5E03\u964D\u7EA7" : `LLM \u5931\u8D25\uFF08${r.rationale}\uFF09\uFF0C\u6309\u8BED\u8A00\u5206\u5E03\u964D\u7EA7`
  };
}
var SYS2, EXT_LANG2;
var init_pr_keywords = __esm({
  "../../packages/analyzer/dist/profile/pr-keywords.js"() {
    "use strict";
    init_llm_json();
    SYS2 = `\u4F60\u662F\u6280\u672F\u5173\u952E\u8BCD\u63D0\u53D6\u52A9\u624B\u3002\u7ED9\u5B9A\u4E00\u6B21 PR \u7684\u4EFB\u52A1\u63CF\u8FF0\u96C6\u5408\u4E0E\u6587\u4EF6\u8BED\u8A00\u5206\u5E03\uFF0C\u63D0\u53D6\u672C\u6B21 PR \u6D89\u53CA\u7684
\u6280\u672F\u5173\u952E\u8BCD\uFF08\u6846\u67B6 / \u8BED\u8A00 / \u9886\u57DF\u8BCD\uFF0C\u5982 "React" "\u6570\u636E\u5E93" "\u9274\u6743"\uFF09\u3002

\u8981\u6C42\uFF1A
1. \u6700\u591A 10 \u4E2A\uFF0C\u6BCF\u4E2A\u4E0D\u8D85\u8FC7 24 \u5B57\u7B26\uFF0C\u4F7F\u7528\u901A\u7528\u5199\u6CD5\uFF08\u82F1\u6587\u6280\u672F\u8BCD\u4FDD\u6301\u82F1\u6587\uFF09\uFF1B
2. \u53EA\u63D0\u53D6\u4E0E\u672C\u6B21\u4FEE\u6539\u5B9E\u8D28\u76F8\u5173\u7684\u8BCD\uFF0C\u4E0D\u8981\u6CDB\u5316\uFF08\u4E0D\u8981 "\u5F00\u53D1" "\u6D4B\u8BD5" \u8FD9\u7C7B\u901A\u7528\u8BCD\uFF09\u3002

\u53EA\u8F93\u51FA json\uFF0C\u5B57\u6BB5\u540D\u5FC5\u987B\u4E25\u683C\u5982\u4E0B\uFF1A{"keywords":["TypeScript","WebSocket"]}`;
    EXT_LANG2 = {
      ts: "TypeScript",
      tsx: "TypeScript",
      js: "JavaScript",
      jsx: "JavaScript",
      mjs: "JavaScript",
      rs: "Rust",
      go: "Go",
      py: "Python",
      java: "Java",
      cs: "C#",
      cpp: "C++",
      cc: "C++",
      h: "C++",
      c: "C",
      php: "PHP",
      rb: "Ruby",
      swift: "Swift",
      kt: "Kotlin",
      scala: "Scala",
      vue: "Vue",
      svelte: "Svelte",
      html: "HTML",
      css: "CSS",
      scss: "CSS",
      sql: "SQL",
      sh: "Shell",
      ps1: "PowerShell",
      md: "Markdown",
      json: "JSON",
      yaml: "YAML",
      yml: "YAML"
    };
  }
});

// ../../packages/analyzer/dist/credit/context.js
function buildPromptTurns(behaviors) {
  const sorted = [...behaviors].sort((a, b) => a.ts - b.ts);
  const msgs = sorted.filter((b) => b.action === "agent.message").map((b) => ({
    id: b.id,
    ts: b.ts,
    text: String(b.context?.promptText ?? b.context?.output ?? "")
  }));
  const turns = [];
  for (const b of sorted) {
    if (b.action !== "prompt.submit")
      continue;
    const text = String(b.context?.promptText ?? "");
    if (!text)
      continue;
    const next = msgs.find((m) => m.ts >= b.ts);
    turns.push({
      id: b.id,
      ts: b.ts,
      promptText: text,
      messageId: next?.id,
      messageText: next?.text,
      messageTs: next?.ts
    });
  }
  return turns;
}
function createContext(opts) {
  const behaviors = [...opts.behaviors].sort((a, b) => a.ts - b.ts);
  const cfg = mergeCreditConfig(opts.config);
  const gitDiff = opts.gitDiff ?? { available: false, files: null, commitCount: 0 };
  let _reading = null;
  let _coreDiff = null;
  let _prompts = null;
  let _specs = null;
  let _testCases = null;
  let _rtm = null;
  let _specQuality = null;
  let _profileKeywords = null;
  let _testUris = null;
  const gitFiles = gitDiff.files?.map((f) => f.uri) ?? [];
  const testUris = () => {
    if (_testUris)
      return _testUris;
    const set = /* @__PURE__ */ new Map();
    const add = (u) => {
      if (!u)
        return;
      const n = normUri(u);
      if (!set.has(n))
        set.set(n, canonicalUri(u));
    };
    for (const b of behaviors) {
      if (b.object?.kind === "file" && b.object.uri && isTestUri(b.object.uri))
        add(b.object.uri);
    }
    const known = collectFileUris(behaviors);
    for (const u of gitFiles) {
      const abs = resolveGitUri(u, known);
      if (isTestUri(abs))
        add(abs);
      if (/\.(rs|go|py)$/i.test(abs))
        add(abs);
    }
    _testUris = [...set.values()];
    return _testUris;
  };
  const ctx = {
    prId: opts.prId,
    behaviors,
    taskGraph: opts.taskGraph,
    gitDiff,
    llm: opts.llm,
    git: opts.git ?? null,
    fs: opts.fs ?? null,
    config: cfg,
    profile: opts.profile ?? null,
    stats: { llmCalls: 0, llmFallback: 0 },
    stages: () => opts.taskGraph.stages,
    tasks: () => opts.taskGraph.tasks,
    // C6 复用 P2-pre 的 `detectTestRuns`（TaskGraph 不含 testRuns，由调用方算好传入）
    testRuns: () => opts.testRuns ?? [],
    testUris,
    reading: () => {
      if (!_reading)
        _reading = buildReadingTrace(behaviors, cfg.reading);
      return _reading;
    },
    coreDiff: () => {
      if (!_coreDiff)
        _coreDiff = buildCoreDiff(gitDiff, behaviors, cfg.diff);
      return _coreDiff;
    },
    prompts: () => {
      if (!_prompts)
        _prompts = buildPromptTurns(behaviors);
      return _prompts;
    },
    specDocs: () => {
      if (!_specs) {
        const uris = collectSpecUris(behaviors, gitFiles, {
          filePatterns: cfg.spec.filePatterns,
          excludePatterns: cfg.spec.excludePatterns,
          minContentChars: cfg.spec.minContentChars
        });
        _specs = loadSpecDocs(uris, opts.fs ?? null, {
          filePatterns: cfg.spec.filePatterns,
          excludePatterns: cfg.spec.excludePatterns,
          minContentChars: cfg.spec.minContentChars
        });
      }
      return _specs;
    },
    testCases: () => {
      if (!_testCases) {
        _testCases = (async () => {
          const out = [];
          for (const uri of testUris()) {
            const content = opts.fs ? await opts.fs.readFile(uri) : null;
            if (content == null)
              continue;
            out.push(...extractTestCases(content, uri));
          }
          return out;
        })();
      }
      return _testCases;
    },
    rtm: () => {
      if (!_rtm) {
        _rtm = (async () => {
          const specs = await ctx.specDocs();
          return buildRtm({
            specs,
            testUris: testUris(),
            fs: opts.fs ?? null,
            llm: opts.llm,
            taskIds: opts.taskGraph.tasks.map((t) => t.id),
            gitFiles
          });
        })();
      }
      return _rtm;
    },
    specQuality: () => {
      if (!_specQuality) {
        _specQuality = (async () => {
          const specs = await ctx.specDocs();
          ctx.stats.llmCalls++;
          const q = await buildSpecQuality({
            specs,
            llm: opts.llm,
            itemIds: specs.flatMap((s) => s.items.map((i) => i.id))
          });
          if (!q.ok)
            ctx.stats.llmFallback++;
          return q;
        })();
      }
      return _specQuality;
    },
    profileKeywords: () => {
      if (!_profileKeywords) {
        _profileKeywords = (async () => {
          ctx.stats.llmCalls++;
          const r = await extractPrKeywords({
            tasks: opts.taskGraph.tasks,
            gitDiff,
            llm: opts.llm
          });
          if (!r.ok)
            ctx.stats.llmFallback++;
          return r.keywords;
        })();
      }
      return _profileKeywords;
    }
  };
  return ctx;
}
var init_context = __esm({
  "../../packages/analyzer/dist/credit/context.js"() {
    "use strict";
    init_reading();
    init_core_diff();
    init_spec_docs();
    init_uri();
    init_rtm();
    init_spec_quality();
    init_pr_keywords();
    init_config2();
  }
});

// ../../packages/rules/dist/types.js
var init_types3 = __esm({
  "../../packages/rules/dist/types.js"() {
    "use strict";
  }
});

// ../../packages/rules/dist/tree.js
function calculatorFile(id) {
  return id.split(".").map((seg) => seg.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()).join("-");
}
function walk(node, visit, depth = 0) {
  visit(node, depth);
  for (const c of node.children ?? [])
    walk(c, visit, depth + 1);
}
function leaves(node = PR_CREDIT_TREE) {
  const out = [];
  walk(node, (n) => {
    if (!n.children || n.children.length === 0)
      out.push(n);
  });
  return out;
}
function findNode(id, node = PR_CREDIT_TREE) {
  let hit = null;
  walk(node, (n) => {
    if (n.id === id)
      hit = n;
  });
  return hit;
}
var RULESET_VERSION, leaf, stub, specGroup, testPlanGroup, genGroup, testGroup, fixGroup, manualGroup, reviewGroup, PR_CREDIT_TREE, RULESET;
var init_tree = __esm({
  "../../packages/rules/dist/tree.js"() {
    "use strict";
    RULESET_VERSION = "2.0";
    leaf = (id, zh, en, level, metric) => ({ id, name: { "zh-CN": zh, "en-US": en }, level, metric });
    stub = (id, zh, en, level, provider, tool) => ({ id, name: { "zh-CN": zh, "en-US": en }, level, stub: { provider, tool } });
    specGroup = {
      id: "spec",
      name: { "zh-CN": "SPEC\u5DE5\u7A0B", "en-US": "SPEC Engineering" },
      level: "L3",
      prerequisite: "specDocs",
      children: [
        leaf("spec.aiDecisionRatio", "AI\u5BF9SPEC\u51B3\u7B56\u5F71\u54CD\u5360\u6BD4", "AI Decision Influence", "L4", {
          type: "percent",
          higherIsBetter: false,
          requires: ["specDocs", "prompts"]
        }),
        leaf("spec.review", "\u5BA1\u9605SPEC", "SPEC Review", "L4", {
          type: "binary",
          requires: ["specDocs", "reading"]
        }),
        leaf("spec.boundary", "SPEC\u8FB9\u754C\u628A\u63A7", "Boundary Control", "L4", {
          type: "ordinal",
          ordinalKey: "threeTier",
          requires: ["prompts"]
        }),
        leaf("spec.constraint", "\u7EA6\u675F\u6CE8\u5165", "Constraint Injection", "L4", {
          type: "binary",
          requires: ["prompts"]
        }),
        {
          id: "spec.quality",
          name: { "zh-CN": "SPEC\u8D28\u91CF", "en-US": "SPEC Quality" },
          level: "L4",
          children: [
            leaf("spec.quality.completeness", "\u5B8C\u6574\u6027", "Completeness", "L5", {
              type: "number",
              requires: ["specDocs"]
            }),
            leaf("spec.quality.consistency", "\u4E00\u81F4\u6027", "Consistency", "L5", {
              type: "number",
              requires: ["specDocs"]
            }),
            leaf("spec.quality.unambiguity", "\u65E0\u6B67\u4E49\u6027", "Unambiguity", "L5", {
              type: "number",
              requires: ["specDocs"]
            }),
            leaf("spec.quality.verifiability", "\u53EF\u9A8C\u8BC1\u6027", "Verifiability", "L5", {
              type: "number",
              requires: ["specDocs", "rtm"]
            }),
            leaf("spec.quality.traceability", "\u53EF\u8FFD\u8E2A\u6027", "Traceability", "L5", {
              type: "number",
              requires: ["rtm", "coreDiff"]
            })
          ]
        }
      ]
    };
    testPlanGroup = {
      id: "testPlan",
      name: { "zh-CN": "\u6D4B\u8BD5\u65B9\u6848\u51C6\u5907", "en-US": "Test Planning" },
      level: "L3",
      prerequisite: "testArtifacts",
      children: [
        leaf("testPlan.specCoverage", "\u6D4B\u8BD5\u5BF9SPEC\u8986\u76D6\u7387", "SPEC Coverage by Tests", "L4", {
          type: "percent",
          requires: ["rtm"]
        }),
        leaf("testPlan.review", "\u5BA1\u9605\u6D4B\u8BD5\u65B9\u6848", "Test Plan Review", "L4", {
          type: "binary",
          requires: ["reading"]
        }),
        leaf("testPlan.askImprove", "\u8981\u6C42\u5B8C\u5584\u6D4B\u8BD5\u7528\u4F8B", "Ask to Improve Tests", "L4", {
          type: "binary",
          requires: ["prompts"]
        }),
        {
          id: "testPlan.tc",
          name: { "zh-CN": "\u6D4B\u8BD5\u5B8C\u5907\u5EA6", "en-US": "Test Completeness" },
          level: "L4",
          children: [
            leaf("testPlan.tc.l1", "TC-L1 \u9700\u6C42/\u89C4\u683C\u8986\u76D6", "TC-L1 Requirement Coverage", "L5", {
              type: "percent",
              requires: ["rtm"]
            }),
            stub("testPlan.tc.l2", "TC-L2 \u7ED3\u6784\u8986\u76D6", "TC-L2 Structural Coverage", "L5", "coverage-structural", "Istanbul/JaCoCo/Coverage.py"),
            stub("testPlan.tc.l3", "TC-L3 \u53D8\u5F02\u6740\u6B7B\u7387", "TC-L3 Mutation Score", "L5", "mutation", "PIT/Stryker/mutmut"),
            stub("testPlan.tc.l4", "TC-L4 \u98CE\u9669/\u8FB9\u754C\u8986\u76D6", "TC-L4 Risk/Boundary Coverage", "L5", "risk-boundary", "\u9759\u6001\u5206\u6790 + \u590D\u6742\u5EA6"),
            leaf("testPlan.tc.l5", "TC-L5 \u8FC7\u7A0B\u884C\u4E3A\u53C2\u4E0E", "TC-L5 Process Involvement", "L5", {
              type: "number",
              requires: ["tasks", "coreDiff"]
            })
          ]
        }
      ]
    };
    genGroup = {
      id: "gen",
      name: { "zh-CN": "AI\u4EE3\u7801\u751F\u6210", "en-US": "AI Code Generation" },
      level: "L3",
      prerequisite: "codeGen",
      children: [
        leaf("gen.staged", "\u5927\u578B\u4FEE\u6539\u5206\u9636\u6BB5\u65BD\u884C", "Staged Implementation", "L4", {
          type: "binary",
          requires: ["coreDiff"]
        }),
        leaf("gen.planFirst", "\u5148\u5BA1\u8BA1\u5212\u518D\u6388\u6743\u751F\u6210", "Review Plan Before Authorize", "L4", {
          type: "binary",
          requires: ["prompts"]
        }),
        /**
         * ~~`gen.acceptLines` 单次Accept行数~~ —— **已退出 CREDIT 分数框架（2026-09-08 决策）**。
         *
         * 原因：真实 `userAccept` 事件在桌面端未实测触发（遗留 A-001），`diffStats` 依赖
         * core `GitPort` 事后补齐，指标长期处于 `degraded` 保守分，不具备判别力。
         *
         * **数据层保留**：`userAccept` 的采集、`diffStats` 补齐、以及 `gen-accept-lines.ts`
         * 的计算实现**全部保留**（不删），仅供离线分析/未来复用；此处只是**不注册**，
         * 故不参与分数聚合。恢复只需把 leaf 加回来。
         */
        leaf("gen.alignment", "\u751F\u6210\u4E0ESPEC\u5BF9\u9F50\u5EA6", "Generation\u2013SPEC Alignment", "L4", {
          type: "percent",
          requires: ["tasks", "rtm", "coreDiff"]
        }),
        {
          id: "gen.verify",
          name: { "zh-CN": "\u6838\u5FC3Diff\u5373\u65F6\u9A8C\u89C6", "en-US": "Core Diff Verification" },
          level: "L4",
          prerequisite: "coreDiff",
          children: [
            leaf("gen.verify.readPr", "\u9605\u8BFB\u8986\u76D6 PR", "Read Coverage (PR)", "L5", {
              type: "percent",
              requires: ["coreDiff", "reading"]
            }),
            leaf("gen.verify.editPe", "\u7F16\u8F91\u8986\u76D6 PE", "Edit Coverage (PE)", "L5", {
              type: "percent",
              requires: ["coreDiff"]
            })
            /**
             * ~~`gen.verify.cursorNc` 光标游走 NC~~ —— **已退出 CREDIT 分数框架（2026-09-09，D-032）**。
             *
             * 原因（B-014 实测）：P1 采集的 `cursor` 事件仅 **4 条**且 `dwellMs` 全为 0
             * （采集层限制，非计算问题）→ 该指标**恒为 0**，不具备判别力。
             * 与 `gen.acceptLines`（D-030）同理：数据不足的指标硬算只会稀释总分。
             *
             * **数据层保留**：`selectionChanged` / `cursor` 事件采集、`ReadingTraceIndex`
             * 的行级停留索引、以及 `gen-verify-cursor-nc.ts` 计算实现**全部保留**（不删），
             * 仅供离线分析/未来复用；此处只是**不注册**，故不参与分数聚合。
             * 恢复只需把 leaf 加回来。
             */
          ]
        }
      ]
    };
    testGroup = {
      id: "test",
      name: { "zh-CN": "AI\u8F6F\u4EF6\u6D4B\u8BD5", "en-US": "AI Testing" },
      level: "L3",
      prerequisite: "testRuns",
      children: [
        leaf("test.devTrigger", "\u4EB2\u81EA\u89E6\u53D1/\u91CD\u8DD1\u6D4B\u8BD5", "Dev-Triggered Test Run", "L4", {
          type: "binary",
          requires: ["testRuns"]
        }),
        leaf("test.passRate", "\u81EA\u52A8\u6D4B\u8BD5\u6700\u7EC8\u901A\u8FC7\u7387", "Final Automated Pass Rate", "L4", {
          type: "percent",
          requires: ["testRuns"]
        }),
        leaf("test.reviewFailure", "\u5BA1\u9605\u5931\u8D25\u65E5\u5FD7/\u65AD\u8A00\u7EC6\u8282", "Failure Log Review", "L4", {
          type: "binary",
          requires: ["testRuns", "reading"]
        }),
        stub("test.keypath", "\u5173\u952E\u8DEF\u5F84\u6D4B\u8BD5\u8986\u76D6\u7387", "Critical Path Coverage", "L4", "coverage-keypath", "\u8986\u76D6\u7387\u5DE5\u5177 + \u5708\u590D\u6742\u5EA6")
      ]
    };
    fixGroup = {
      id: "fix",
      name: { "zh-CN": "AI\u4EE3\u7801\u4FEE\u590D", "en-US": "AI Fix" },
      level: "L3",
      prerequisite: "fixPhase",
      children: [
        leaf("fix.issueQuality", "\u95EE\u9898\u63CF\u8FF0\u8D28\u91CF", "Issue Description Quality", "L4", {
          type: "ordinal",
          ordinalKey: "threeTier",
          requires: ["prompts"]
        }),
        leaf("fix.reproCase", "\u63D0\u4F9B\u5931\u8D25\u7528\u4F8B/\u590D\u73B0\u6B65\u9AA4", "Repro Case Provided", "L4", {
          type: "binary",
          requires: ["prompts", "testRuns"]
        }),
        leaf("fix.rootCause", "\u5BA1\u9605\u4FEE\u590DDiff\u5E76\u533A\u5206\u6839\u56E0", "Root-Cause Aware Fix Review", "L4", {
          type: "ordinal",
          ordinalKey: "threeTier",
          requires: ["reading"]
        })
      ]
    };
    manualGroup = {
      id: "manual",
      name: { "zh-CN": "\u4EBA\u5DE5\u8865\u6D4B\u4E0E\u9A8C\u8BC1", "en-US": "Manual Verification" },
      level: "L3",
      children: [
        leaf("manual.passRate", "\u4EBA\u5DE5\u6D4B\u8BD5\u6700\u7EC8\u901A\u8FC7\u7387", "Final Manual Pass Rate", "L4", {
          type: "percent",
          requires: ["prompts"]
        }),
        leaf("manual.boundary", "\u4E3B\u52A8\u6784\u9020\u8FB9\u754C/\u5F02\u5E38\u8865\u6D4B", "Proactive Boundary Testing", "L4", {
          type: "binary",
          requires: ["prompts"]
        })
      ]
    };
    reviewGroup = {
      id: "review",
      name: { "zh-CN": "AI Review", "en-US": "AI Review" },
      level: "L3",
      children: [
        leaf("review.decision", "\u4FEE\u54EA\u4E9B\u95EE\u9898\u7684\u51B3\u7B56\u65B9\u5F0F", "Fix Decision Mode", "L4", {
          type: "ordinal",
          ordinalKey: "threeTier",
          requires: ["prompts"]
        }),
        stub("review.firstViolation", "\u9996\u8F6EReview\u89C4\u7EA6\u8FDD\u89C4\u6BD4\u4F8B", "First-Round Violations", "L4", "lint", "ESLint/SonarQube/PMD"),
        stub("review.finalViolation", "\u6700\u7EC8\u4EA4\u4ED8\u89C4\u7EA6\u8FDD\u89C4\u6BD4\u4F8B", "Final Violations", "L4", "lint", "ESLint/SonarQube/PMD"),
        leaf("review.rounds", "Review\u6240\u7528\u8F6E\u6570", "Review Rounds", "L4", {
          type: "ordinal",
          ordinalKey: "reviewRounds"
        }),
        leaf("review.disposition", "Review\u610F\u89C1\u5904\u7F6E", "Finding Disposition", "L4", {
          type: "ordinal",
          ordinalKey: "threeTier",
          requires: ["prompts"]
        })
      ]
    };
    PR_CREDIT_TREE = {
      id: "prCredit",
      name: { "zh-CN": "PR_Credit", "en-US": "PR_Credit" },
      level: "L0",
      children: [
        {
          id: "procCredits",
          name: { "zh-CN": "\u672C\u6B21 PR \u8FC7\u7A0B\u53EF\u4FE1\u8D28\u91CF", "en-US": "Process Credits" },
          level: "L1",
          children: [
            {
              id: "prep",
              name: { "zh-CN": "\u51C6\u5907\u9636\u6BB5", "en-US": "Preparation" },
              level: "L2",
              children: [specGroup, testPlanGroup]
            },
            {
              id: "impl",
              name: { "zh-CN": "\u5B9E\u65BD\u9636\u6BB5", "en-US": "Implementation" },
              level: "L2",
              children: [genGroup]
            },
            {
              id: "verify",
              name: { "zh-CN": "\u9A8C\u8BC1\u9636\u6BB5", "en-US": "Verification" },
              level: "L2",
              children: [testGroup, fixGroup, manualGroup, reviewGroup]
            }
          ]
        },
        {
          id: "devCredit",
          name: { "zh-CN": "\u7A0B\u5E8F\u5458\u5386\u53F2\u4FE1\u7528", "en-US": "Dev Credit" },
          level: "L1",
          prerequisite: "devProfile",
          children: [
            {
              id: "devCredit.profile",
              name: { "zh-CN": "\u4E2A\u4EBA\u753B\u50CF", "en-US": "Profile" },
              level: "L2",
              children: [
                leaf("devCredit.profile.proficiency", "\u4E3B\u9886\u57DF\u719F\u7EC3\u5EA6", "Domain Proficiency", "L4", {
                  type: "number"
                }),
                leaf("devCredit.profile.collabLines", "\u7D2F\u8BA1AI\u534F\u4F5C\u884C\u6570\u6863", "Collab Lines Tier", "L4", {
                  type: "ordinal",
                  ordinalKey: "collabLinesTier"
                })
              ]
            },
            {
              id: "devCredit.history",
              name: { "zh-CN": "\u5386\u53F2PR", "en-US": "History" },
              level: "L2",
              children: [
                leaf("devCredit.history.successRate", "\u5386\u53F2PR\u6210\u529F\u7387", "Historical Success Rate", "L4", {
                  type: "percent"
                }),
                leaf("devCredit.history.recentAvg", "\u8FD1N\u6B21\u5E73\u5747PR_Credit", "Recent Avg PR_Credit", "L4", {
                  type: "number"
                })
              ]
            }
          ]
        }
      ]
    };
    RULESET = { v: RULESET_VERSION, tree: PR_CREDIT_TREE };
  }
});

// ../../packages/rules/dist/index.js
var init_dist = __esm({
  "../../packages/rules/dist/index.js"() {
    "use strict";
    init_types3();
    init_tree();
  }
});

// ../../packages/analyzer/dist/credit/aggregate.js
function aggregateGroup(node, children) {
  let sumW = 0;
  let sumWS = 0;
  const statuses = /* @__PURE__ */ new Set();
  const evidence = [];
  for (const c of children) {
    const r = c.result;
    statuses.add(r.status);
    if (SCORING.has(r.status) && r.score != null) {
      const w = r.weight || 1;
      sumW += w;
      sumWS += w * r.score;
    }
  }
  for (const c of children) {
    if (c.result.status === "error") {
      evidence.push({ kind: "note", text: `${c.node.name["zh-CN"]}\uFF1A\u8BA1\u7B97\u5F02\u5E38\uFF0C\u5DF2\u6392\u9664` });
    }
  }
  if (sumW === 0) {
    const status = statuses.has("pending") ? "pending" : statuses.has("error") ? "error" : statuses.has("excluded_no_evidence") ? "excluded_no_evidence" : "excluded";
    return {
      id: node.id,
      status,
      score: null,
      weight: node.metric?.weight ?? 1,
      detail: status === "pending" ? "\u5B50\u8282\u70B9\u5747\u5F85\u5916\u90E8\u5DE5\u5177\u63A5\u5165" : "\u5B50\u8282\u70B9\u5747\u4E0D\u9002\u7528\uFF0C\u4E0D\u8BA1\u5206",
      evidence
    };
  }
  const excluded = [...statuses].filter((s) => !SCORING.has(s));
  const detail = excluded.length > 0 ? `\u7531 ${children.filter((c) => SCORING.has(c.result.status)).length}/${children.length} \u4E2A\u8BA1\u5206\u5B50\u8282\u70B9\u52A0\u6743\u5E73\u5747\uFF08\u5176\u4F59\u5DF2\u91CD\u5206\u914D\uFF09` : `\u7531 ${children.length} \u4E2A\u5B50\u8282\u70B9\u52A0\u6743\u5E73\u5747`;
  return {
    id: node.id,
    status: "ok",
    score: Number((sumWS / sumW).toFixed(2)),
    weight: node.metric?.weight ?? 1,
    detail,
    evidence
  };
}
function aggregateRoot(root, children, cfg) {
  const proc = children.find((c) => c.node.id === "procCredits");
  const dev = children.find((c) => c.node.id === "devCredit");
  const procScore = proc?.result.score ?? null;
  const devScore = dev?.result.status === "ok" ? dev.result.score : null;
  let score;
  let detail;
  if (procScore == null) {
    return {
      id: root.id,
      status: "excluded",
      score: null,
      weight: 1,
      detail: "\u8FC7\u7A0B\u5206\u4E0D\u53EF\u7528",
      evidence: []
    };
  }
  if (devScore == null) {
    score = procScore;
    detail = "Dev_Credit \u7F3A\u5931\uFF08P3 \u63A5\u5165\uFF09\uFF0CPR_Credit = Proc_Credits";
  } else {
    score = cfg.procWeight * procScore + cfg.devWeight * devScore;
    detail = `PR_Credit = ${cfg.procWeight} \xD7 ${procScore} + ${cfg.devWeight} \xD7 ${devScore}`;
  }
  return {
    id: root.id,
    status: "ok",
    score: Number(score.toFixed(2)),
    weight: 1,
    detail,
    evidence: []
  };
}
function bandOf(score) {
  if (score < 40)
    return { band: "blind", label: { "zh-CN": "\u76F2\u76EE\u653E\u884C", "en-US": "Blind Trust" } };
  if (score < 60)
    return { band: "selective", label: { "zh-CN": "\u9009\u62E9\u6027\u5173\u6CE8", "en-US": "Selective Attention" } };
  if (score < 80)
    return { band: "verified", label: { "zh-CN": "\u4E3B\u52A8\u9A8C\u8BC1", "en-US": "Active Verification" } };
  return { band: "mastered", label: { "zh-CN": "\u5B8C\u5168\u638C\u63A7", "en-US": "Full Control" } };
}
var SCORING;
var init_aggregate = __esm({
  "../../packages/analyzer/dist/credit/aggregate.js"() {
    "use strict";
    SCORING = /* @__PURE__ */ new Set(["ok", "degraded"]);
  }
});

// ../../packages/analyzer/dist/metrics/helpers.js
function mk(id, status, score, detail, evidence = [], weight = 1) {
  return { id, status, score, detail, evidence, weight };
}
function llmFail(ctx, id, r) {
  return r.unavailable ? degradedR(ctx, id, `LLM \u901A\u9053\u672A\u5C31\u7EEA\uFF1A${r.rationale}`) : errorR(id, `LLM \u8C03\u7528\u5931\u8D25\uFF1A${r.rationale}`);
}
function ordinal(ctx, key, tierIndex2) {
  const table = ctx.config.ordinal[key] ?? [0, 50, 100];
  return table[Math.max(0, Math.min(table.length - 1, tierIndex2))] ?? 0;
}
function pct(ratio2, higherIsBetter = true) {
  const r = Math.max(0, Math.min(1, ratio2));
  return Number(((higherIsBetter ? r : 1 - r) * 100).toFixed(2));
}
function normNumber(value, max, min = 0, higherIsBetter = true) {
  if (max <= min)
    return 0;
  const r = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return Number(((higherIsBetter ? r : 1 - r) * 100).toFixed(2));
}
var okR, degradedR, excludedR, noEvidenceR, pendingR, errorR;
var init_helpers = __esm({
  "../../packages/analyzer/dist/metrics/helpers.js"() {
    "use strict";
    okR = (id, score, detail, ev = []) => mk(id, "ok", Number(score.toFixed(2)), detail, ev);
    degradedR = (ctx, id, detail, ev = []) => mk(id, "degraded", ctx.config.degraded.conservativeScore, `${detail}\uFF08\u6570\u636E\u4E0D\u8DB3\uFF0C\u8BA1\u4FDD\u5B88\u5206\uFF09`, ev);
    excludedR = (id, detail) => mk(id, "excluded", null, detail);
    noEvidenceR = (id, detail) => mk(id, "excluded_no_evidence", null, detail);
    pendingR = (id, detail) => mk(id, "pending", null, detail);
    errorR = (id, detail) => mk(id, "error", 0, detail);
  }
});

// ../../packages/analyzer/dist/metrics/spec-ai-decision-ratio.js
async function specAiDecisionRatio(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return excludedR(id, "\u65E0 SPEC \u6587\u6863");
  const turns = ctx.prompts();
  if (turns.length === 0) {
    return degradedR(ctx, id, "\u65E0\u5BF9\u8BDD\u4E8B\u4EF6\uFF0C\u65E0\u6CD5\u5F52\u56E0\u51B3\u7B56\u63D0\u51FA\u8005");
  }
  const specText = stripCodeBlocks(specs.map((s) => `# ${s.uri}
${s.content}`).join("\n\n")).slice(0, 8e3);
  const r1 = await llmJson(ctx.llm, {
    metricId: "spec-decision-points",
    templateId: "spec-decision-points-v1",
    system: SYS_DECIDE,
    // 显式边界：告诉模型"下面是被分析的材料"，降低其续写材料内容的概率
    // （初版直接把 SPEC 全文当 user 消息，模型被其中的 Rust 代码带偏，返回了代码片段）
    user: `\u4E0B\u9762\u662F SPEC \u6587\u6863\u5168\u6587\uFF0C\u8BF7\u4ECE\u4E2D\u63D0\u53D6\u51B3\u7B56\u70B9\u3002

=== SPEC \u5F00\u59CB ===
${specText}
=== SPEC \u7ED3\u675F ===`,
    schema: { type: "object", required: ["decisions"] }
  });
  ctx.stats.llmCalls++;
  if (!r1.ok || !r1.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r1);
  }
  const decisions = asArray(r1.data.decisions);
  if (decisions.length < ctx.config.decisionAttribution.minDecisions) {
    return excludedR(id, `\u51B3\u7B56\u70B9\u4EC5 ${decisions.length} \u4E2A\uFF08< ${ctx.config.decisionAttribution.minDecisions}\uFF09\uFF0C\u6837\u672C\u592A\u5C0F\u6BD4\u4F8B\u65E0\u610F\u4E49`);
  }
  const timeline = turns.slice(0, 60).map((t, i) => `[${i}] dev: ${t.promptText.slice(0, 400)}${t.messageText ? `
    ai: ${t.messageText.slice(0, 400)}` : ""}`).join("\n");
  const r2 = await llmJson(ctx.llm, {
    metricId: "spec-decision-attrib",
    templateId: "spec-decision-attrib-v1",
    system: SYS_ATTRIB,
    user: `\u51B3\u7B56\u70B9\uFF1A
${JSON.stringify(decisions)}

\u5BF9\u8BDD\u65F6\u95F4\u7EBF\uFF1A
${timeline}`,
    schema: { type: "object", required: ["attributions"] }
  });
  ctx.stats.llmCalls++;
  if (!r2.ok || !r2.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r2);
  }
  let dev = 0;
  let ai = 0;
  let unclear = 0;
  const evidence = [];
  for (const a of asArray(r2.data.attributions)) {
    const who = String(a?.firstProposer ?? "unclear").toLowerCase();
    if (who === "dev")
      dev++;
    else if (who === "ai")
      ai++;
    else
      unclear++;
    evidence.push({
      kind: "llm",
      templateId: "spec-decision-attrib-v1",
      rationale: `${a?.decisionId ?? "?"} \u9996\u6B21\u63D0\u51FA\u8005=${who}\uFF1A${String(a?.reason ?? "").slice(0, 120)}`
    });
  }
  const denom = dev + ai;
  if (denom === 0)
    return excludedR(id, "\u6240\u6709\u51B3\u7B56\u70B9\u5747\u65E0\u6CD5\u5F52\u56E0\uFF08unclear\uFF09");
  const aiRatio = ai / denom;
  return okR(id, pct(aiRatio, false), `\u5171 ${dev + ai + unclear} \u4E2A\u51B3\u7B56\u70B9\uFF1ADev \u63D0\u51FA ${dev}\u3001AI \u63D0\u51FA ${ai}\u3001\u65E0\u6CD5\u5224\u65AD ${unclear}\uFF1BAI \u5360\u6BD4 ${(aiRatio * 100).toFixed(0)}%`, evidence);
}
var SYS_DECIDE, SYS_ATTRIB;
var init_spec_ai_decision_ratio = __esm({
  "../../packages/analyzer/dist/metrics/spec-ai-decision-ratio.js"() {
    "use strict";
    init_llm_json();
    init_spec_docs();
    init_helpers();
    SYS_DECIDE = `\u4F60\u662F\u9700\u6C42\u5206\u6790\u52A9\u624B\u3002\u4ECE SPEC \u6587\u6863\u4E2D\u63D0\u53D6\u6240\u6709\u5173\u952E\u51B3\u7B56\u70B9\uFF08\u6280\u672F\u9009\u578B\u3001\u63A5\u53E3\u5951\u7EA6\u3001\u8FB9\u754C\u7EA6\u675F\u3001\u6570\u636E\u7ED3\u6784\u7B49\uFF09\u3002

\u91CD\u8981\uFF1A
1. \u6587\u6863\u91CC\u5E38\u5E38\u5305\u542B\u4EE3\u7801\u7247\u6BB5\uFF0C**\u4EC5\u4F9B\u4F60\u7406\u89E3\uFF0C\u4E25\u7981\u7EED\u5199\u3001\u6539\u5199\u6216\u8F93\u51FA\u4EE3\u7801**\uFF1B
2. \u53EA\u8F93\u51FA json\uFF0C\u4E0D\u8981\u4EFB\u4F55\u8BF4\u660E\u6587\u5B57\u3001\u4E0D\u8981 markdown \u4EE3\u7801\u5757\u6807\u8BB0\u3002

\u8F93\u51FA\u683C\u5F0F\uFF1A{"decisions":[{"decisionId":"D1","point":"...","quote":"\u539F\u6587\u6458\u5F55"}]}`;
    SYS_ATTRIB = `\u4F60\u662F\u5BF9\u8BDD\u5F52\u56E0\u52A9\u624B\u3002\u7ED9\u5B9A\u51B3\u7B56\u70B9\u5217\u8868\u4E0E\u6309\u65F6\u95F4\u6392\u5217\u7684\u5BF9\u8BDD\uFF0C\u5224\u65AD\u6BCF\u4E2A\u51B3\u7B56\u70B9**\u9996\u6B21**\u7531\u8C01\u63D0\u51FA\u3002

\u5224\u5B9A\u6807\u51C6\uFF08\u52A1\u5FC5\u4E25\u683C\uFF09\uFF1A
- "dev" \u2014\u2014 \u5F00\u53D1\u8005\u5728\u5BF9\u8BDD\u4E2D**\u4E3B\u52A8\u3001\u5177\u4F53**\u63D0\u51FA\u4E86\u8BE5\u51B3\u7B56\u7684\u5185\u5BB9\uFF08\u660E\u786E\u7684\u9009\u578B\u3001\u6570\u503C\u3001\u65B9\u6848\u3001\u8FB9\u754C\uFF09\uFF1B
- "ai"  \u2014\u2014 AI \u4E3B\u52A8\u63D0\u51FA\u6216\u5EFA\u8BAE\u4E86\u8BE5\u51B3\u7B56\uFF0C**\u5373\u4F7F\u5F00\u53D1\u8005\u968F\u540E\u540C\u610F\u4E5F\u4ECD\u5F52 ai**
          \uFF08\u4F8B\u5982\u5F00\u53D1\u8005\u8BF4"\u53EF\u4EE5""\u6309\u4F60\u8BF4\u7684""\u7B2C\u4E00\u4E2A""\u4F60\u51B3\u5B9A"\uFF0C\u4E00\u5F8B\u7B97 ai\uFF09\uFF1B
- "unclear" \u2014\u2014 \u5BF9\u8BDD\u91CC\u627E\u4E0D\u5230\u8BE5\u51B3\u7B56\u7684\u63D0\u51FA\u8FC7\u7A0B\u3002

\u53EA\u8F93\u51FA json\uFF0C\u5B57\u6BB5\u540D\u5FC5\u987B\u5982\u4E0B\uFF1A
{"attributions":[{"decisionId":"D1","firstProposer":"ai","reason":"..."}]}`;
  }
});

// ../../packages/analyzer/dist/metrics/spec-review.js
function totalLinesOf(ctx, uri, readLines) {
  const fromDiff = ctx.gitDiff.files?.find((f) => f.uri === uri)?.added ?? 0;
  return Math.max(1, fromDiff, readLines.length > 0 ? readLines[readLines.length - 1] : 0);
}
async function specReview(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return okR(id, 0, "\u65E0 SPEC \u6587\u6863");
  const idx = ctx.reading();
  const cfg = ctx.config.review;
  let best = 0;
  const evidence = [];
  let detail = "";
  for (const s of specs) {
    const t = traceOf(idx, s.uri);
    const total = totalLinesOf(ctx, s.uri, t.readLines);
    const coverage = total > 0 ? t.readLines.length / total : 0;
    const byCoverage = coverage >= cfg.coverageRatio;
    const byDwell = t.dwellMs >= cfg.dwellMs;
    if (byCoverage || byDwell) {
      best = 100;
      detail = `\u5DF2\u5BA1\u9605 ${s.uri}\uFF08\u884C\u8986\u76D6 ${(coverage * 100).toFixed(0)}%\uFF0C\u505C\u7559 ${(t.dwellMs / 1e3).toFixed(1)}s\uFF09`;
    } else {
      detail = detail || `SPEC \u5B58\u5728\u4F46\u7A97\u53E3\u5185\u65E0\u6709\u6548\u9605\u8BFB\uFF08\u8986\u76D6 ${(coverage * 100).toFixed(0)}% < ${cfg.coverageRatio * 100}%\uFF0C\u505C\u7559 ${(t.dwellMs / 1e3).toFixed(1)}s < ${cfg.dwellMs / 1e3}s\uFF09`;
    }
    evidence.push({
      kind: "file",
      uris: [s.uri],
      lines: t.readLines.slice(0, 50),
      label: `${s.uri}\uFF1A\u8986\u76D6 ${(coverage * 100).toFixed(0)}% / \u505C\u7559 ${(t.dwellMs / 1e3).toFixed(1)}s`
    });
  }
  return okR(id, best, detail, evidence);
}
var init_spec_review = __esm({
  "../../packages/analyzer/dist/metrics/spec-review.js"() {
    "use strict";
    init_helpers();
    init_reading();
  }
});

// ../../packages/analyzer/dist/metrics/spec-boundary.js
async function specBoundary(ctx, node) {
  const id = node.id;
  const turns = ctx.prompts();
  if (turns.length === 0)
    return degradedR(ctx, id, "\u65E0 Dev Prompt \u4E8B\u4EF6");
  const askTurns = turns.filter((t) => ASK_PATTERNS.some((p) => p.test(t.promptText)));
  const hasAsk = askTurns.length > 0;
  const evidence = askTurns.slice(0, 5).map((t) => ({
    kind: "prompt",
    ids: [t.id],
    text: t.promptText.slice(0, 300)
  }));
  if (!hasAsk) {
    return okR(id, ordinal(ctx, "threeTier", 0), "\u672A\u68C0\u51FA\u8981\u6C42 AI \u53CD\u95EE\u7684 Prompt", evidence);
  }
  const convo = turns.slice(0, 40).map((t) => `dev: ${t.promptText.slice(0, 300)}${t.messageText ? `
ai: ${t.messageText.slice(0, 300)}` : ""}`).join("\n");
  const r = await llmJson(ctx.llm, {
    metricId: "spec-boundary",
    templateId: "spec-boundary-v1",
    system: SYS3,
    user: convo,
    schema: { type: "object", required: ["replies"] }
  });
  ctx.stats.llmCalls++;
  if (!r.ok || !r.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r);
  }
  const replies = asArray(r.data.replies);
  let explicit = 0;
  let other = 0;
  for (const x of replies) {
    const c = String(x?.replyClass ?? "").toLowerCase();
    if (c === "explicit")
      explicit++;
    else
      other++;
    evidence.push({
      kind: "llm",
      templateId: "spec-boundary-v1",
      rationale: `\u53CD\u95EE\u56DE\u590D=${c}\uFF1A${String(x?.quote ?? "").slice(0, 100)}`
    });
  }
  const total = explicit + other;
  if (total === 0) {
    return okR(id, ordinal(ctx, "threeTier", 0), "\u68C0\u51FA\u8981\u6C42\u53CD\u95EE\u4F46\u672A\u8BC6\u522B\u51FA AI \u7684\u53CD\u95EE", evidence);
  }
  const rate = explicit / total;
  const tier = rate >= 1 ? 2 : rate > 0 ? 1 : 0;
  return okR(id, ordinal(ctx, "threeTier", tier), `AI \u53CD\u95EE ${total} \u5904\uFF0CDev \u663E\u5F0F\u6307\u660E ${explicit} \u5904\uFF08explicitRate ${(rate * 100).toFixed(0)}%\uFF09`, evidence);
}
var ASK_PATTERNS, SYS3;
var init_spec_boundary = __esm({
  "../../packages/analyzer/dist/metrics/spec-boundary.js"() {
    "use strict";
    init_llm_json();
    init_helpers();
    ASK_PATTERNS = [
      /ask\s+me/i,
      /clarif/i,
      /反问/,
      /澄清/,
      /有疑问.{0,6}问/,
      /confirm(ation)?/i,
      /先问/,
      /有.{0,4}问题.{0,4}(问|确认)/
    ];
    SYS3 = `\u4F60\u662F\u5BF9\u8BDD\u5206\u6790\u52A9\u624B\u3002\u7ED9\u5B9A\u4E00\u6BB5\u5F00\u53D1\u8005\u4E0E AI \u7684\u5BF9\u8BDD\uFF0C\u627E\u51FA AI \u5411\u5F00\u53D1\u8005\u63D0\u51FA\u7684**\u6240\u6709\u53CD\u95EE/\u9009\u62E9\u9898**\uFF0C
\u5E76\u5224\u65AD\u5F00\u53D1\u8005\u5BF9\u6BCF\u4E2A\u53CD\u95EE\u7684\u56DE\u590D\u8D28\u91CF\uFF1Aexplicit=\u663E\u5F0F\u6307\u660E\u9009\u9879\u6216\u53C2\u6570\uFF1Bdefault=\u4EC5\u540C\u610F/\u8BA9 AI \u51B3\u5B9A\uFF08\u5982"\u53EF\u4EE5""ok""\u6309\u4F60\u8BF4\u7684""\u7B2C\u4E00\u4E2A"\uFF09\uFF1Bnone=\u672A\u56DE\u590D\u3002
\u4E25\u683C\u8F93\u51FA json\uFF1A{"replies":[{"question":"...","replyClass":"explicit","quote":"..."}]}`;
  }
});

// ../../packages/analyzer/dist/metrics/spec-constraint.js
async function specConstraint(ctx, node) {
  const id = node.id;
  const turns = ctx.prompts();
  if (turns.length === 0)
    return degradedR(ctx, id, "\u65E0 Dev Prompt \u4E8B\u4EF6");
  const evidence = [];
  let hit = false;
  let kind = "";
  for (const t of turns) {
    const text = t.promptText;
    const k = ALWAYS.some((p) => p.test(text)) ? "Always" : ASK.some((p) => p.test(text)) ? "Ask" : NEVER.some((p) => p.test(text)) ? "Never" : "";
    if (k) {
      hit = true;
      kind = k;
      evidence.push({ kind: "prompt", ids: [t.id], text: `[${k}] ${text.slice(0, 300)}` });
    }
  }
  return okR(id, hit ? 100 : 0, hit ? `\u68C0\u51FA\u7EA6\u675F\u6CE8\u5165\uFF08${kind} \u7C7B\uFF09\uFF0C\u5171 ${evidence.length} \u5904` : "Prompt \u4E2D\u672A\u68C0\u51FA\u7EA6\u675F\u6CE8\u5165", evidence.slice(0, 5));
}
var ALWAYS, ASK, NEVER;
var init_spec_constraint = __esm({
  "../../packages/analyzer/dist/metrics/spec-constraint.js"() {
    "use strict";
    init_helpers();
    ALWAYS = [/必须使用/, /必须遵循/, /应当遵循/, /\bmust\s+use\b/i, /\balways\s+use\b/i, /务必/];
    ASK = [/遇到.{0,20}(问我|确认|先问)/, /\bask\s+me\s+when\b/i, /遇到.{0,10}情况先/];
    NEVER = [/禁止/, /不允许/, /不要使用/, /\bnever\s+use\b/i, /\bdon'?t\s+use\b/i, /不得/];
  }
});

// ../../packages/analyzer/dist/metrics/spec-quality-completeness.js
async function specQualityCompleteness(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return excludedR(id, "\u65E0 SPEC \u6587\u6863");
  const content = specs.map((s) => s.content).join("\n\n");
  if (content.trim().length < ctx.config.spec.minContentChars) {
    return excludedR(id, `SPEC \u5185\u5BB9\u4EC5 ${content.trim().length} \u5B57\u7B26\uFF0C\u8FC7\u77ED\u65E0\u8BC4\u4F30\u610F\u4E49`);
  }
  const q = await ctx.specQuality();
  if (!q.ok) {
    return llmFail(ctx, id, { unavailable: false, rationale: q.error ?? "SPEC \u8D28\u91CF\u5224\u5B9A\u672A\u5B8C\u6210" });
  }
  const dims = q.dims;
  const present = dims.filter((d) => d?.present).length;
  const total = dims.length > 0 ? dims.length : DIMS.length;
  const score = clamp01to100(present / total * 100);
  const evidence = dims.map((d) => ({
    kind: "llm",
    templateId: "spec-quality-v2",
    rationale: `${d.dim ?? "?"}\uFF1A${d.present ? "\u5DF2\u8986\u76D6" : "\u7F3A\u5931"}${d.quote ? ` \u2014 ${String(d.quote).slice(0, 80)}` : ""}`
  }));
  return okR(id, score, `\u516D\u7EF4\u8986\u76D6 ${present}/${total}`, evidence);
}
var DIMS;
var init_spec_quality_completeness = __esm({
  "../../packages/analyzer/dist/metrics/spec-quality-completeness.js"() {
    "use strict";
    init_llm_json();
    init_helpers();
    DIMS = ["\u76EE\u6807", "\u8303\u56F4", "\u4E3B\u8DEF\u5F84", "\u8FB9\u754C", "\u9519\u8BEF\u8DEF\u5F84", "\u975E\u529F\u80FD\u7EA6\u675F"];
  }
});

// ../../packages/analyzer/dist/metrics/spec-quality-consistency.js
function extractDecls(content) {
  const out = /* @__PURE__ */ new Set();
  for (const m of content.matchAll(/([@a-z0-9][\w.@/-]{2,40})@(\d+\.\d+[\w.-]*)/gi))
    out.add(m[1]);
  for (const m of content.matchAll(/\bfrom\s+["']([\w@][\w@/.-]*)["']/g))
    out.add(m[1]);
  for (const m of content.matchAll(/require\(["']([\w@][\w@/.-]*)["']\)/g))
    out.add(m[1]);
  return [...out];
}
async function readManifests(ctx) {
  if (!ctx.fs)
    return "";
  const dirs = /* @__PURE__ */ new Set();
  for (const doc of await ctx.specDocs()) {
    const parts = doc.uri.replace(/\\/g, "/").split("/");
    for (let i = parts.length - 1; i >= Math.max(0, parts.length - 4); i--) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  const chunks = [];
  for (const d of [...dirs].slice(0, 8)) {
    for (const m of MANIFESTS) {
      const text = await ctx.fs.readFile(`${d}/${m}`);
      if (text) {
        chunks.push(text);
        break;
      }
    }
  }
  return chunks.join("\n");
}
async function specQualityConsistency(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return excludedR(id, "\u65E0 SPEC \u6587\u6863");
  const items = specs.flatMap((s) => s.items);
  const evidence = [];
  let contradictionRatio = 0;
  if (items.length >= 2) {
    const q = await ctx.specQuality();
    if (q.ok) {
      contradictionRatio = Math.min(1, q.conflicts.length / Math.max(1, items.length));
      for (const c of q.conflicts.slice(0, 5)) {
        evidence.push({
          kind: "llm",
          templateId: "spec-quality-v2",
          rationale: `\u5185\u90E8\u77DB\u76FE ${c.pair || "?"}\uFF1A${String(c.reason ?? "").slice(0, 120)}`
        });
      }
    } else {
      evidence.push({ kind: "note", text: `\u5185\u90E8\u77DB\u76FE\u68C0\u6D4B\u672A\u5B8C\u6210\uFF1A${q.error ?? "\u672A\u77E5\u539F\u56E0"}` });
    }
  }
  let violationRatio = null;
  const manifest = await readManifests(ctx);
  if (manifest) {
    const decls = extractDecls(specs.map((s) => s.content).join("\n"));
    if (decls.length > 0) {
      const missing = decls.filter((d) => !manifest.toLowerCase().includes(d.toLowerCase()));
      violationRatio = missing.length / decls.length;
      if (missing.length > 0) {
        evidence.push({
          kind: "note",
          text: `SPEC \u58F0\u660E\u7684\u4F9D\u8D56\u672A\u5728 manifest \u4E2D\u627E\u5230\uFF1A${missing.slice(0, 5).join(", ")}`
        });
      }
    }
  }
  const worst = Math.max(contradictionRatio, violationRatio ?? 0);
  const detail = violationRatio == null ? `\u5185\u90E8\u77DB\u76FE\u7387 ${(contradictionRatio * 100).toFixed(0)}%\uFF08\u5916\u90E8\u51B2\u7A81\uFF1A\u65E0 manifest \u53EF\u6BD4\u5BF9\uFF0C\u4E0D\u53C2\u4E0E\uFF09` : `\u5185\u90E8\u77DB\u76FE\u7387 ${(contradictionRatio * 100).toFixed(0)}%\uFF0C\u5916\u90E8\u51B2\u7A81\u7387 ${(violationRatio * 100).toFixed(0)}%`;
  return okR(id, clamp01to100((1 - worst) * 100), detail, evidence);
}
var MANIFESTS;
var init_spec_quality_consistency = __esm({
  "../../packages/analyzer/dist/metrics/spec-quality-consistency.js"() {
    "use strict";
    init_llm_json();
    init_helpers();
    MANIFESTS = ["package.json", "Cargo.toml", "requirements.txt", "pyproject.toml", "go.mod"];
  }
});

// ../../packages/analyzer/dist/metrics/spec-quality-unambiguity.js
function isAmbiguous(text) {
  const sentences = text.split(/[。；\n]/).map((s) => s.trim()).filter(Boolean);
  let vague = 0;
  let missingCond = 0;
  let missingSubject = 0;
  let pronoun = 0;
  for (const s of sentences) {
    if (VAGUE.test(s))
      vague++;
    if (OBLIGATION.test(s) && !CONDITION.test(s))
      missingCond++;
    if (/^[开添修删支实返回处判]/u.test(s) && !SUBJECT.test(s))
      missingSubject++;
    if (PRONOUN.test(s))
      pronoun++;
  }
  const total = sentences.length || 1;
  if (vague / total > 0.2)
    return { hit: true, reason: "\u6A21\u7CCA\u91CF\u8BCD\u8FC7\u591A" };
  if (missingCond / total > 0.2)
    return { hit: true, reason: "\u4E49\u52A1\u8868\u8FF0\u7F3A\u6761\u4EF6\u5B50\u53E5" };
  if (missingSubject / total > 0.2)
    return { hit: true, reason: "\u4E3B\u8BED\u7F3A\u5931" };
  if (pronoun / total > 0.2)
    return { hit: true, reason: "\u4EE3\u8BCD\u6307\u4EE3\u4E0D\u6E05" };
  return { hit: false, reason: "" };
}
async function specQualityUnambiguity(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return excludedR(id, "\u65E0 SPEC \u6587\u6863");
  const items = specs.flatMap((s) => s.items);
  if (items.length === 0)
    return excludedR(id, "SPEC \u65E0\u53EF\u5206\u6790\u6761\u76EE");
  let ambiguous = 0;
  const evidence = [];
  for (const it of items) {
    const r = isAmbiguous(it.text);
    if (r.hit) {
      ambiguous++;
      evidence.push({ kind: "note", text: `${it.id}\uFF1A${r.reason}` });
    }
  }
  const ratio2 = ambiguous / items.length;
  return okR(id, clamp01to100((1 - ratio2) * 100), `${items.length} \u4E2A\u6761\u76EE\u4E2D ${ambiguous} \u4E2A\u5B58\u5728\u6B67\u4E49`, evidence.slice(0, 8));
}
var VAGUE, OBLIGATION, CONDITION, SUBJECT, PRONOUN;
var init_spec_quality_unambiguity = __esm({
  "../../packages/analyzer/dist/metrics/spec-quality-unambiguity.js"() {
    "use strict";
    init_helpers();
    init_llm_json();
    VAGUE = /适当|尽快|灵活|合理|尽量|一定程度的|as appropriate|timely|flexible/i;
    OBLIGATION = /应当|必须|应该|should|must/i;
    CONDITION = /if|when|若|当|时|unless/i;
    SUBJECT = /系统|用户|服务|组件|前端|后端|模块|接口|本方案|本需求/i;
    PRONOUN = /它|其|该功能|该模块|该接口|this feature|it should/i;
  }
});

// ../../packages/analyzer/dist/metrics/spec-quality-verifiability.js
async function specQualityVerifiability(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return excludedR(id, "\u65E0 SPEC \u6587\u6863");
  const items = specs.flatMap((s) => s.items.map((i) => ({ id: i.id, text: i.text })));
  if (items.length === 0)
    return excludedR(id, "SPEC \u65E0\u53EF\u8BC4\u4F30\u6761\u76EE");
  const q = await ctx.specQuality();
  if (!q.ok) {
    return llmFail(ctx, id, { unavailable: false, rationale: q.error ?? "SPEC \u8D28\u91CF\u5224\u5B9A\u672A\u5B8C\u6210" });
  }
  const v = q.verifiability;
  const full = v.verifiableIds.length;
  const total = v.itemCount || items.length;
  return okR(id, clamp01to100(full / Math.max(1, total) * 100), `${total} \u4E2A\u6761\u76EE\u4E2D ${full} \u4E2A\u540C\u65F6\u6EE1\u8DB3\u300C\u9A8C\u6536\u6807\u51C6 + \u53EF\u91CF\u5316 + \u6709\u6D4B\u8BD5\u6620\u5C04\u300D`, [
    {
      kind: "llm",
      templateId: "spec-quality-v2",
      rationale: `\u5168\u6EE1\u8DB3\u6761\u76EE\uFF1A${v.verifiableIds.slice(0, 12).join(", ") || "\uFF08\u65E0\uFF09"}${v.verifiableIds.length > 12 ? "\u2026" : ""}`
    }
  ]);
}
var init_spec_quality_verifiability = __esm({
  "../../packages/analyzer/dist/metrics/spec-quality-verifiability.js"() {
    "use strict";
    init_llm_json();
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/spec-quality-traceability.js
async function specQualityTraceability(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return excludedR(id, "\u65E0 SPEC \u6587\u6863");
  const m = await ctx.rtm();
  const tasks = ctx.tasks();
  const diffFiles = ctx.gitDiff.files?.map((f) => f.uri) ?? [];
  const factors = [];
  const evidence = [];
  let segs = 0;
  const specIds = m.specItems.map((s) => s.id);
  const mappedSpec = Object.values(m.specToTask).filter((v) => v.length > 0).length;
  const f1 = ratio(mappedSpec, specIds.length);
  const taskWithSpec = new Set(Object.values(m.specToTask).flat()).size;
  const b1 = ratio(taskWithSpec, tasks.length);
  if (f1 != null && b1 != null) {
    factors.push(f1, b1);
    segs++;
    evidence.push({
      kind: "note",
      text: `SPEC\u2192Task\uFF1A\u6B63\u5411 ${mappedSpec}/${specIds.length}\uFF0C\u53CD\u5411 ${taskWithSpec}/${tasks.length}`
    });
  }
  const diffSet = new Set(diffFiles.map((u) => u.replace(/\\/g, "/").toLowerCase()));
  let taskWithDiff = 0;
  const diffWithTask = /* @__PURE__ */ new Set();
  for (const t of tasks) {
    const hit = t.files.filter((f) => diffSet.has(f.uri.replace(/\\/g, "/").toLowerCase()));
    if (hit.length > 0) {
      taskWithDiff++;
      for (const h of hit)
        diffWithTask.add(h.uri);
    }
  }
  const f2 = ratio(taskWithDiff, tasks.length);
  const b2 = ratio(diffWithTask.size, diffFiles.length);
  if (f2 != null && b2 != null) {
    factors.push(f2, b2);
    segs++;
    evidence.push({
      kind: "note",
      text: `Task\u2192Diff\uFF1A\u6B63\u5411 ${taskWithDiff}/${tasks.length}\uFF0C\u53CD\u5411 ${diffWithTask.size}/${diffFiles.length}`
    });
  }
  const diffWithTest = Object.values(m.diffToTest).filter((v) => v.length > 0).length;
  const testWithDiff = new Set(Object.values(m.diffToTest).flat()).size;
  const f3 = ratio(diffWithTest, diffFiles.length);
  const b3 = ratio(testWithDiff, m.testCases.length);
  if (f3 != null && b3 != null) {
    factors.push(f3, b3);
    segs++;
    evidence.push({
      kind: "note",
      text: `Diff\u2192\u6D4B\u8BD5\uFF1A\u6B63\u5411 ${diffWithTest}/${diffFiles.length}\uFF0C\u53CD\u5411 ${testWithDiff}/${m.testCases.length}`
    });
  }
  if (segs === 0 || factors.length === 0) {
    return excludedR(id, "\u4E09\u6BB5\u8FFD\u6EAF\u94FE\u5747\u65E0\u6570\u636E\uFF08\u65E0 Task\u3001\u65E0 Diff \u6216\u65E0\u6D4B\u8BD5\u7528\u4F8B\uFF09");
  }
  const product = factors.reduce((a, b) => a * b, 1);
  const score = Math.pow(product, 1 / factors.length) * 100;
  return okR(id, Number(score.toFixed(2)), `${segs} \u6BB5\u8FFD\u6EAF\u94FE\u7684\u51E0\u4F55\u5E73\u5747\uFF08\u542B\u6B63\u5411/\u53CD\u5411\u5171 ${factors.length} \u4E2A\u56E0\u5B50\uFF09`, evidence);
}
var ratio;
var init_spec_quality_traceability = __esm({
  "../../packages/analyzer/dist/metrics/spec-quality-traceability.js"() {
    "use strict";
    init_helpers();
    ratio = (hit, total) => total > 0 ? hit / total : null;
  }
});

// ../../packages/analyzer/dist/metrics/test-plan-spec-coverage.js
async function testPlanSpecCoverage(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return excludedR(id, "\u65E0 SPEC \u6587\u6863\uFF0C\u65E0\u6CD5\u8BA1\u7B97\u8986\u76D6\u7387");
  const m = await ctx.rtm();
  if (m.testCases.length === 0) {
    return okR(id, 0, "\u6709 SPEC \u4F46\u672A\u8BC6\u522B\u51FA\u4EFB\u4F55\u6D4B\u8BD5\u7528\u4F8B\uFF0C\u8986\u76D6\u7387\u4E3A 0");
  }
  if (!m.llmOk) {
    return degradedR(ctx, id, "RTM \u5339\u914D\u672A\u5B8C\u6210\uFF08LLM \u4E0D\u53EF\u7528\uFF09");
  }
  const covered = Object.values(m.specToTest).filter((v) => v.length > 0).length;
  const evidence = m.specItems.slice(0, 12).map((s) => ({
    kind: "llm",
    templateId: "rtm-v1",
    rationale: `${s.id}\uFF1A${(m.specToTest[s.id] ?? []).length > 0 ? "\u5DF2\u8986\u76D6" : "\u672A\u8986\u76D6"} \u2014 ${s.text.slice(0, 60)}`
  }));
  return okR(id, Number((m.specCoverage * 100).toFixed(2)), `${covered}/${m.specItems.length} \u4E2A SPEC \u6761\u76EE\u6709\u6D4B\u8BD5\u7528\u4F8B\u6620\u5C04`, evidence);
}
var init_test_plan_spec_coverage = __esm({
  "../../packages/analyzer/dist/metrics/test-plan-spec-coverage.js"() {
    "use strict";
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/test-plan-review.js
async function testPlanReview(ctx, node) {
  const id = node.id;
  const uris = ctx.testUris();
  if (uris.length === 0)
    return okR(id, 0, "\u65E0\u6D4B\u8BD5\u5DE5\u4EF6");
  const idx = ctx.reading();
  const cfg = ctx.config.review;
  const evidence = [];
  let best = 0;
  let detail = "";
  for (const uri of uris) {
    const t = traceOf(idx, uri);
    const total = Math.max(1, t.readLines.length > 0 ? t.readLines[t.readLines.length - 1] : 0);
    const coverage = t.readLines.length / total;
    const ok2 = coverage >= cfg.testCoverageRatio || t.dwellMs >= cfg.testDwellMs;
    if (ok2) {
      best = 100;
      detail = `\u5DF2\u5BA1\u9605 ${uri}\uFF08\u8986\u76D6 ${(coverage * 100).toFixed(0)}%\uFF0C\u505C\u7559 ${(t.dwellMs / 1e3).toFixed(1)}s\uFF09`;
    } else {
      detail = detail || `\u6D4B\u8BD5\u5DE5\u4EF6\u5B58\u5728\u4F46\u672A\u68C0\u51FA\u6709\u6548\u9605\u8BFB\uFF08\u8986\u76D6 ${(coverage * 100).toFixed(0)}%\uFF0C\u505C\u7559 ${(t.dwellMs / 1e3).toFixed(1)}s\uFF09`;
    }
    evidence.push({
      kind: "file",
      uris: [uri],
      lines: t.readLines.slice(0, 40),
      label: `${uri}\uFF1A\u8986\u76D6 ${(coverage * 100).toFixed(0)}% / \u505C\u7559 ${(t.dwellMs / 1e3).toFixed(1)}s`
    });
  }
  return okR(id, best, detail, evidence.slice(0, 6));
}
var init_test_plan_review = __esm({
  "../../packages/analyzer/dist/metrics/test-plan-review.js"() {
    "use strict";
    init_helpers();
    init_reading();
  }
});

// ../../packages/analyzer/dist/metrics/test-plan-ask-improve.js
async function testPlanAskImprove(ctx, node) {
  const id = node.id;
  const turns = ctx.prompts();
  if (turns.length === 0)
    return degradedR(ctx, id, "\u65E0 Dev Prompt \u4E8B\u4EF6");
  const hits = turns.filter((t) => PATTERNS.some((p) => p.test(t.promptText)));
  const evidence = hits.slice(0, 5).map((t) => ({
    kind: "prompt",
    ids: [t.id],
    text: t.promptText.slice(0, 300)
  }));
  return okR(id, hits.length > 0 ? 100 : 0, hits.length > 0 ? `\u68C0\u51FA ${hits.length} \u5904\u8981\u6C42\u5B8C\u5584\u6D4B\u8BD5\u7684 Prompt` : "\u672A\u68C0\u51FA\u8981\u6C42\u5B8C\u5584\u6D4B\u8BD5\u7528\u4F8B\u7684 Prompt", evidence);
}
var PATTERNS;
var init_test_plan_ask_improve = __esm({
  "../../packages/analyzer/dist/metrics/test-plan-ask-improve.js"() {
    "use strict";
    init_helpers();
    PATTERNS = [
      /补充测试/,
      /增加(边界|异常|edge)?(用例|测试)/i,
      /完善断言/,
      /增加异常路径/,
      /覆盖率(不够|不足)/,
      /补\s*case/i,
      /add\s+(more\s+)?(test|edge)\s+case/i,
      /边界用例/
    ];
  }
});

// ../../packages/analyzer/dist/metrics/test-plan-tc-l1.js
async function testPlanTcL1(ctx, node) {
  const r = await testPlanSpecCoverage(ctx, node);
  return { ...r, id: node.id, detail: `${r.detail}\uFF08TC-L1\uFF0C\u4E0E\u6D4B\u8BD5\u5BF9SPEC\u8986\u76D6\u7387\u540C\u6E90\uFF09` };
}
var init_test_plan_tc_l1 = __esm({
  "../../packages/analyzer/dist/metrics/test-plan-tc-l1.js"() {
    "use strict";
    init_test_plan_spec_coverage();
  }
});

// ../../packages/analyzer/dist/metrics/test-plan-tc-l5.js
async function testPlanTcL5(ctx, node) {
  const id = node.id;
  const testUris = new Set(ctx.testUris());
  const cd = ctx.coreDiff();
  const idx = ctx.reading();
  const cfg = ctx.config.review;
  let designed = false;
  for (const b of ctx.behaviors) {
    if (b.action !== "edit" || b.actor !== "dev")
      continue;
    const uri = b.object?.kind === "file" ? b.object.uri : void 0;
    if (!uri || !isTestUri(uri))
      continue;
    const aiSet = new Set(cd.aiLines[uri] ?? []);
    const lr = b.object?.lineRange;
    const inAi = Array.isArray(lr) && lr.length === 2 ? aiSet.has(Number(lr[0])) : false;
    if (!inAi) {
      designed = true;
      break;
    }
  }
  let reviewed = false;
  for (const uri of testUris) {
    const t = traceOf(idx, uri);
    const total = Math.max(1, t.readLines.length > 0 ? t.readLines[t.readLines.length - 1] : 0);
    if (t.readLines.length / total >= cfg.testCoverageRatio || t.dwellMs >= cfg.testDwellMs) {
      reviewed = true;
      break;
    }
  }
  const aiTestEdits = ctx.behaviors.filter((b) => b.action === "edit" && b.actor === "ai" || b.action === "agent.tool" && /^(write|edit|multiedit)$/i.test(String(b.context?.toolName ?? ""))).map((b) => b.ts).sort((a, b) => a - b);
  let supplemented = false;
  if (aiTestEdits.length > 0) {
    const first = aiTestEdits[0];
    for (const b of ctx.behaviors) {
      if (b.action !== "edit" || b.actor !== "dev" || b.ts <= first)
        continue;
      const after = String(b.context?.after ?? "");
      const lr = b.object?.lineRange;
      const nearTestFile = b.object?.kind === "file" && b.object.uri && testUris.has(b.object.uri) || Array.isArray(lr) && (cd.aiLines[b.object?.uri ?? ""] ?? []).length > 0;
      if (nearTestFile && TEST_FN.test(after)) {
        supplemented = true;
        break;
      }
    }
  }
  const hit = [designed, reviewed, supplemented].filter(Boolean).length;
  const evidence = [
    { kind: "note", text: `\u53C2\u4E0E\u8BBE\u8BA1\uFF1A${designed ? "\u547D\u4E2D" : "\u672A\u547D\u4E2D"}` },
    { kind: "note", text: `\u5BA1\u9605\u6D4B\u8BD5\uFF1A${reviewed ? "\u547D\u4E2D" : "\u672A\u547D\u4E2D"}` },
    { kind: "note", text: `AI \u751F\u6210\u540E\u589E\u8865\uFF1A${supplemented ? "\u547D\u4E2D" : "\u672A\u547D\u4E2D"}` }
  ];
  return okR(id, Number((hit / 3 * 100).toFixed(2)), `\u4E09\u9879\u53C2\u4E0E\u884C\u4E3A\u547D\u4E2D ${hit}/3`, evidence);
}
var TEST_FN;
var init_test_plan_tc_l5 = __esm({
  "../../packages/analyzer/dist/metrics/test-plan-tc-l5.js"() {
    "use strict";
    init_helpers();
    init_reading();
    init_spec_docs();
    TEST_FN = /(test\s*\(|it\s*\(|def\s+test_|func\s+Test|#\[test\])/i;
  }
});

// ../../packages/analyzer/dist/shared/todo-plan.js
function normStatus(raw) {
  const status = String(raw ?? "pending");
  return { status, done: DONE.test(status), doing: DOING.test(status) };
}
function parseTodos(raw) {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object")
    return null;
  const o = v;
  for (const key of ["todos", "items", "plan", "steps", "tasks"]) {
    if (Array.isArray(o[key]))
      return o[key];
  }
  if (Array.isArray(v))
    return v;
  return null;
}
function isTodoTool(toolName, todoTools) {
  const t = String(toolName ?? "").toLowerCase();
  if (!t)
    return false;
  return todoTools.some((p) => {
    const q = p.toLowerCase();
    return t === q || t.startsWith(q) || t.includes(q);
  });
}
function extractTodoSnapshots(behaviors, todoTools) {
  const out = [];
  for (const b of behaviors) {
    const name = String(b.context?.toolName ?? "");
    if (!isTodoTool(name, todoTools))
      continue;
    const todos = parseTodos(b.context?.toolInput);
    if (!todos || todos.length === 0)
      continue;
    const items = todos.map((t, i) => {
      const { status, done, doing } = normStatus(t.status ?? t.state);
      return {
        id: String(t.id ?? t.index ?? i),
        content: String(t.content ?? t.text ?? t.title ?? "").slice(0, 200),
        status,
        done,
        doing
      };
    });
    out.push({
      ts: b.ts,
      behaviorId: b.id,
      todos: items,
      completedCount: items.filter((x) => x.done).length
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}
function analyzeStagedPlan(snapshots, opts) {
  const empty = {
    hasTodoTool: false,
    maxSteps: 0,
    snapshots: 0,
    finalCompleted: 0,
    decomposed: false,
    progressed: false,
    inOrder: false
  };
  if (snapshots.length === 0)
    return empty;
  const maxSteps = Math.max(...snapshots.map((s) => s.todos.length));
  const finalCompleted = snapshots[snapshots.length - 1].completedCount;
  const counts = snapshots.map((s) => s.completedCount);
  const progressed = counts.some((c, i) => i > 0 && c > counts[i - 1]);
  const order = [];
  for (const s of snapshots) {
    for (const t of s.todos)
      if (!order.includes(t.id))
        order.push(t.id);
  }
  const firstDone = /* @__PURE__ */ new Map();
  snapshots.forEach((s, idx) => {
    for (const t of s.todos) {
      if (t.done && !firstDone.has(t.id))
        firstDone.set(t.id, idx);
    }
  });
  const batches = order.map((id) => firstDone.get(id) ?? Number.POSITIVE_INFINITY);
  const inOrder = batches.every((b, i) => i === 0 || b >= batches[i - 1]);
  return {
    hasTodoTool: true,
    maxSteps,
    snapshots: snapshots.length,
    finalCompleted,
    decomposed: maxSteps >= opts.minSteps,
    progressed: snapshots.length >= opts.minSnapshots && progressed && finalCompleted >= opts.minCompleted,
    inOrder
  };
}
var DONE, DOING;
var init_todo_plan = __esm({
  "../../packages/analyzer/dist/shared/todo-plan.js"() {
    "use strict";
    DONE = /^(completed|complete|done|finished|success)/i;
    DOING = /^(in_progress|inprogress|in-progress|doing|active|started)/i;
  }
});

// ../../packages/analyzer/dist/metrics/gen-staged.js
async function genStaged(ctx, node) {
  const id = node.id;
  const gd = ctx.gitDiff;
  if (!gd.available || !gd.files) {
    return degradedR(ctx, id, "git diff \u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u5224\u5B9A\u6539\u52A8\u89C4\u6A21");
  }
  const totalLines = gd.files.reduce((s, f) => s + f.added + f.deleted, 0);
  const threshold = ctx.config.diff.largeChangeThreshold;
  const cfg = ctx.config.stagedPlan;
  const scaleNote = {
    kind: "note",
    text: `\u6539\u52A8\u89C4\u6A21 ${totalLines} \u884C\uFF08\u9608\u503C ${threshold}\uFF09`
  };
  if (totalLines <= threshold) {
    return okR(id, 100, `\u6539\u52A8 ${totalLines} \u884C \u2264 \u9608\u503C ${threshold}\uFF0C\u4E0D\u9002\u7528\u5206\u9636\u6BB5\u8981\u6C42`, [
      scaleNote
    ]);
  }
  const snapshots = extractTodoSnapshots(ctx.behaviors, cfg.todoTools);
  const sig = analyzeStagedPlan(snapshots, cfg);
  if (sig.hasTodoTool) {
    const passed = sig.decomposed && sig.progressed;
    const evidence = [
      scaleNote,
      {
        kind: "note",
        text: `TODO \u8F68\u8FF9\uFF1A${sig.snapshots} \u6B21\u66F4\u65B0\uFF0C\u6700\u591A\u62C6 ${sig.maxSteps} \u6B65\uFF0C\u6700\u7EC8\u5B8C\u6210 ${sig.finalCompleted} \u6B65${sig.inOrder ? "\uFF08\u6309\u5217\u8868\u987A\u5E8F\u63A8\u8FDB\uFF09" : ""}`
      },
      ...snapshots.slice(0, 3).map((s) => ({
        kind: "behavior",
        ids: [s.behaviorId],
        label: `TODO \u66F4\u65B0\uFF1A${s.todos.filter((t) => t.done).length}/${s.todos.length} \u6B65\u5B8C\u6210`
      }))
    ];
    return okR(id, passed ? 100 : 0, passed ? `\u5927\u6539\u52A8\u62C6\u89E3\u4E3A ${sig.maxSteps} \u6B65\uFF0C\u5E76\u5206\u6279\u63A8\u8FDB\u5B8C\u6210 ${sig.finalCompleted} \u6B65` : `\u672A\u8FBE\u5206\u9636\u6BB5\u65BD\u884C\uFF1A\u62C6\u89E3 ${sig.maxSteps} \u6B65 / \u66F4\u65B0 ${sig.snapshots} \u6279 / \u5B8C\u6210 ${sig.finalCompleted} \u6B65\uFF08\u8981\u6C42\u62C6 \u2265${cfg.minSteps} \u6B65\uFF0C\u4E14\u5206\u6279\u5B8C\u6210 \u2265${cfg.minCompleted} \u6B65\uFF09`, evidence);
  }
  if (hasPlanSteps(ctx)) {
    return degradedR(ctx, id, "AI \u8F93\u51FA\u4E86\u5206\u6B65\u8BA1\u5212\uFF0C\u4F46\u672A\u89C2\u6D4B\u5230 TODO \u63A8\u8FDB\u8F68\u8FF9\uFF0C\u65E0\u6CD5\u786E\u8BA4\u662F\u5426\u6309\u6B65\u9AA4\u65BD\u884C", [scaleNote]);
  }
  return okR(id, 0, `\u5927\u6539\u52A8\uFF08${totalLines} \u884C\uFF09\u672A\u89C1\u4EFB\u52A1\u62C6\u89E3\u4E0E\u5206\u6B65\u65BD\u884C\u8BC1\u636E`, [
    scaleNote,
    { kind: "note", text: "\u65E0 TODO/\u8BA1\u5212\u7C7B\u5DE5\u5177\u8C03\u7528\uFF0C\u5BF9\u8BDD\u4E2D\u4E5F\u672A\u68C0\u51FA\u5206\u6B65\u8BA1\u5212" }
  ]);
}
function hasPlanSteps(ctx) {
  for (const b of ctx.behaviors) {
    if (b.action !== "agent.message")
      continue;
    const text = String(b.context?.promptText ?? b.context?.output ?? "");
    if ((text.match(STEP_PATTERN) ?? []).length >= 2)
      return true;
  }
  return false;
}
var STEP_PATTERN;
var init_gen_staged = __esm({
  "../../packages/analyzer/dist/metrics/gen-staged.js"() {
    "use strict";
    init_helpers();
    init_todo_plan();
    STEP_PATTERN = /(?:(?:^|\n)\s*(?:#{1,6}\s*)?(?:步骤|阶段|Step|Phase)\s*[0-9一二三四五六七八九十]+)|(?:(?:^|\n)\s*[-*]\s*\[[ xX]\])|(?:(?:^|\n)\s*[0-9]+[.、)]\s+\S)/g;
  }
});

// ../../packages/analyzer/dist/metrics/gen-plan-first.js
async function genPlanFirst(ctx, node) {
  const id = node.id;
  const bs = ctx.behaviors;
  const dwell = ctx.config.planReview.dwellMs;
  const planMsgs = bs.filter((b) => b.action === "agent.message" && PLAN_PATTERN.test(String(b.context?.promptText ?? b.context?.output ?? "")) || b.action === "agent.tool" && PLAN_TOOLS.test(String(b.context?.toolName ?? ""))).sort((a, b) => a.ts - b.ts);
  if (planMsgs.length === 0) {
    return okR(id, 0, "\u672A\u68C0\u51FA AI \u8F93\u51FA\u7684\u8BA1\u5212/\u6B65\u9AA4\uFF0C\u76F4\u63A5\u8FDB\u5165\u751F\u6210");
  }
  const planEndTs = planMsgs[planMsgs.length - 1].ts;
  const nextAction = bs.filter((b) => b.ts >= planEndTs && (b.action === "accept" || b.action === "prompt.submit")).sort((a, b) => a.ts - b.ts)[0];
  if (!nextAction) {
    return okR(id, 0, "\u8BA1\u5212\u8F93\u51FA\u540E\u65E0\u540E\u7EED\u52A8\u4F5C\uFF08\u65E0 Accept \u4E5F\u65E0 Prompt\uFF09\uFF0C\u65E0\u6CD5\u5224\u5B9A\u662F\u5426\u5BA1\u9605", [{ kind: "behavior", ids: [planMsgs[planMsgs.length - 1].id], label: "\u8BA1\u5212\u8F93\u51FA" }]);
  }
  const gap = nextAction.ts - planEndTs;
  const evidence = [
    { kind: "behavior", ids: [planMsgs[planMsgs.length - 1].id], label: "AI \u8BA1\u5212\u8F93\u51FA" },
    { kind: "behavior", ids: [nextAction.id], label: "\u8BA1\u5212\u540E\u7684\u9996\u4E2A Dev \u52A8\u4F5C" },
    { kind: "note", text: `\u95F4\u9694 ${(gap / 1e3).toFixed(1)}s\uFF08\u9608\u503C ${dwell / 1e3}s\uFF09` }
  ];
  return okR(id, gap >= dwell ? 100 : 0, gap >= dwell ? `\u8BA1\u5212\u540E\u505C\u7559 ${(gap / 1e3).toFixed(1)}s \u624D\u6388\u6743\uFF0C\u89C6\u4E3A\u5BA1\u9605\u4E86\u8BA1\u5212` : `\u8BA1\u5212\u540E\u4EC5 ${(gap / 1e3).toFixed(1)}s \u5373\u6388\u6743\uFF0C\u672A\u8FBE\u5BA1\u9605\u9608\u503C`, evidence);
}
var PLAN_PATTERN, PLAN_TOOLS;
var init_gen_plan_first = __esm({
  "../../packages/analyzer/dist/metrics/gen-plan-first.js"() {
    "use strict";
    init_helpers();
    PLAN_PATTERN = /(计划|方案|步骤|里程碑|plan\b|step\s*1|以下(是|为).{0,6}(步骤|计划))/i;
    PLAN_TOOLS = /^(todo|plan|todo_write|write_plan|create_plan)/i;
  }
});

// ../../packages/analyzer/dist/metrics/gen-accept-lines.js
async function genAcceptLines(ctx, node) {
  const id = node.id;
  const accepts = ctx.behaviors.filter((b) => b.action === "accept");
  if (accepts.length === 0) {
    return degradedR(ctx, id, "\u65E0 userAccept \u4E8B\u4EF6\uFF0C\u65E0\u6CD5\u7EDF\u8BA1\u5355\u6B21\u63A5\u53D7\u884C\u6570");
  }
  const evidence = [];
  let maxLines = 0;
  let missing = 0;
  for (const b of accepts) {
    const ds = b.context?.diffStats;
    const added = Number(ds?.added ?? NaN);
    const deleted = Number(ds?.deleted ?? NaN);
    if (!Number.isFinite(added) || !Number.isFinite(deleted)) {
      missing++;
      continue;
    }
    const lines = added + deleted;
    maxLines = Math.max(maxLines, lines);
    evidence.push({
      kind: "behavior",
      ids: [b.id],
      label: `Accept\uFF1A+${added} / \u2212${deleted} = ${lines} \u884C`
    });
  }
  if (missing > 0 && maxLines === 0) {
    return degradedR(ctx, id, `${missing}/${accepts.length} \u6B21 Accept \u7F3A diffStats\uFF08\u884C\u6570\u8865\u9F50\u5931\u8D25\uFF09`);
  }
  const max = ctx.config.diff.acceptMaxLines;
  return okR(id, normNumber(maxLines, max, 0, false), `\u5355\u6B21\u6700\u5927 Accept ${maxLines} \u884C\uFF08\u9608\u503C ${max}\uFF09${missing > 0 ? `\uFF0C\u53E6\u6709 ${missing} \u6B21\u7F3A\u884C\u6570` : ""}`, evidence.slice(0, 10));
}
var init_gen_accept_lines = __esm({
  "../../packages/analyzer/dist/metrics/gen-accept-lines.js"() {
    "use strict";
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/gen-alignment.js
async function genAlignment(ctx, node) {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0)
    return excludedR(id, "\u65E0 SPEC \u6587\u6863\uFF0C\u65E0\u6CD5\u8BC4\u4F30\u5BF9\u9F50\u5EA6");
  const m = await ctx.rtm();
  const tasks = ctx.tasks();
  if (tasks.length === 0)
    return excludedR(id, "\u65E0 Task \u6570\u636E");
  const taskToSpec = /* @__PURE__ */ new Map();
  for (const [specId, tids] of Object.entries(m.specToTask)) {
    for (const t of tids)
      taskToSpec.set(t, specId);
  }
  const targets = tasks.filter((t) => taskToSpec.has(t.id));
  if (targets.length === 0)
    return excludedR(id, "\u6CA1\u6709 Task \u88AB\u6620\u5C04\u5230 SPEC \u6761\u76EE");
  const payload = targets.map((t) => ({
    taskId: t.id,
    desc: t.desc ?? t.behaviorSummary,
    files: t.files.map((f) => f.uri).slice(0, 8),
    lines: t.files.reduce((s, f) => s + (f.touchedLines ?? 0), 0),
    specText: (m.specItems.find((s) => s.id === taskToSpec.get(t.id))?.text ?? "").slice(0, 600)
  }));
  const r = await llmJson(ctx.llm, {
    metricId: "gen-alignment",
    templateId: "gen-alignment-v1",
    system: SYS4,
    user: JSON.stringify(payload),
    schema: { type: "object", required: ["items"] }
  });
  ctx.stats.llmCalls++;
  if (!r.ok || !r.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r);
  }
  const judged = asArray(r.data.items);
  let sumW = 0;
  let sumWS = 0;
  const evidence = [];
  for (const j of judged) {
    const t = targets.find((x) => x.id === j?.taskId);
    if (!t)
      continue;
    const w = Math.max(1, t.files.reduce((s, f) => s + (f.touchedLines ?? 0), 0));
    const a = clamp01to100(Number(j?.alignment ?? 0));
    sumW += w;
    sumWS += w * a;
    evidence.push({
      kind: "llm",
      templateId: "gen-alignment-v1",
      rationale: `${t.id} \u5BF9\u9F50 ${a}${j?.deviation ? `\uFF1B\u504F\u5DEE\uFF1A${String(j.deviation).slice(0, 80)}` : ""}`
    });
  }
  if (sumW === 0)
    return excludedR(id, "\u5BF9\u9F50\u5224\u5B9A\u65E0\u6709\u6548\u7ED3\u679C");
  return okR(id, Number((sumWS / sumW).toFixed(2)), `${judged.length} \u4E2A Task \u7684\u52A0\u6743\u5BF9\u9F50\u5EA6`, evidence);
}
var SYS4;
var init_gen_alignment = __esm({
  "../../packages/analyzer/dist/metrics/gen-alignment.js"() {
    "use strict";
    init_llm_json();
    init_helpers();
    SYS4 = `\u4F60\u662F\u4EE3\u7801\u8BC4\u5BA1\u52A9\u624B\u3002\u7ED9\u5B9A\u82E5\u5E72"\u5DE5\u4F5C\u7247\u6BB5"\u7684\u76EE\u6807\u63CF\u8FF0\u4E0E\u5B83\u5B9E\u9645\u6539\u52A8\u7684\u6587\u4EF6/\u884C\u6570\u91CF\uFF0C
\u5BF9\u7167\u76F8\u5E94\u7684 SPEC \u6761\u76EE\uFF0C\u5224\u65AD\u5B9E\u73B0\u4E0E\u9700\u6C42\u662F\u5426\u5BF9\u9F50\u3002
alignment \u4E3A 0\u2013100\uFF08100=\u5B8C\u5168\u5BF9\u9F50\uFF09\uFF0Cdeviation \u8BF4\u660E\u504F\u5DEE\uFF08\u65E0\u5219\u7701\u7565\uFF09\u3002
\u4E25\u683C\u8F93\u51FA json\uFF1A{"items":[{"taskId":"T1","alignment":90,"deviation":"..."}]}`;
  }
});

// ../../packages/analyzer/dist/metrics/gen-verify-read-pr.js
async function genVerifyReadPr(ctx, node) {
  const id = node.id;
  const cd = ctx.coreDiff();
  if (cd.totalCoreNew === 0)
    return okR(id, 0, "\u65E0\u6838\u5FC3\u65B0\u589E\u884C");
  const idx = ctx.reading();
  const hasCursor = ctx.behaviors.some((b) => b.action === "cursor");
  if (!idx.scrollAvailable && !hasCursor) {
    return degradedR(ctx, id, "\u65E0\u6EDA\u52A8\u4E0E\u5149\u6807\u4E8B\u4EF6\uFF0C\u91C7\u96C6\u5F02\u5E38");
  }
  if (!idx.scrollAvailable) {
    return degradedR(ctx, id, "\u65E0 viewport \u4E8B\u4EF6\uFF0C\u4EC5\u80FD\u4EE5\u5149\u6807\u7A97\u8FD1\u4F3C");
  }
  let read = 0;
  let total = 0;
  const evidence = [];
  for (const [uri, info] of Object.entries(cd.files)) {
    const core = new Set(info.coreNewLines);
    if (core.size === 0)
      continue;
    total += core.size;
    const t = traceOf(idx, uri);
    const hit = t.readLines.filter((l) => core.has(l));
    read += hit.length;
    evidence.push({
      kind: "file",
      uris: [uri],
      lines: hit.slice(0, 40),
      label: `${uri}\uFF1A\u5DF2\u8BFB ${hit.length}/${core.size} \u884C`
    });
  }
  if (total === 0)
    return okR(id, 0, "\u65E0\u6838\u5FC3\u65B0\u589E\u884C");
  return okR(id, pct(read / total), `\u6838\u5FC3\u65B0\u589E\u884C\u5DF2\u8BFB ${read}/${total}`, evidence.slice(0, 8));
}
var init_gen_verify_read_pr = __esm({
  "../../packages/analyzer/dist/metrics/gen-verify-read-pr.js"() {
    "use strict";
    init_helpers();
    init_reading();
  }
});

// ../../packages/analyzer/dist/metrics/gen-verify-edit-pe.js
async function genVerifyEditPe(ctx, node) {
  const id = node.id;
  const cd = ctx.coreDiff();
  if (cd.totalCoreNew === 0)
    return okR(id, 0, "\u65E0\u6838\u5FC3\u65B0\u589E\u884C");
  const hasEdit = ctx.behaviors.some((b) => b.action === "edit");
  if (!hasEdit) {
    return degradedR(ctx, id, "\u65E0\u7F16\u8F91\u4E8B\u4EF6\uFF0C\u65E0\u6CD5\u5224\u5B9A\u662F\u5426\u4FEE\u6539\u8FC7 AI \u4EA7\u7269");
  }
  let edited = 0;
  let total = 0;
  const evidence = [];
  for (const [uri, info] of Object.entries(cd.files)) {
    total += info.coreNewLines.length;
  }
  for (const [uri, lines] of Object.entries(cd.devEditedLines)) {
    edited += lines.length;
    evidence.push({ kind: "file", uris: [uri], lines: lines.slice(0, 40), label: `${uri}\uFF1ADev \u7F16\u8F91 ${lines.length} \u884C` });
  }
  if (total === 0)
    return okR(id, 0, "\u65E0\u6838\u5FC3\u65B0\u589E\u884C");
  return okR(id, pct(edited / total), `\u6838\u5FC3\u65B0\u589E\u884C\u4E2D\u88AB Dev \u4EB2\u624B\u4FEE\u6539 ${edited}/${total} \u884C`, evidence.slice(0, 8));
}
var init_gen_verify_edit_pe = __esm({
  "../../packages/analyzer/dist/metrics/gen-verify-edit-pe.js"() {
    "use strict";
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/gen-verify-cursor-nc.js
async function genVerifyCursorNc(ctx, node) {
  const id = node.id;
  const cd = ctx.coreDiff();
  if (cd.totalCoreNew === 0)
    return okR(id, 0, "\u65E0\u6838\u5FC3\u65B0\u589E\u884C");
  const hasCursor = ctx.behaviors.some((b) => b.action === "cursor");
  if (!hasCursor)
    return degradedR(ctx, id, "\u65E0\u5149\u6807\u4E8B\u4EF6");
  const idx = ctx.reading();
  let hitCount = 0;
  let total = 0;
  const evidence = [];
  for (const [uri, info] of Object.entries(cd.files)) {
    const core = new Set(info.coreNewLines);
    if (core.size === 0)
      continue;
    total += core.size;
    const t = traceOf(idx, uri);
    const hit = t.cursorLines.filter((l) => core.has(l));
    hitCount += hit.length;
    evidence.push({
      kind: "file",
      uris: [uri],
      lines: hit.slice(0, 40),
      label: `${uri}\uFF1A\u5149\u6807\u505C\u7559 ${hit.length}/${core.size} \u884C`
    });
  }
  if (total === 0)
    return okR(id, 0, "\u65E0\u6838\u5FC3\u65B0\u589E\u884C");
  return okR(id, pct(hitCount / total), `\u6838\u5FC3\u65B0\u589E\u884C\u6709\u5149\u6807\u505C\u7559 ${hitCount}/${total}`, evidence.slice(0, 8));
}
var init_gen_verify_cursor_nc = __esm({
  "../../packages/analyzer/dist/metrics/gen-verify-cursor-nc.js"() {
    "use strict";
    init_helpers();
    init_reading();
  }
});

// ../../packages/analyzer/dist/metrics/test-dev-trigger.js
async function testDevTrigger(ctx, node) {
  const id = node.id;
  const runs = ctx.testRuns();
  const devRuns = runs.filter((r) => r.actor === "dev");
  const evidence = devRuns.slice(0, 8).map((r) => ({
    kind: "testrun",
    ids: [r.behaviorId],
    label: `Dev \u89E6\u53D1\uFF1A${r.cmd}\uFF08exit=${r.exitCode ?? "?"}\uFF09`
  }));
  if (devRuns.length === 0) {
    const aiRuns = runs.filter((r) => r.actor === "ai");
    return okR(id, 0, aiRuns.length > 0 ? "\u6D4B\u8BD5\u5747\u7531 AI \u89E6\u53D1\uFF0CDev \u672A\u4EB2\u81EA\u8FD0\u884C" : "\u65E0\u6D4B\u8BD5\u8FD0\u884C\u8BB0\u5F55", aiRuns.slice(0, 5).map((r) => ({
      kind: "testrun",
      ids: [r.behaviorId],
      label: `AI \u89E6\u53D1\uFF1A${r.cmd}`
    })));
  }
  return okR(id, 100, `Dev \u4EB2\u81EA\u89E6\u53D1 ${devRuns.length} \u6B21\u6D4B\u8BD5\u8FD0\u884C`, evidence);
}
var init_test_dev_trigger = __esm({
  "../../packages/analyzer/dist/metrics/test-dev-trigger.js"() {
    "use strict";
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/test-pass-rate.js
async function testPassRate(ctx, node) {
  const id = node.id;
  const runs = ctx.testRuns();
  if (runs.length === 0)
    return okR(id, 0, "\u65E0\u6D4B\u8BD5\u8FD0\u884C");
  const last = [...runs].sort((a, b) => b.ts - a.ts)[0];
  const evidence = [
    {
      kind: "testrun",
      ids: [last.behaviorId],
      label: `${last.cmd}\uFF1Apassed=${last.passed ?? "?"} failed=${last.failed ?? "?"} total=${last.total ?? "?"} exit=${last.exitCode ?? "?"}`
    }
  ];
  if (last.parseOk && last.total != null && last.total > 0) {
    return okR(id, pct((last.passed ?? 0) / last.total), `\u6700\u7EC8\u4E00\u6B21\u8FD0\u884C\uFF1A${last.passed}/${last.total} \u901A\u8FC7`, evidence);
  }
  if (last.exitCode != null) {
    return {
      id,
      status: "degraded",
      score: last.exitCode === 0 ? 100 : 0,
      weight: 1,
      detail: `\u672A\u80FD\u89E3\u6790\u7528\u4F8B\u8BA1\u6570\uFF0C\u6309 exitCode=${last.exitCode} \u7C97\u5224\uFF08\u7ED3\u679C\u4E0D\u53EF\u9760\uFF09`,
      evidence
    };
  }
  return degradedR(ctx, id, "\u6700\u7EC8\u4E00\u6B21\u8FD0\u884C\u65E0\u7528\u4F8B\u8BA1\u6570\u4E5F\u65E0 exitCode", evidence);
}
var init_test_pass_rate = __esm({
  "../../packages/analyzer/dist/metrics/test-pass-rate.js"() {
    "use strict";
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/test-review-failure.js
async function testReviewFailure(ctx, node) {
  const id = node.id;
  const runs = ctx.testRuns();
  const failures = runs.filter((r) => (r.failed ?? 0) > 0);
  if (failures.length === 0)
    return excludedR(id, "\u65E0\u5931\u8D25\u6D4B\u8BD5\u8FD0\u884C\uFF0C\u65E0\u5931\u8D25\u65E5\u5FD7\u53EF\u5BA1");
  const windowMs = ctx.config.test.failureReviewWindowMs;
  const lastFailTs = Math.max(...failures.map((r) => r.ts));
  const until = lastFailTs + windowMs;
  const evidence = [];
  let hit = false;
  for (const t of ctx.prompts()) {
    if (t.ts < lastFailTs || t.ts > until)
      continue;
    if (FAIL_DETAIL.test(t.promptText)) {
      hit = true;
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
  }
  const idx = ctx.reading();
  for (const uri of Object.keys(idx.byUri)) {
    if (!LOG_FILE.test(uri))
      continue;
    const t = traceOf(idx, uri);
    if (t.dwellMs > 0 || t.readLines.length > 0) {
      hit = true;
      evidence.push({
        kind: "file",
        uris: [uri],
        label: `\u9605\u8BFB\u4E86\u8F93\u51FA/\u62A5\u544A\u6587\u4EF6 ${uri}\uFF08\u505C\u7559 ${(t.dwellMs / 1e3).toFixed(1)}s\uFF09`
      });
    }
  }
  return okR(id, hit ? 100 : 0, hit ? `\u5931\u8D25\u8FD0\u884C\u540E\u68C0\u51FA ${evidence.length} \u5904\u5BA1\u9605\u8BC1\u636E` : "\u6709\u5931\u8D25\u8FD0\u884C\uFF0C\u4F46\u7A97\u53E3\u5185\u672A\u68C0\u51FA\u5BA1\u9605\u5931\u8D25\u65E5\u5FD7\u7684\u8BC1\u636E", evidence.slice(0, 6));
}
var FAIL_DETAIL, LOG_FILE;
var init_test_review_failure = __esm({
  "../../packages/analyzer/dist/metrics/test-review-failure.js"() {
    "use strict";
    init_helpers();
    init_reading();
    FAIL_DETAIL = /断言|assert|失败行|堆栈|stack\s*trace|期望.{0,10}实际|expected.{0,20}received|失败.{0,6}第?\s*\d+\s*行/i;
    LOG_FILE = /\.(log)$|test-output|report|\/target\//i;
  }
});

// ../../packages/analyzer/dist/metrics/fix-issue-quality.js
async function fixIssueQuality(ctx, node) {
  const id = node.id;
  const fixTurns = ctx.prompts().filter((t) => ctx.tasks().some((task) => task.stage === "ai-fix"));
  const pool = fixTurns.length > 0 ? fixTurns : ctx.prompts();
  if (pool.length === 0)
    return degradedR(ctx, id, "\u65E0 Dev Prompt \u4E8B\u4EF6");
  const r = await llmJson(ctx.llm, {
    metricId: "fix-issue-quality",
    templateId: "fix-issue-quality-v1",
    system: SYS5,
    user: JSON.stringify(pool.slice(0, 30).map((t) => ({ promptId: t.id, text: t.promptText.slice(0, 800) }))),
    schema: { type: "object", required: ["items"] }
  });
  ctx.stats.llmCalls++;
  if (!r.ok || !r.data) {
    ctx.stats.llmFallback++;
    if (r.unavailable)
      return llmFail(ctx, id, r);
    let best2 = 0;
    for (const t of pool) {
      if (RULE_REPRO.test(t.promptText))
        best2 = Math.max(best2, 2);
      else if (RULE_GUESS.test(t.promptText))
        best2 = Math.max(best2, 1);
    }
    return {
      id,
      status: "degraded",
      score: ordinal(ctx, "threeTier", best2),
      weight: 1,
      detail: `LLM \u5224\u5B9A\u5931\u8D25\uFF0C\u6309\u5173\u952E\u8BCD\u89C4\u5219\u964D\u7EA7\uFF1A${r.rationale}`,
      evidence: []
    };
  }
  let best = 0;
  const evidence = [];
  for (const it of asArray(r.data.items)) {
    const tier = it?.hasReproSteps && it?.hasRootCauseHypothesis ? 2 : it?.hasGuessOrCode || it?.pastedLogOnly ? 1 : 0;
    best = Math.max(best, tier);
    evidence.push({
      kind: "llm",
      templateId: "fix-issue-quality-v1",
      rationale: `\u590D\u73B0=${it?.hasReproSteps ? "\u6709" : "\u65E0"} \u6839\u56E0\u5047\u8BBE=${it?.hasRootCauseHypothesis ? "\u6709" : "\u65E0"} \u2192 \u6863 ${tier}`
    });
  }
  return okR(id, ordinal(ctx, "threeTier", best), `\u4FEE\u590D\u53CD\u9988\u7684\u6700\u9AD8\u6863\u4E3A ${["\u4EC5\u8D34\u95EE\u9898", "\u731C\u6D4B/\u4EE3\u7801", "\u590D\u73B0+\u5047\u8BBE"][best]}`, evidence.slice(0, 8));
}
var SYS5, RULE_REPRO, RULE_GUESS;
var init_fix_issue_quality = __esm({
  "../../packages/analyzer/dist/metrics/fix-issue-quality.js"() {
    "use strict";
    init_llm_json();
    init_helpers();
    SYS5 = `\u4F60\u662F\u5BF9\u8BDD\u8D28\u91CF\u5206\u6790\u52A9\u624B\u3002\u5BF9\u6BCF\u6761"\u53CD\u9988\u95EE\u9898"\u7684\u5F00\u53D1\u8005\u53D1\u8A00\uFF0C\u5224\u65AD\u5B83\u5305\u542B\u54EA\u4E9B\u5143\u7D20\uFF1A
hasReproSteps=\u662F\u5426\u63CF\u8FF0\u4E86\u53EF\u590D\u73B0\u7684\u6B65\u9AA4\uFF1BhasRootCauseHypothesis=\u662F\u5426\u7ED9\u51FA\u4E86\u539F\u56E0\u5047\u8BBE\uFF1B
hasGuessOrCode=\u662F\u5426\u53EA\u662F\u731C\u6D4B\u6216\u8D34\u4E86\u4EE3\u7801\u7247\u6BB5\uFF1BpastedLogOnly=\u662F\u5426\u53EA\u662F\u8D34\u4E86\u65E5\u5FD7/\u62A5\u9519\u3002
\u4E25\u683C\u8F93\u51FA json\uFF1A{"items":[{"promptId":"p1","hasReproSteps":true,"hasRootCauseHypothesis":false,"hasGuessOrCode":false,"pastedLogOnly":false}]}`;
    RULE_REPRO = /(复现|重现|步骤[:：]|第一步|1\.\s*\w|如何触发|steps?\s+to\s+reproduce)/i;
    RULE_GUESS = /(可能|猜测|也许是|大概是|估计是|疑似|maybe|probably|i\s+guess)/i;
  }
});

// ../../packages/analyzer/dist/metrics/fix-repro-case.js
async function fixReproCase(ctx, node) {
  const id = node.id;
  const evidence = [];
  let hit = false;
  for (const b of ctx.behaviors) {
    if (b.action !== "edit" || b.actor !== "dev")
      continue;
    const uri = b.object?.kind === "file" ? b.object.uri : void 0;
    if (uri && isTestUri(uri)) {
      hit = true;
      evidence.push({ kind: "file", uris: [uri], label: "Dev \u7F16\u8F91\u4E86\u6D4B\u8BD5\u6587\u4EF6" });
      break;
    }
  }
  for (const t of ctx.prompts()) {
    if (REPRO_PATTERN.test(t.promptText)) {
      hit = true;
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
      break;
    }
  }
  return okR(id, hit ? 100 : 0, hit ? "\u68C0\u51FA\u590D\u73B0\u6B65\u9AA4\u6216\u9488\u5BF9\u5931\u8D25\u70B9\u7684\u6D4B\u8BD5\u7528\u4F8B" : "\u672A\u68C0\u51FA\u590D\u73B0\u6B65\u9AA4/\u5931\u8D25\u7528\u4F8B", evidence.slice(0, 5));
}
var REPRO_PATTERN;
var init_fix_repro_case = __esm({
  "../../packages/analyzer/dist/metrics/fix-repro-case.js"() {
    "use strict";
    init_helpers();
    init_spec_docs();
    REPRO_PATTERN = /(复现|重现)(步骤|方法|方式)?[:：]|如何触发|steps?\s+to\s+reproduce|最小复现|复现代码|测试用例[:：]/i;
  }
});

// ../../packages/analyzer/dist/metrics/fix-root-cause.js
async function fixRootCause(ctx, node) {
  const id = node.id;
  const fixFiles = /* @__PURE__ */ new Set();
  for (const t of ctx.tasks()) {
    const isFix = t.stage === "ai-fix" || t.spans.some((s) => s.stage === "ai-fix");
    if (isFix)
      for (const f of t.files)
        fixFiles.add(f.uri);
  }
  if (fixFiles.size === 0) {
    for (const uri of Object.keys(ctx.coreDiff().aiLines))
      fixFiles.add(uri);
  }
  const idx = ctx.reading();
  let reviewed = false;
  const evidence = [];
  for (const uri of fixFiles) {
    const t = traceOf(idx, uri);
    if (t.dwellMs > 0 || t.readLines.length > 0) {
      reviewed = true;
      evidence.push({
        kind: "file",
        uris: [uri],
        lines: t.readLines.slice(0, 30),
        label: `\u5BA1\u9605\u4FEE\u590D\u6587\u4EF6 ${uri}\uFF08\u505C\u7559 ${(t.dwellMs / 1e3).toFixed(1)}s\uFF09`
      });
    }
  }
  if (!reviewed) {
    return okR(id, ordinal(ctx, "threeTier", 0), "\u4FEE\u590D\u4EA7\u7269\u672A\u88AB\u5BA1\u9605", evidence);
  }
  const discussed = ctx.prompts().filter((t) => ROOT_CAUSE.test(t.promptText));
  if (discussed.length > 0) {
    for (const t of discussed.slice(0, 3)) {
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
    return okR(id, ordinal(ctx, "threeTier", 2), "\u5BA1\u9605\u4E86\u4FEE\u590D Diff \u5E76\u8BA8\u8BBA\u4E86\u6839\u56E0", evidence);
  }
  return okR(id, ordinal(ctx, "threeTier", 1), "\u6D4F\u89C8\u4E86\u4FEE\u590D Diff\uFF0C\u4F46\u672A\u533A\u5206\u6839\u56E0\u4E0E\u75C7\u72B6", evidence);
}
var ROOT_CAUSE;
var init_fix_root_cause = __esm({
  "../../packages/analyzer/dist/metrics/fix-root-cause.js"() {
    "use strict";
    init_helpers();
    init_reading();
    ROOT_CAUSE = /根因|根本原因|治标不治本|绕过|只是.{0,6}(补丁|patch)|root\s*cause|workaround|治本/i;
  }
});

// ../../packages/analyzer/dist/metrics/manual-pass-rate.js
async function manualPassRate(ctx, node) {
  const id = node.id;
  const turns = ctx.prompts();
  if (turns.length === 0)
    return noEvidenceR(id, "\u65E0 Dev Prompt \u4E8B\u4EF6\uFF0C\u65E0\u6CD5\u68C0\u6D4B\u4EBA\u5DE5\u6D4B\u8BD5");
  const cfg = ctx.config.manualTest;
  const tailCount = Math.max(cfg.minPrompts, Math.ceil(turns.length * cfg.tailWindowRatio));
  const tail = turns.slice(-tailCount);
  const r = await llmJson(ctx.llm, {
    metricId: "manual-pass-rate",
    templateId: "manual-pass-rate-v1",
    system: SYS6,
    user: JSON.stringify(tail.map((t) => ({ promptId: t.id, text: t.promptText.slice(0, 800) }))),
    schema: { type: "object", required: ["detected"] }
  });
  ctx.stats.llmCalls++;
  if (!r.ok || !r.data) {
    ctx.stats.llmFallback++;
    return llmFail(ctx, id, r);
  }
  if (!r.data.detected) {
    return noEvidenceR(id, "\u672A\u68C0\u6D4B\u5230\u4EBA\u5DE5\u6D4B\u8BD5\u8BC1\u636E\uFF0C\u4E0D\u53C2\u4E0E\u8BA1\u7B97");
  }
  const points = asArray(r.data.points);
  const pass = points.filter((p) => String(p?.verdict).toLowerCase() === "pass").length;
  const fail2 = points.length - pass;
  const evidence = points.slice(0, 8).map((p) => ({
    kind: "prompt",
    ids: [String(p?.promptId ?? "")],
    text: `[${p?.verdict ?? "?"}] ${String(p?.quote ?? "").slice(0, 200)}`
  }));
  if (pass + fail2 === 0)
    return noEvidenceR(id, "\u68C0\u6D4B\u5230\u4EBA\u5DE5\u6D4B\u8BD5\u4FE1\u53F7\u4F46\u65E0\u660E\u786E\u9A8C\u8BC1\u70B9");
  return okR(id, pct(pass / (pass + fail2)), `\u4EBA\u5DE5\u9A8C\u8BC1\u70B9\uFF1A\u901A\u8FC7 ${pass}\u3001\u5931\u8D25 ${fail2}`, evidence);
}
var SYS6;
var init_manual_pass_rate = __esm({
  "../../packages/analyzer/dist/metrics/manual-pass-rate.js"() {
    "use strict";
    init_llm_json();
    init_helpers();
    SYS6 = `\u4F60\u662F\u6D4B\u8BD5\u8FC7\u7A0B\u5206\u6790\u52A9\u624B\u3002\u5224\u65AD\u5F00\u53D1\u8005\u662F\u5426\u63CF\u8FF0\u4E86**\u4EBA\u5DE5/\u624B\u52A8\u6D4B\u8BD5**\u884C\u4E3A
\uFF08\u5982\u5728\u6D4F\u89C8\u5668\u91CC\u5B9E\u9645\u64CD\u4F5C\u3001\u624B\u52A8\u64AD\u653E\u9A8C\u8BC1\u3001\u70B9\u4E86\u67D0\u4E2A\u6309\u94AE\u770B\u6548\u679C\u3001\u624B\u52A8\u6784\u9020\u8F93\u5165\u8BD5\u4E86\u8BD5\uFF09\u3002
\u5BF9\u6BCF\u4E2A\u9A8C\u8BC1\u70B9\u7ED9\u51FA verdict\uFF1Apass=\u901A\u8FC7\uFF0Cfail=\u5931\u8D25\u3002
\u4E25\u683C\u8F93\u51FA json\uFF1A{"detected":true,"points":[{"verdict":"pass","quote":"...","promptId":"p1"}]}`;
  }
});

// ../../packages/analyzer/dist/metrics/manual-boundary.js
async function manualBoundary(ctx, node) {
  const id = node.id;
  const turns = ctx.prompts();
  const terminals = ctx.behaviors.filter((b) => b.action === "terminal.exec");
  if (turns.length === 0 && terminals.length === 0) {
    return degradedR(ctx, id, "\u65E0 Prompt \u4E0E\u7EC8\u7AEF\u4E8B\u4EF6");
  }
  const evidence = [];
  for (const t of turns) {
    if (PATTERNS2.some((p) => p.test(t.promptText))) {
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
  }
  return okR(id, evidence.length > 0 ? 100 : 0, evidence.length > 0 ? `\u68C0\u51FA ${evidence.length} \u5904\u8FB9\u754C/\u5F02\u5E38\u8865\u6D4B\u8981\u6C42` : "\u672A\u68C0\u51FA\u4E3B\u52A8\u6784\u9020\u8FB9\u754C/\u5F02\u5E38\u8865\u6D4B", evidence.slice(0, 5));
}
var PATTERNS2;
var init_manual_boundary = __esm({
  "../../packages/analyzer/dist/metrics/manual-boundary.js"() {
    "use strict";
    init_helpers();
    PATTERNS2 = [
      /边界/,
      /异常/,
      /极端/,
      /edge\s*case/i,
      /corner\s*case/i,
      /断网/,
      /空数据/,
      /超长输入/,
      /非法输入/,
      /越界/,
      /空文件/,
      /损坏文件/
    ];
  }
});

// ../../packages/analyzer/dist/metrics/review-decision.js
async function reviewDecision(ctx, node) {
  const id = node.id;
  const sessions = ctx.taskGraph.reviewSessions ?? [];
  if (sessions.length === 0)
    return excludedR(id, "\u65E0 Review \u4F1A\u8BDD\uFF0C\u4E0D\u5B58\u5728\u4FEE\u590D\u51B3\u7B56");
  const evidence = sessions.map((s) => ({
    kind: "note",
    text: `${s.id}\uFF1A${s.disposition ? `\u5904\u7F6E=${s.disposition}` : "\u65E0\u5904\u7F6E\u4FE1\u606F"}\uFF08${s.evidence.slice(0, 80)}\uFF09`
  }));
  const own = ctx.prompts().filter((t) => OWN_SOLUTION.test(t.promptText));
  if (own.length > 0) {
    for (const t of own.slice(0, 3)) {
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
    return okR(id, ordinal(ctx, "threeTier", 2), "\u68C0\u51FA Dev \u81EA\u62DF\u4FEE\u590D\u65B9\u6848", evidence);
  }
  const selective = sessions.some((s) => /selected|选择|部分/i.test(`${s.disposition ?? ""} ${s.evidence}`));
  if (selective) {
    return okR(id, ordinal(ctx, "threeTier", 1), "\u9009\u62E9\u6027\u91C7\u7EB3 Review \u610F\u89C1\u540E\u4FEE\u590D", evidence);
  }
  return okR(id, ordinal(ctx, "threeTier", 0), "\u6309 Review \u610F\u89C1\u5168\u76D8\u4FEE\u590D", evidence);
}
var OWN_SOLUTION;
var init_review_decision = __esm({
  "../../packages/analyzer/dist/metrics/review-decision.js"() {
    "use strict";
    init_helpers();
    OWN_SOLUTION = /(我(建议|认为|想|打算).{0,20}(改|修|实现|用))|(按我的.{0,6}(方案|思路))|我的方案|应该改为|改成.{0,10}而不是|不要.{0,8}直接/i;
  }
});

// ../../packages/analyzer/dist/metrics/review-rounds.js
async function reviewRounds(ctx, node) {
  const id = node.id;
  const sessions = ctx.taskGraph.reviewSessions ?? [];
  const rounds = sessions.length;
  const evidence = sessions.map((s) => ({
    kind: "note",
    text: `\u7B2C ${s.roundIndex} \u8F6E\uFF08${s.level}\uFF0C\u7F6E\u4FE1\u5EA6 ${s.confidence}\uFF09${s.disposition ? `\uFF0C\u5904\u7F6E=${s.disposition}` : ""}`
  }));
  const tier = rounds <= 0 ? 0 : rounds === 1 ? 1 : rounds === 2 ? 2 : 3;
  return okR(id, ordinal(ctx, "reviewRounds", tier), rounds === 0 ? "\u672C\u6B21 PR \u672A\u8FDB\u884C Review\uFF080 \u8F6E = 0 \u5206\uFF09" : `\u5171 ${rounds} \u8F6E Review`, evidence);
}
var init_review_rounds = __esm({
  "../../packages/analyzer/dist/metrics/review-rounds.js"() {
    "use strict";
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/review-disposition.js
async function reviewDisposition(ctx, node) {
  const id = node.id;
  const sessions = ctx.taskGraph.reviewSessions ?? [];
  if (sessions.length === 0)
    return excludedR(id, "\u65E0 Review \u4F1A\u8BDD\uFF0C\u65E0\u610F\u89C1\u53EF\u5904\u7F6E");
  const evidence = sessions.map((s) => ({
    kind: "note",
    text: `${s.id}\uFF08\u7B2C ${s.roundIndex} \u8F6E\uFF09\uFF1A${s.disposition ? `\u5904\u7F6E=${s.disposition}` : "\u65E0\u5904\u7F6E\u4FE1\u606F"}`
  }));
  const own = ctx.prompts().filter((t) => OWN_SOLUTION2.test(t.promptText));
  if (own.length > 0) {
    for (const t of own.slice(0, 3)) {
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
    return okR(id, ordinal(ctx, "threeTier", 2), "\u68C0\u51FA Dev \u81EA\u62DF\u65B9\u6848\u5904\u7F6E Review \u610F\u89C1", evidence);
  }
  const selected = sessions.filter((s) => /selected|选择|部分/i.test(`${s.disposition ?? ""} ${s.evidence}`));
  if (selected.length > 0) {
    return okR(id, ordinal(ctx, "threeTier", 1), `\u9009\u62E9\u6027\u91C7\u7EB3\uFF08${selected.length}/${sessions.length} \u8F6E\u4E3A\u9009\u62E9\u6027\u5904\u7F6E\uFF09`, evidence);
  }
  return okR(id, ordinal(ctx, "threeTier", 0), "\u5168\u76D8 Accept Review \u610F\u89C1", evidence);
}
var OWN_SOLUTION2;
var init_review_disposition = __esm({
  "../../packages/analyzer/dist/metrics/review-disposition.js"() {
    "use strict";
    init_helpers();
    OWN_SOLUTION2 = /(我(建议|认为|想|打算).{0,20}(改|修|实现|用))|(按我的.{0,6}(方案|思路))|我的方案|我自己改/i;
  }
});

// ../../packages/analyzer/dist/profile/types.js
function emptyProfile(now = /* @__PURE__ */ new Date()) {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    gitUser: null,
    techDomain: { keywords: [] },
    historyTasks: [],
    gitStats: null,
    syncState: { repos: {} }
  };
}
function todayStr(now = /* @__PURE__ */ new Date()) {
  return now.toISOString().slice(0, 10);
}
function kwNorm(name) {
  return String(name ?? "").trim().toLowerCase();
}
function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return null;
  const r = raw;
  const tech = r.techDomain ?? {};
  const keywords = Array.isArray(tech.keywords) ? tech.keywords : [];
  const tasks = Array.isArray(r.historyTasks) ? r.historyTasks : [];
  const sync = r.syncState ?? {};
  const gs = r.gitStats ?? null;
  return {
    version: 1,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : (/* @__PURE__ */ new Date()).toISOString(),
    gitUser: typeof r.gitUser === "string" ? r.gitUser : null,
    techDomain: {
      keywords: keywords.filter((k) => k && typeof k === "object").map((k) => {
        const e = k;
        return {
          name: String(e.name ?? "").trim(),
          // D-043 单轨：gitCommits 已废弃；旧文件按 0 处理（避免静默错用旧口径）
          gitLines: Number(e.gitLines ?? 0) || 0,
          lastSeen: typeof e.lastSeen === "string" ? e.lastSeen : "",
          source: ["local", "git", "merged"].includes(e.source) ? e.source : "local"
        };
      }).filter((k) => k.name)
    },
    historyTasks: tasks.filter((t) => t && typeof t === "object").map((t) => {
      const e = t;
      return {
        prId: String(e.prId ?? ""),
        ts: Number(e.ts ?? 0) || 0,
        repo: typeof e.repo === "string" ? e.repo : void 0,
        keywords: Array.isArray(e.keywords) ? e.keywords.map(String) : [],
        aiCollabLines: Number(e.aiCollabLines ?? 0) || 0,
        prCredit: Number(e.prCredit ?? 0) || 0,
        creditFingerprint: typeof e.creditFingerprint === "string" ? e.creditFingerprint : void 0,
        status: "committed",
        source: "local"
      };
    }).filter((t) => t.prId),
    gitStats: gs && Number(gs.totalPrCount ?? 0) >= 0 ? {
      totalPrCount: Number(gs.totalPrCount ?? 0) || 0,
      mergedPrCount: Number(gs.mergedPrCount ?? 0) || 0,
      reposContributed: Array.isArray(gs.reposContributed) ? gs.reposContributed.map(String) : [],
      lastSyncAt: typeof gs.lastSyncAt === "string" ? gs.lastSyncAt : ""
    } : null,
    syncState: {
      user: typeof sync.user === "string" ? sync.user : void 0,
      lastSyncAt: typeof sync.lastSyncAt === "string" ? sync.lastSyncAt : void 0,
      repos: sync.repos && typeof sync.repos === "object" && !Array.isArray(sync.repos) ? sync.repos : {}
    }
  };
}
function isInitialized(p) {
  if (!p)
    return false;
  return p.techDomain.keywords.length > 0 || p.historyTasks.length > 0;
}
function upsertHistoryTask(p, task, now = /* @__PURE__ */ new Date()) {
  const idx = p.historyTasks.findIndex((t) => t.prId === task.prId);
  if (idx >= 0) {
    const old = p.historyTasks[idx];
    if (old.creditFingerprint && task.creditFingerprint && old.creditFingerprint === task.creditFingerprint) {
      return { changed: false, reason: "skipped" };
    }
    p.historyTasks[idx] = { ...task };
    p.updatedAt = now.toISOString();
    return { changed: true, reason: "updated" };
  }
  p.historyTasks.push({ ...task });
  p.historyTasks.sort((a, b) => a.ts - b.ts);
  p.updatedAt = now.toISOString();
  return { changed: true, reason: "added" };
}
function ensureKeywordEntries(p, names, source, now = /* @__PURE__ */ new Date()) {
  const day = todayStr(now);
  const byKey = new Map(p.techDomain.keywords.map((k) => [kwNorm(k.name), k]));
  for (const raw of names) {
    const name = String(raw ?? "").trim();
    if (!name)
      continue;
    const key = kwNorm(name);
    const cur = byKey.get(key);
    if (cur) {
      cur.lastSeen = day;
      cur.source = cur.gitLines > 0 && source === "local" ? "merged" : source;
    } else {
      const entry = { name, gitLines: 0, lastSeen: day, source };
      p.techDomain.keywords.push(entry);
      byKey.set(key, entry);
    }
  }
  p.updatedAt = now.toISOString();
}
function localLinesOf(p, keywordName, excludePrId) {
  const key = kwNorm(keywordName);
  const seen = /* @__PURE__ */ new Set();
  let total = 0;
  for (const t of p.historyTasks) {
    if (excludePrId && t.prId === excludePrId)
      continue;
    if (seen.has(t.prId))
      continue;
    if (t.keywords.some((k) => kwNorm(k) === key)) {
      seen.add(t.prId);
      total += t.aiCollabLines;
    }
  }
  return total;
}
function matchedKeywords(p, currentKeywords) {
  const cur = new Set(currentKeywords.map(kwNorm).filter(Boolean));
  return p.techDomain.keywords.filter((k) => cur.has(kwNorm(k.name)));
}
function profileStamp(p, excludePrId) {
  if (!p)
    return "p:none";
  const others = p.historyTasks.filter((t) => t.prId !== excludePrId);
  const kw = p.techDomain.keywords.map((k) => `${kwNorm(k.name)}:${k.gitLines}`).sort().join(",");
  const gs = p.gitStats;
  const aiLines = others.reduce((a, t) => a + t.aiCollabLines, 0);
  const credits = others.reduce((a, t) => a + t.prCredit, 0);
  return `p:${p.gitUser ?? ""}|${gs ? `${gs.totalPrCount}/${gs.mergedPrCount}/${gs.lastSyncAt}` : "-"}|${kw}|n${others.length}:ai${aiLines}:c${credits}`;
}
function hasGitLines(p) {
  return p.techDomain.keywords.some((k) => k.gitLines > 0);
}
function mergeGitData(p, data, now = /* @__PURE__ */ new Date()) {
  const day = todayStr(now);
  const byKey = new Map(p.techDomain.keywords.map((k) => [kwNorm(k.name), k]));
  for (const { name, lines } of data.keywords) {
    const key = kwNorm(name);
    if (!key)
      continue;
    const inc = Math.max(0, Number(lines ?? 0) || 0);
    const cur = byKey.get(key);
    if (cur) {
      cur.gitLines += inc;
      cur.lastSeen = day;
      cur.source = cur.source === "local" ? "merged" : "git";
    } else {
      const entry = { name, gitLines: inc, lastSeen: day, source: "git" };
      p.techDomain.keywords.push(entry);
      byKey.set(key, entry);
    }
  }
  const prev = p.gitStats;
  p.gitStats = {
    totalPrCount: data.gitStats.totalPrCount,
    mergedPrCount: data.gitStats.mergedPrCount,
    reposContributed: [.../* @__PURE__ */ new Set([...prev?.reposContributed ?? [], ...data.gitStats.reposContributed])],
    lastSyncAt: now.toISOString()
  };
  for (const [repo, at] of Object.entries(data.repoCursors)) {
    if (at)
      p.syncState.repos[repo] = { lastCommitAt: at };
  }
  if (data.user)
    p.syncState.user = data.user;
  p.syncState.lastSyncAt = now.toISOString();
  p.gitUser = p.gitUser ?? data.user ?? null;
  p.updatedAt = now.toISOString();
}
var init_types4 = __esm({
  "../../packages/analyzer/dist/profile/types.js"() {
    "use strict";
  }
});

// ../../packages/analyzer/dist/metrics/dev-credit-profile-proficiency.js
function scoreOfLines(lines, scale, fullMark) {
  const L = Math.max(0, lines);
  if (scale === "linear")
    return Math.min(100, L / Math.max(1, fullMark) * 100);
  return Math.min(100, Math.log10(1 + L) / Math.log10(1 + Math.max(1, fullMark)) * 100);
}
async function devCreditProfileProficiency(ctx, node) {
  const id = node.id;
  const profile = ctx.profile;
  if (!profile)
    return excludedR(id, "\u65E0 Dev_Profile");
  const currentKeywords = await ctx.profileKeywords();
  if (currentKeywords.length === 0) {
    return degradedR(ctx, id, "\u5F53\u524D PR \u5173\u952E\u8BCD\u63D0\u53D6\u5931\u8D25\uFF08\u65E0 Task \u63CF\u8FF0\u4E14\u65E0 git diff\uFF09");
  }
  const matched = matchedKeywords(profile, currentKeywords);
  if (matched.length === 0) {
    return okR(id, 0, `\u5F53\u524D PR \u5173\u952E\u8BCD\uFF08${currentKeywords.slice(0, 3).join("\u3001")}\u2026\uFF09\u5728\u753B\u50CF\u4E2D\u65E0\u5386\u53F2\u8BB0\u5F55\uFF08\u65B0\u9886\u57DF\uFF09`, [
      { kind: "note", text: `\u753B\u50CF\u5173\u952E\u8BCD ${profile.techDomain.keywords.length} \u4E2A\uFF0C\u5339\u914D 0 \u4E2A` }
    ]);
  }
  const cfg = ctx.config.profile.proficiency;
  const useGit = hasGitLines(profile);
  const names = matched.map((k) => k.name);
  const lines = useGit ? matched.reduce((a, k) => a + k.gitLines, 0) : names.reduce((a, n) => a + localLinesOf(profile, n, ctx.prId), 0);
  const score = scoreOfLines(lines, cfg.scale, cfg.fullMarkLines);
  const source = useGit ? "git commit diff \u884C\u6570" : "\u672C\u5730 PR \u7684 AI \u534F\u4F5C\u884C\u6570\uFF08\u672A\u540C\u6B65 git\uFF09";
  return okR(id, score, `\u5339\u914D ${names.length} \u4E2A\u753B\u50CF\u5173\u952E\u8BCD\uFF1B\u7D2F\u8BA1 ${lines} \u884C\uFF08\u6765\u6E90\uFF1A${source}\uFF1B${cfg.scale === "log" ? "\u5BF9\u6570" : "\u7EBF\u6027"}\u6807\u5B9A\uFF0C\u6EE1 Mark ${cfg.fullMarkLines} \u884C\uFF09`, [
    {
      kind: "note",
      text: `\u5339\u914D\u8BCD\uFF1A${names.slice(0, 6).join("\u3001")}${names.length > 6 ? "\u2026" : ""}\uFF1B\u5F53\u524D PR \u5173\u952E\u8BCD\uFF1A${currentKeywords.slice(0, 6).join("\u3001")}`
    }
  ]);
}
var init_dev_credit_profile_proficiency = __esm({
  "../../packages/analyzer/dist/metrics/dev-credit-profile-proficiency.js"() {
    "use strict";
    init_types4();
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/dev-credit-profile-collab-lines.js
function tierIndex(total, tiers) {
  if (total > tiers[2])
    return 3;
  if (total > tiers[1])
    return 2;
  if (total > tiers[0])
    return 1;
  return 0;
}
async function devCreditProfileCollabLines(ctx, node) {
  const id = node.id;
  const profile = ctx.profile;
  if (!profile)
    return noEvidenceR(id, "\u65E0 Dev_Profile");
  const currentKeywords = await ctx.profileKeywords();
  const cur = new Set(currentKeywords.map(kwNorm).filter(Boolean));
  const subset = profile.historyTasks.filter((t) => t.prId !== ctx.prId && t.keywords.some((k) => cur.has(kwNorm(k))));
  if (subset.length > 0) {
    const total = subset.reduce((a, t) => a + t.aiCollabLines, 0);
    const idx = tierIndex(total, ctx.config.profile.collabTiers);
    return okR(id, ordinal(ctx, "collabLinesTier", idx), `\u4E3B\u57DF\u5339\u914D ${subset.length} \u6B21\u5386\u53F2 PR\uFF0C\u7D2F\u8BA1 AI \u534F\u4F5C ${total} \u884C \u2192 \u7B2C ${idx + 1} \u6863`, [{ kind: "note", text: `\u753B\u50CF\u5386\u53F2 PR \u5171 ${profile.historyTasks.length} \u6761` }]);
  }
  if (profile.historyTasks.length === 0) {
    const gitLines = matchedKeywords(profile, currentKeywords).reduce((a, k) => a + k.gitLines, 0);
    const idx = tierIndex(gitLines, ctx.config.profile.collabTiers);
    return okR(id, ordinal(ctx, "collabLinesTier", idx), `\u65E0\u672C\u5730\u5386\u53F2 PR\uFF0C\u6309 git \u884C\u6570 ${gitLines} \u884C\u5206\u6863 \u2192 \u7B2C ${idx + 1} \u6863`, [{ kind: "note", text: "AI \u534F\u4F5C\u884C\u6570\u4EC5\u672C\u5730\u53EF\u89C2\u6D4B\uFF1Bgit \u4FA7\u53EA\u80FD\u4EE5\u8BE5\u7528\u6237 commit \u7684\u6539\u52A8\u884C\u6570\u8FD1\u4F3C" }]);
  }
  return okR(id, ordinal(ctx, "collabLinesTier", 0), "\u6709\u672C\u5730\u5386\u53F2\u4F46\u4E0E\u5F53\u524D PR \u65E0\u4E3B\u57DF\u4EA4\u96C6\uFF08\u65B0\u9886\u57DF\uFF09\u2192 \u6700\u4F4E\u6863");
}
var init_dev_credit_profile_collab_lines = __esm({
  "../../packages/analyzer/dist/metrics/dev-credit-profile-collab-lines.js"() {
    "use strict";
    init_types4();
    init_helpers();
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/dev-credit-history-success-rate.js
async function devCreditHistorySuccessRate(ctx, node) {
  const id = node.id;
  const profile = ctx.profile;
  if (!profile)
    return noEvidenceR(id, "\u65E0 Dev_Profile");
  const gs = profile.gitStats;
  if (!gs || gs.totalPrCount <= 0) {
    return noEvidenceR(id, "\u65E0 git \u65C1\u8DEF PR \u6570\u636E\uFF08\u672A\u540C\u6B65\u6216\u65E0\u4ED6\u4EBA\u4ED3\u5E93 PR\uFF09\u2014\u2014 \u672C\u5730 committed PR \u4E0D\u53C2\u4E0E\u672C\u6307\u6807\uFF08D-036\uFF09");
  }
  const score = pct(gs.mergedPrCount / gs.totalPrCount);
  return okR(id, score, `\u4ED6\u4EBA\u4ED3\u5E93 PR\uFF1A${gs.mergedPrCount}/${gs.totalPrCount} merged\uFF08git \u65C1\u8DEF ${gs.lastSyncAt?.slice(0, 10) || "?"} \u540C\u6B65\uFF09`, [
    // P3 简化：不逐 PR 查 revert commit（成本不成比例），证据中明示口径
    { kind: "note", text: "\u53E3\u5F84\uFF1Asearch API is:merged \u8BA1\u6210\u529F\uFF1Brevert \u540E\u7EED\u68C0\u6D4B\u672A\u505A\uFF08revert-not-checked\uFF09" }
  ]);
}
var init_dev_credit_history_success_rate = __esm({
  "../../packages/analyzer/dist/metrics/dev-credit-history-success-rate.js"() {
    "use strict";
    init_helpers();
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/dev-credit-history-recent-avg.js
async function devCreditHistoryRecentAvg(ctx, node) {
  const id = node.id;
  const profile = ctx.profile;
  if (!profile)
    return noEvidenceR(id, "\u65E0 Dev_Profile");
  const tasks = profile.historyTasks.filter((t) => t.prId !== ctx.prId);
  if (tasks.length === 0) {
    return noEvidenceR(id, "\u65E0\u672C\u5730\u5386\u53F2 PR\uFF08\u521A\u8DD1\u5B8C git \u65C1\u8DEF\u5C1A\u672A\u6709\u672C\u5730\u7ED3\u7B97\uFF09");
  }
  const n = Math.max(1, ctx.config.profile.recentN);
  const recent = [...tasks].sort((a, b) => b.ts - a.ts).slice(0, n);
  const avg = recent.reduce((a, t) => a + t.prCredit, 0) / recent.length;
  const sampleNote = tasks.length < 3 ? `\uFF08\u6837\u672C\u91CF n=${tasks.length}\uFF0C\u504F\u5C0F\uFF09` : `\uFF08n=${recent.length}\uFF09`;
  return okR(id, avg, `\u6700\u8FD1 ${recent.length} \u6B21\u672C\u5730 PR \u7684 PR_Credit \u5E73\u5747 ${avg.toFixed(1)}${sampleNote}`, [
    {
      kind: "note",
      text: `\u6700\u8FD1\u6761\u76EE\uFF1A${recent.slice(0, 3).map((t) => `${t.prId.slice(0, 20)}=${t.prCredit.toFixed(0)}`).join("\u3001")}`
    }
  ]);
}
var init_dev_credit_history_recent_avg = __esm({
  "../../packages/analyzer/dist/metrics/dev-credit-history-recent-avg.js"() {
    "use strict";
    init_helpers();
  }
});

// ../../packages/analyzer/dist/metrics/tool-proxy.js
async function toolProxy(ctx, node) {
  const stub2 = node.stub;
  const provider = stub2?.provider ?? "";
  const tool = stub2?.tool ?? "\u5916\u90E8\u5DE5\u5177";
  const registered = PROVIDERS[provider];
  if (!registered) {
    return pendingR(node.id, `\u4F9D\u8D56\u5916\u90E8\u5DE5\u5177\uFF08${tool}\uFF09\uFF0C\u5F53\u524D\u9636\u6BB5\u672A\u63A5\u5165\uFF0C\u4E0D\u53C2\u4E0E\u672C\u6B21\u8BA1\u7B97`);
  }
  return pendingR(node.id, `\u5916\u90E8\u5DE5\u5177 ${tool} \u5DF2\u6CE8\u518C\u4F46\u672A\u8FD4\u56DE\u7ED3\u679C`);
}
var PROVIDERS;
var init_tool_proxy = __esm({
  "../../packages/analyzer/dist/metrics/tool-proxy.js"() {
    "use strict";
    init_helpers();
    PROVIDERS = {};
  }
});

// ../../packages/analyzer/dist/metrics/index.js
var CALCULATORS;
var init_metrics = __esm({
  "../../packages/analyzer/dist/metrics/index.js"() {
    "use strict";
    init_spec_ai_decision_ratio();
    init_spec_review();
    init_spec_boundary();
    init_spec_constraint();
    init_spec_quality_completeness();
    init_spec_quality_consistency();
    init_spec_quality_unambiguity();
    init_spec_quality_verifiability();
    init_spec_quality_traceability();
    init_test_plan_spec_coverage();
    init_test_plan_review();
    init_test_plan_ask_improve();
    init_test_plan_tc_l1();
    init_test_plan_tc_l5();
    init_gen_staged();
    init_gen_plan_first();
    init_gen_accept_lines();
    init_gen_alignment();
    init_gen_verify_read_pr();
    init_gen_verify_edit_pe();
    init_gen_verify_cursor_nc();
    init_test_dev_trigger();
    init_test_pass_rate();
    init_test_review_failure();
    init_fix_issue_quality();
    init_fix_repro_case();
    init_fix_root_cause();
    init_manual_pass_rate();
    init_manual_boundary();
    init_review_decision();
    init_review_rounds();
    init_review_disposition();
    init_dev_credit_profile_proficiency();
    init_dev_credit_profile_collab_lines();
    init_dev_credit_history_success_rate();
    init_dev_credit_history_recent_avg();
    init_tool_proxy();
    CALCULATORS = {
      "spec-ai-decision-ratio": specAiDecisionRatio,
      "spec-review": specReview,
      "spec-boundary": specBoundary,
      "spec-constraint": specConstraint,
      "spec-quality-completeness": specQualityCompleteness,
      "spec-quality-consistency": specQualityConsistency,
      "spec-quality-unambiguity": specQualityUnambiguity,
      "spec-quality-verifiability": specQualityVerifiability,
      "spec-quality-traceability": specQualityTraceability,
      "test-plan-spec-coverage": testPlanSpecCoverage,
      "test-plan-review": testPlanReview,
      "test-plan-ask-improve": testPlanAskImprove,
      "test-plan-tc-l1": testPlanTcL1,
      "test-plan-tc-l5": testPlanTcL5,
      "gen-staged": genStaged,
      "gen-plan-first": genPlanFirst,
      // 仍保留映射：该指标已退出分数框架（规则树不注册），但实现保留供离线分析/未来复用
      "gen-accept-lines": genAcceptLines,
      "gen-alignment": genAlignment,
      "gen-verify-read-pr": genVerifyReadPr,
      "gen-verify-edit-pe": genVerifyEditPe,
      // 仍保留映射：该指标已退出分数框架（规则树不注册），但实现保留供离线分析/未来复用
      "gen-verify-cursor-nc": genVerifyCursorNc,
      "test-dev-trigger": testDevTrigger,
      "test-pass-rate": testPassRate,
      "test-review-failure": testReviewFailure,
      "fix-issue-quality": fixIssueQuality,
      "fix-repro-case": fixReproCase,
      "fix-root-cause": fixRootCause,
      "manual-pass-rate": manualPassRate,
      "manual-boundary": manualBoundary,
      "review-decision": reviewDecision,
      "review-rounds": reviewRounds,
      "review-disposition": reviewDisposition,
      // P3：Dev_Credit 四叶子（前置 devProfile 在引擎激活）
      "dev-credit-profile-proficiency": devCreditProfileProficiency,
      "dev-credit-profile-collab-lines": devCreditProfileCollabLines,
      "dev-credit-history-success-rate": devCreditHistorySuccessRate,
      "dev-credit-history-recent-avg": devCreditHistoryRecentAvg,
      "tool-proxy": toolProxy
    };
  }
});

// ../../packages/analyzer/dist/credit/engine.js
async function prerequisiteMet(ctx, p) {
  switch (p) {
    case "specDocs": {
      const docs = await ctx.specDocs();
      return docs.length > 0 ? { met: true, detail: `${docs.length} \u4EFD SPEC \u6587\u6863` } : { met: false, detail: "\u672C\u6B21 PR \u65E0 SPEC \u6587\u6863\uFF0C\u6574\u7EC4\u4E0D\u9002\u7528" };
    }
    case "testArtifacts": {
      const uris = ctx.testUris();
      return uris.length > 0 ? { met: true, detail: `${uris.length} \u4E2A\u6D4B\u8BD5\u76F8\u5173\u6587\u4EF6` } : { met: false, detail: "\u65E0\u6D4B\u8BD5\u6587\u4EF6\u4E14\u65E0\u6D4B\u8BD5\u65B9\u6848\u6587\u6863\uFF0C\u6574\u7EC4\u4E0D\u9002\u7528" };
    }
    case "codeGen": {
      const hasAccept = ctx.behaviors.some((b) => b.action === "accept");
      const hasGenTool = ctx.behaviors.some((b) => b.action === "agent.tool" && /^(write|edit|multiedit|create_file|apply_patch)$/i.test(String(b.context?.toolName ?? "")));
      return hasAccept || hasGenTool ? { met: true, detail: hasAccept ? "\u5B58\u5728 userAccept" : "\u5B58\u5728\u4EE3\u7801\u751F\u6210\u7C7B\u5DE5\u5177\u8C03\u7528" } : { met: false, detail: "\u65E0 userAccept \u4E14\u65E0\u4EE3\u7801\u751F\u6210\u7C7B\u5DE5\u5177\u8C03\u7528\uFF0C\u6574\u7EC4\u4E0D\u9002\u7528" };
    }
    case "testRuns": {
      const runs = ctx.testRuns();
      return runs.length > 0 ? { met: true, detail: `${runs.length} \u6B21\u6D4B\u8BD5\u8FD0\u884C` } : { met: false, detail: "Dev \u4E0E AI \u5747\u672A\u8FD0\u884C\u6D4B\u8BD5\uFF0C\u6574\u7EC4\u4E0D\u9002\u7528" };
    }
    case "fixPhase": {
      const runs = ctx.testRuns().filter((r) => (r.failed ?? 0) > 0);
      const hasFix = ctx.tasks().some((t) => t.stage === "ai-fix" || t.spans.some((s) => s.stage === "ai-fix"));
      return runs.length > 0 && hasFix ? { met: true, detail: `${runs.length} \u6B21\u5931\u8D25\u8FD0\u884C + \u4FEE\u590D\u73AF\u8282` } : { met: false, detail: "\u65E0\u5931\u8D25\u6D4B\u8BD5\u540E\u7684\u4FEE\u590D\u73AF\u8282\uFF0C\u6574\u7EC4\u4E0D\u9002\u7528" };
    }
    case "coreDiff": {
      const cd = ctx.coreDiff();
      return cd.totalCoreNew > 0 ? { met: true, detail: `${cd.totalCoreNew} \u884C\u6838\u5FC3\u65B0\u589E` } : { met: false, detail: "\u65E0\u6838\u5FC3\u65B0\u589E\u884C\uFF0C\u6574\u7EC4\u4E0D\u9002\u7528" };
    }
    case "devProfile":
      return ctx.profile ? { met: true, detail: `Dev_Profile \u5DF2\u521D\u59CB\u5316\uFF08keywords=${ctx.profile.techDomain.keywords.length}\uFF0Ctasks=${ctx.profile.historyTasks.length}\uFF09` } : { met: false, detail: "Dev_Profile \u672A\u521D\u59CB\u5316\uFF0CDev_Credit \u6574\u7EC4\u4E0D\u9002\u7528\uFF08\u53EF\u5728 Developer Profile \u9875\u521D\u59CB\u5316\uFF09" };
    default:
      return { met: true, detail: "" };
  }
}
function markExcluded(node, detail) {
  const children = (node.children ?? []).map((c) => markExcluded(c, detail));
  return {
    node,
    result: {
      id: node.id,
      status: "excluded",
      score: null,
      weight: node.metric?.weight ?? 1,
      detail,
      evidence: []
    },
    children: children.length > 0 ? children : void 0
  };
}
async function runLeaf(ctx, node) {
  const file = node.stub ? "tool-proxy" : calculatorFile(node.id);
  const calc = CALCULATORS[file];
  if (!calc) {
    return {
      id: node.id,
      status: "error",
      score: 0,
      weight: node.metric?.weight ?? 1,
      detail: `\u672A\u627E\u5230\u8BA1\u7B97\u5668\uFF1A${file}`,
      evidence: []
    };
  }
  try {
    const r = await calc(ctx, node);
    if (r.score != null && (r.score < 0 || r.score > 100)) {
      return { ...r, score: Math.max(0, Math.min(100, r.score)) };
    }
    return r;
  } catch (e) {
    return {
      id: node.id,
      status: "error",
      score: 0,
      weight: node.metric?.weight ?? 1,
      detail: `\u8BA1\u7B97\u5F02\u5E38\uFF1A${String(e?.message ?? e)}`,
      evidence: []
    };
  }
}
async function runEngine(ctx, node) {
  if (node.level === "L0") {
    const children = [];
    for (const c of node.children ?? [])
      children.push(await runEngine(ctx, c));
    return { node, result: aggregateRoot(node, children, ctx.config.aggregation), children };
  }
  if (node.children && node.children.length > 0) {
    if (node.prerequisite) {
      const p = await prerequisiteMet(ctx, node.prerequisite);
      if (!p.met)
        return markExcluded(node, p.detail);
    }
    const children = [];
    for (const c of node.children)
      children.push(await runEngine(ctx, c));
    return { node, result: aggregateGroup(node, children), children };
  }
  return { node, result: await runLeaf(ctx, node) };
}
function collectDiagnostics(root) {
  const statusDist = {};
  const errorIds = [];
  const pendingIds = [];
  const degradedIds = [];
  const walk2 = (n) => {
    const s = n.result.status;
    statusDist[s] = (statusDist[s] ?? 0) + 1;
    if (s === "error")
      errorIds.push(n.node.id);
    if (s === "pending")
      pendingIds.push(n.node.id);
    if (s === "degraded")
      degradedIds.push(n.node.id);
    for (const c of n.children ?? [])
      walk2(c);
  };
  walk2(root);
  return { statusDist, errorIds, pendingIds, degradedIds };
}
function collectEvidence(n) {
  return [...n.result.evidence ?? [], ...(n.children ?? []).flatMap(collectEvidence)];
}
var init_engine = __esm({
  "../../packages/analyzer/dist/credit/engine.js"() {
    "use strict";
    init_dist();
    init_aggregate();
    init_metrics();
  }
});

// ../../packages/analyzer/dist/credit/compute.js
function inputFingerprint(opts) {
  const parts = [
    CALC_VERSION,
    String(opts.behaviors.length),
    opts.taskGraph.v ?? "0",
    String(opts.taskGraph.tasks.length),
    String(opts.taskGraph.generatedAt ?? 0),
    opts.gitDiff?.available ? `${opts.gitDiff.head ?? ""}..${opts.gitDiff.base ?? ""}` : "nogit",
    String(opts.gitDiff?.files?.length ?? 0),
    profileStamp(opts.profile ?? null, opts.prId)
  ];
  return parts.join("|");
}
async function computeCredit(opts) {
  const testRuns = opts.testRuns ?? detectTestRuns(opts.behaviors);
  const ctx = createContext({
    prId: opts.prId,
    behaviors: opts.behaviors,
    taskGraph: opts.taskGraph,
    gitDiff: opts.gitDiff,
    testRuns,
    llm: opts.llm,
    git: opts.git ?? null,
    fs: opts.fs ?? null,
    config: opts.config,
    profile: opts.profile ?? null
  });
  const tree = await runEngine(ctx, RULESET.tree);
  const diag = collectDiagnostics(tree);
  let profileKeywords = null;
  if (opts.profile) {
    try {
      profileKeywords = await ctx.profileKeywords();
    } catch {
      profileKeywords = null;
    }
  }
  const cd = ctx.coreDiff();
  const aiCollabLines = Object.values(cd.aiLines).reduce((a, lines) => a + lines.length, 0);
  const procNode = tree.children?.find((c) => c.node.id === "procCredits");
  const devNode = tree.children?.find((c) => c.node.id === "devCredit");
  const band = bandOf(tree.result.score ?? 0);
  return {
    v: "1.0",
    prId: opts.prId,
    generatedAt: Date.now(),
    generator: {
      rulesetVersion: RULESET.v,
      llmModel: opts.llmModel ?? null,
      llmCalls: ctx.stats.llmCalls,
      inputFingerprint: inputFingerprint({
        behaviors: opts.behaviors,
        taskGraph: opts.taskGraph,
        gitDiff: opts.gitDiff,
        profile: opts.profile,
        prId: opts.prId
      })
    },
    tree,
    profileFeed: { profileKeywords, aiCollabLines },
    summary: {
      prCredit: tree.result.score ?? 0,
      procCredits: procNode?.result.score ?? 0,
      devCredit: devNode?.result.status === "ok" ? devNode.result.score : null,
      band: band.band,
      bandLabel: band.label,
      overallComment: tree.result.detail
    },
    diagnostics: {
      statusDist: diag.statusDist,
      llmFallbackCount: ctx.stats.llmFallback,
      errorIds: diag.errorIds,
      pendingIds: diag.pendingIds,
      degradedIds: diag.degradedIds,
      gitDiffAvailable: opts.gitDiff?.available ?? false
    }
  };
}
var CALC_VERSION;
var init_compute = __esm({
  "../../packages/analyzer/dist/credit/compute.js"() {
    "use strict";
    init_dist();
    init_testrun();
    init_context();
    init_engine();
    init_aggregate();
    init_types4();
    CALC_VERSION = "2026-09-09.3";
  }
});

// ../../packages/analyzer/dist/profile/bypass.js
async function ghGraphQL(fetchLike, query, variables, token) {
  if (!token)
    throw new GitHubError("GraphQL \u9700\u8981 GITHUB_TOKEN\uFF08\u884C\u6570\u7EDF\u8BA1\u65E0\u6CD5\u533F\u540D\u8FDB\u884C\uFF09", 401);
  const res = await fetchLike(GH_GRAPHQL, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "credit-prototype",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    throw new GitHubError(`GitHub GraphQL ${res.status}` + (res.status === 401 ? "\uFF08token \u65E0\u6548\u6216\u5DF2\u8FC7\u671F\uFF09" : res.status === 403 ? "\uFF08\u9650\u6D41\u6216\u6743\u9650\u4E0D\u8DB3\uFF09" : ""), res.status);
  }
  const body = await res.json();
  if (body.errors?.length) {
    throw new GitHubError(`GitHub GraphQL \u9519\u8BEF\uFF1A${body.errors.map((e) => e.message).join("\uFF1B")}`, 400);
  }
  if (!body.data)
    throw new GitHubError("GitHub GraphQL \u8FD4\u56DE\u65E0 data", 400);
  return body.data;
}
async function fetchGithubOverview(opts) {
  const p = { ...DEFAULT_BYPASS_PARAMS, ...opts.params };
  let requests = 0;
  const step = async (fn) => {
    requests++;
    return fn();
  };
  const user = await step(() => ghGraphQL(opts.fetchLike, Q_USER, {
    login: opts.user,
    prAll: `author:${opts.user} type:pr`,
    prMerged: `author:${opts.user} type:pr is:merged`
  }, opts.token));
  const uid = user?.user?.id ?? null;
  if (!uid)
    throw new GitHubError(`GraphQL \u67E5\u4E0D\u5230\u7528\u6237\uFF1A${opts.user}`, 404);
  const repoData = await step(() => ghGraphQL(opts.fetchLike, Q_REPOS, {
    login: opts.user,
    uid,
    first: Math.min(p.maxRepos, 50),
    perRepo: p.maxCommitsPerRepo,
    since: opts.since ?? null
  }, opts.token));
  const repos = (repoData.user?.repositoriesContributedTo?.nodes ?? []).map((n) => {
    const history = n.defaultBranchRef?.target?.history?.nodes ?? [];
    const lines = history.reduce((sum, c) => sum + Math.min(p.maxLinesPerCommit, (c.additions ?? 0) + (c.deletions ?? 0)), 0);
    return {
      fullName: n.nameWithOwner,
      description: String(n.description ?? "").slice(0, 200),
      language: n.primaryLanguage?.name ?? "",
      topics: (n.languages?.nodes ?? []).map((l) => l.name),
      pushAt: String(n.pushedAt ?? ""),
      fork: false,
      commitCount: history.length,
      gitLines: lines,
      lastCommitAt: history[0]?.committedDate || void 0,
      empty: history.length === 0,
      messages: history.slice(0, p.sampleMessagesPerRepo).map((c) => String(c.messageHeadline ?? "").slice(0, p.msgMaxChars)).filter(Boolean),
      languages: {}
      // GraphQL 只取语言名列表（topics 承载），不再需要字节分布
    };
  });
  for (const repo of repos.filter((r) => !r.empty).slice(0, p.readmeRepos)) {
    try {
      requests++;
      const res = await opts.fetchLike(`${GH_API}/repos/${repo.fullName}/readme`, {
        headers: {
          accept: "application/vnd.github.raw+json",
          "user-agent": "credit-prototype",
          ...opts.token ? { authorization: `Bearer ${opts.token}` } : {}
        }
      });
      if (res.ok)
        repo.readmeHead = (await res.text()).slice(0, p.readmeHeadChars);
    } catch {
    }
  }
  return {
    login: String(user?.user?.login ?? opts.user),
    bio: String(user?.user?.bio ?? "").slice(0, 300),
    repos,
    prTotal: Number(user?.prTotal?.issueCount ?? 0) || 0,
    prMerged: Number(user?.prMerged?.issueCount ?? 0) || 0,
    requests
  };
}
function buildDigest(overview, params, existing) {
  const p = { ...DEFAULT_BYPASS_PARAMS, ...params };
  const sections = [];
  sections.push({
    priority: 0,
    text: `GitHub \u7528\u6237\uFF1A${overview.login}${overview.bio ? `\uFF08${overview.bio}\uFF09` : ""}
PR \u7EDF\u8BA1\uFF08\u4ED6\u4EBA\u4ED3\u5E93\u8D21\u732E\uFF09\uFF1A\u603B PR ${overview.prTotal}\uFF0C\u5176\u4E2D merged ${overview.prMerged}`
  });
  sections.push({
    priority: 1,
    text: `
== \u6D3B\u8DC3\u4ED3\u5E93\uFF08\u6309\u6700\u8FD1\u63A8\u9001\uFF0C\u6700\u591A ${p.maxRepos}\uFF09==
` + overview.repos.map((r) => {
      const langs = Object.entries(r.languages).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l, n]) => l).join("/");
      const base = `- ${r.fullName}${r.empty ? "\uFF08\u65E0\u8D21\u732E\uFF09" : ""}${r.language ? ` [${r.language}]` : ""}${r.description ? ` \u63CF\u8FF0: ${r.description}` : ""}${r.topics.length ? ` \u4E3B\u9898: ${r.topics.join(",")}` : ""} commit ${r.commitCount}\u3001\u6539\u52A8 ${r.gitLines} \u884C${langs ? `\uFF1B\u8BED\u8A00: ${langs}` : ""}`;
      return base;
    }).join("\n")
  });
  const msgSection = `
== commit \u6458\u8981\u6837\u672C\uFF08\u524D ${p.sampleRepos} \u4ED3\uFF09==
` + overview.repos.slice(0, p.sampleRepos).filter((r) => r.messages.length > 0).map((r) => `- ${r.fullName}: ${r.messages.join(" | ")}`).join("\n");
  if (msgSection.includes("- "))
    sections.push({ priority: 2, text: msgSection });
  const readmeSection = overview.repos.slice(0, p.readmeRepos).filter((r) => r.readmeHead).map((r) => `- ${r.fullName} README: ${r.readmeHead.replace(/\s+/g, " ").slice(0, p.readmeHeadChars)}`).join("\n");
  if (readmeSection)
    sections.push({ priority: 3, text: `
== README \u6458\u8981 ==
${readmeSection}` });
  if (existing && (existing.techDomain.keywords.length > 0 || existing.historyTasks.length > 0)) {
    sections.push({
      priority: 1,
      text: `
== \u73B0\u6709\u753B\u50CF\u5173\u952E\u8BCD\uFF08\u589E\u91CF\u66F4\u65B0\uFF0C\u8BF7\u57FA\u4E8E\u5B83\u589E\u91CF\u5F52\u7EB3\uFF09==
` + existing.techDomain.keywords.map((k) => k.name).join("\u3001")
    });
  }
  let picked = sections.filter((s) => s.priority <= 1);
  let text = picked.map((s) => s.text).join("\n");
  if (text.length > p.digestBudgetChars) {
    picked = sections.filter((s) => s.priority <= 1 && !s.text.startsWith("\n== \u73B0\u6709\u753B\u50CF"));
    text = picked.map((s) => s.text).join("\n");
  }
  for (const s of [...sections].sort((a, b) => b.priority - a.priority)) {
    if (text.length <= p.digestBudgetChars)
      break;
    if (s.priority <= 1)
      continue;
    text = text.replace(s.text, "");
  }
  if (text.length > p.maxDigestChars)
    text = text.slice(0, p.maxDigestChars);
  return { text, chars: text.length };
}
async function summarizeProfileKeywords(opts) {
  const r = await llmJson(opts.llm, {
    metricId: "dev-profile",
    templateId: "dev-profile-v1",
    system: SUMMARIZE_SYS,
    user: opts.digest,
    schema: { type: "object" }
  });
  if (!r.ok || !r.data)
    return { ok: false, keywords: [], rationale: r.rationale };
  const list = Array.isArray(r.data.keywords) ? r.data.keywords ?? [] : [];
  const keywords = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of list) {
    const o = item ?? {};
    const name = String(o.name ?? "").trim().slice(0, 24);
    if (!name)
      continue;
    const key = name.toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    const repos = Array.isArray(o.repos) ? o.repos.map(String) : [];
    const lines = o.lines ?? o.commits ?? o.gitLines;
    keywords.push({ name, repos, lines: Math.max(0, Number(lines ?? 0) || 0) });
    if (keywords.length >= 15)
      break;
  }
  return {
    ok: keywords.length > 0,
    keywords,
    rationale: keywords.length > 0 ? "LLM \u5F52\u7EB3\u5B8C\u6210" : "LLM \u8FD4\u56DE\u4E3A\u7A7A"
  };
}
function resolveKeywordLines(keywords, repos) {
  const byRepo = new Map(repos.map((r) => [r.fullName.toLowerCase(), r.gitLines]));
  return keywords.map((k) => {
    const sum = k.repos.reduce((acc, n) => acc + (byRepo.get(n.toLowerCase()) ?? 0), 0);
    return { ...k, lines: sum > 0 ? sum : k.lines ?? 0 };
  });
}
async function initProfileFromGit(opts) {
  const login = parseHomeUrl(opts.homeUrl);
  if (!login)
    return { ok: false, error: `\u65E0\u6CD5\u4ECE\u5730\u5740\u89E3\u6790\u7528\u6237\u540D\uFF1A${opts.homeUrl}` };
  const now = opts.now ?? /* @__PURE__ */ new Date();
  let overview;
  try {
    overview = await fetchGithubOverview({ user: login, token: opts.token, fetchLike: opts.fetchLike, params: opts.params });
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
  const digest = buildDigest(overview, opts.params);
  const sum = await summarizeProfileKeywords({ digest: digest.text, llm: opts.llm });
  if (!sum.ok)
    return { ok: false, error: `LLM \u5F52\u7EB3\u5931\u8D25\uFF1A${sum.rationale}`, requests: overview.requests };
  const profile = emptyProfile(now);
  mergeGitData(profile, {
    // 行数由代码按仓精确累加（D-043），LLM 只负责"关键词 ↔ 仓库"的语义映射
    keywords: resolveKeywordLines(sum.keywords, overview.repos).map((k) => ({
      name: k.name,
      lines: k.lines ?? 0
    })),
    gitStats: {
      totalPrCount: overview.prTotal,
      mergedPrCount: overview.prMerged,
      reposContributed: []
    },
    repoCursors: Object.fromEntries(overview.repos.map((r) => [r.fullName, r.lastCommitAt])),
    user: overview.login
  }, now);
  return {
    ok: true,
    requests: overview.requests,
    digestChars: digest.chars,
    draft: {
      createdAt: now.toISOString(),
      gitUser: overview.login,
      profile,
      digestChars: digest.chars,
      requests: overview.requests
    }
  };
}
async function syncProfileFromGit(opts) {
  const user = opts.profile.syncState.user ?? opts.profile.gitUser;
  if (!user)
    return { ok: false, error: "profile \u672A\u7ED1\u5B9A git \u7528\u6237\uFF08\u672A\u521D\u59CB\u5316\uFF09" };
  const now = opts.now ?? /* @__PURE__ */ new Date();
  const since = opts.profile.syncState.lastSyncAt;
  let overview;
  try {
    overview = await fetchGithubOverview({
      user,
      token: opts.token,
      fetchLike: opts.fetchLike,
      params: opts.params,
      since
    });
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
  const digest = buildDigest(overview, opts.params, opts.profile);
  const sum = await summarizeProfileKeywords({ digest: digest.text, llm: opts.llm });
  if (!sum.ok)
    return { ok: false, error: `LLM \u5F52\u7EB3\u5931\u8D25\uFF1A${sum.rationale}`, requests: overview.requests };
  const next = structuredClone(opts.profile);
  const before = next.techDomain.keywords.reduce((a, k) => a + k.gitLines, 0);
  mergeGitData(next, {
    // 增量语义：只有 since 之后的 commit 被统计，故此处都是**增量行数**
    keywords: resolveKeywordLines(sum.keywords, overview.repos).map((k) => ({
      name: k.name,
      lines: k.lines ?? 0
    })),
    gitStats: {
      totalPrCount: overview.prTotal,
      mergedPrCount: overview.prMerged,
      reposContributed: []
    },
    repoCursors: Object.fromEntries(overview.repos.map((r) => [r.fullName, r.lastCommitAt])),
    user
  }, now);
  const after = next.techDomain.keywords.reduce((a, k) => a + k.gitLines, 0);
  return {
    ok: true,
    requests: overview.requests,
    digestChars: digest.chars,
    profile: next,
    changes: `\u5173\u952E\u8BCD ${before === after ? "\u65E0\u53D8\u5316" : `\u884C\u6570\u7D2F\u8BA1 ${before}\u2192${after}`}\uFF0CPR \u7EDF\u8BA1 ${overview.prMerged}/${overview.prTotal}`
  };
}
function parseHomeUrl(url) {
  try {
    const u = new URL(String(url ?? "").trim());
    if (!/^www\./.test(u.hostname) ? u.hostname !== "github.com" : u.hostname !== "www.github.com") {
      if (u.hostname !== "github.com" && u.hostname !== "www.github.com")
        return null;
    }
    const seg = u.pathname.split("/").filter(Boolean);
    return seg[0] ?? null;
  } catch {
    return null;
  }
}
var DEFAULT_BYPASS_PARAMS, GH_API, GH_GRAPHQL, GitHubError, Q_USER, Q_REPOS, SUMMARIZE_SYS;
var init_bypass = __esm({
  "../../packages/analyzer/dist/profile/bypass.js"() {
    "use strict";
    init_llm_json();
    init_types4();
    DEFAULT_BYPASS_PARAMS = {
      maxRepos: 30,
      maxCommitsPerRepo: 100,
      maxLinesPerCommit: 2e4,
      sampleRepos: 5,
      sampleMessagesPerRepo: 30,
      msgMaxChars: 120,
      readmeRepos: 3,
      readmeHeadChars: 1500,
      digestBudgetChars: 6e3,
      maxDigestChars: 12e3
    };
    GH_API = "https://api.github.com";
    GH_GRAPHQL = "https://api.github.com/graphql";
    GitHubError = class extends Error {
      status;
      constructor(message, status) {
        super(message);
        this.status = status;
      }
    };
    Q_USER = `query($login: String!, $prAll: String!, $prMerged: String!) {
  user(login: $login) { id login bio }
  prTotal: search(query: $prAll, type: ISSUE) { issueCount }
  prMerged: search(query: $prMerged, type: ISSUE) { issueCount }
}`;
    Q_REPOS = `query($login: String!, $uid: ID!, $first: Int!, $perRepo: Int!, $since: GitTimestamp) {
  user(login: $login) {
    repositoriesContributedTo(
      first: $first, includeUserRepositories: true,
      orderBy: { field: PUSHED_AT, direction: DESC }
    ) {
      nodes {
        nameWithOwner
        description
        pushedAt
        primaryLanguage { name }
        languages(first: 5) { nodes { name } }
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: $perRepo, author: { id: $uid }, since: $since) {
                nodes { additions deletions committedDate messageHeadline }
              }
            }
          }
        }
      }
    }
  }
}`;
    SUMMARIZE_SYS = `\u4F60\u662F\u5F00\u53D1\u8005\u753B\u50CF\u5F52\u7EB3\u52A9\u624B\u3002\u6839\u636E\u7ED9\u5B9A\u7684 GitHub \u6D3B\u52A8\u6458\u8981\uFF0C\u5F52\u7EB3\u8BE5\u5F00\u53D1\u8005\u7684\u6280\u672F\u9886\u57DF\u5173\u952E\u8BCD\uFF0C
\u5E76**\u6307\u51FA\u6BCF\u4E2A\u5173\u952E\u8BCD\u7531\u54EA\u4E9B\u4ED3\u5E93\u652F\u6491**\u3002

\u8981\u6C42\uFF1A
1. keywords\uFF1A8\u201315 \u4E2A\u6700\u80FD\u4EE3\u8868\u5176\u6280\u672F\u9886\u57DF\u7684\u8BCD\uFF08\u6846\u67B6/\u8BED\u8A00/\u9886\u57DF\uFF0C\u5982 "TypeScript" "\u524D\u7AEF\u5DE5\u7A0B" "\u533A\u5757\u94FE"\uFF09\uFF1B
2. repos\uFF1A**\u5FC5\u987B\u586B\u6458\u8981\u4E2D\u771F\u5B9E\u51FA\u73B0\u7684\u4ED3\u5E93\u5168\u540D**\uFF08owner/name\uFF09\uFF0C\u8BE5\u5173\u952E\u8BCD\u7531\u8FD9\u4E9B\u4ED3\u652F\u6491\uFF1B
   \u4E00\u4E2A\u4ED3\u53EF\u652F\u6491\u591A\u4E2A\u5173\u952E\u8BCD\uFF1B
3. **\u4E0D\u8981\u8F93\u51FA\u884C\u6570/\u6570\u5B57** \u2014\u2014 \u884C\u6570\u7531\u7CFB\u7EDF\u6309\u4ED3\u5E93\u7CBE\u786E\u7D2F\u52A0\uFF0C\u6A21\u578B\u4E0D\u4F30\u7B97\uFF1B
4. \u4E0D\u8981\u7F16\u9020\u6458\u8981\u4E2D\u4E0D\u5B58\u5728\u7684\u9886\u57DF\uFF1B\u901A\u7528\u8BCD\uFF08"\u5F00\u53D1" "\u7F16\u7A0B"\uFF09\u4E0D\u8981\u3002

\u53EA\u8F93\u51FA json\uFF0C\u5B57\u6BB5\u540D\u5FC5\u987B\u4E25\u683C\u5982\u4E0B\uFF1A
{"keywords":[{"name":"TypeScript","repos":["owner/repo-a","owner/repo-b"]}]}`;
  }
});

// ../../packages/analyzer/dist/profile/update-from-pr.js
function applyPrResult(p, input) {
  if (!isInitialized(p)) {
    return { changed: false, reason: "not-initialized", profile: p };
  }
  const keywords = input.keywords ?? input.feed.profileKeywords ?? [];
  if (keywords.length === 0) {
  }
  const task = {
    prId: input.prId,
    ts: input.ts,
    repo: input.repo,
    keywords,
    aiCollabLines: Math.max(0, Number(input.feed.aiCollabLines ?? 0) || 0),
    prCredit: Math.max(0, Number(input.prCredit ?? 0) || 0),
    creditFingerprint: input.creditFingerprint,
    status: "committed",
    source: "local"
  };
  const up = upsertHistoryTask(p, task);
  if (!up.changed) {
    return { changed: false, reason: "skipped", profile: p };
  }
  ensureKeywordEntries(p, keywords, "local");
  return { changed: true, reason: up.reason, profile: p };
}
var init_update_from_pr = __esm({
  "../../packages/analyzer/dist/profile/update-from-pr.js"() {
    "use strict";
    init_types4();
    init_types4();
  }
});

// ../../packages/analyzer/dist/profile/index.js
var init_profile = __esm({
  "../../packages/analyzer/dist/profile/index.js"() {
    "use strict";
    init_types4();
    init_pr_keywords();
    init_bypass();
    init_update_from_pr();
  }
});

// ../../packages/analyzer/dist/index.js
var dist_exports = {};
__export(dist_exports, {
  ALL_STAGES: () => ALL_STAGES,
  CALC_VERSION: () => CALC_VERSION,
  DEFAULT_BYPASS_PARAMS: () => DEFAULT_BYPASS_PARAMS,
  DEFAULT_CREDIT_CONFIG: () => DEFAULT_CREDIT_CONFIG,
  DEFAULT_FINDING_PATTERNS: () => DEFAULT_FINDING_PATTERNS,
  DEFAULT_FIX_WINDOW_MS: () => DEFAULT_FIX_WINDOW_MS,
  DEFAULT_FIX_WORDS: () => DEFAULT_FIX_WORDS,
  DEFAULT_LLM_CONFIG: () => DEFAULT_LLM_CONFIG,
  DEFAULT_MANUAL_VERIFY_WORDS: () => DEFAULT_MANUAL_VERIFY_WORDS,
  DEFAULT_REVIEW_PROMPT_WORDS: () => DEFAULT_REVIEW_PROMPT_WORDS,
  DEFAULT_REVIEW_SESSION_PATTERN: () => DEFAULT_REVIEW_SESSION_PATTERN,
  DEFAULT_REVIEW_TOOL_NAMES: () => DEFAULT_REVIEW_TOOL_NAMES,
  DEFAULT_SPEC_WORDS: () => DEFAULT_SPEC_WORDS,
  DEFAULT_TASK_CONFIG: () => DEFAULT_TASK_CONFIG,
  DEFAULT_TEST_CMD_PATTERNS: () => DEFAULT_TEST_CMD_PATTERNS,
  DEFAULT_TEST_PLAN_WORDS: () => DEFAULT_TEST_PLAN_WORDS,
  GitHubError: () => GitHubError,
  JSON_MODE_HINT: () => JSON_MODE_HINT,
  MIN_SPAN_WEIGHT: () => MIN_SPAN_WEIGHT,
  PATTERN_DESC: () => PATTERN_DESC,
  PATTERN_LABELS: () => PATTERN_LABELS,
  PR_CREDIT_TREE: () => PR_CREDIT_TREE,
  RULESET: () => RULESET,
  RULESET_VERSION: () => RULESET_VERSION,
  STAGE_LABELS: () => STAGE_LABELS,
  SYSTEM_PROMPT: () => SYSTEM_PROMPT,
  TASK_GRAPH_VERSION: () => TASK_GRAPH_VERSION,
  aggregateFiles: () => aggregateFiles,
  aggregateGroup: () => aggregateGroup,
  aggregateRoot: () => aggregateRoot,
  annotateStages: () => annotateStages,
  applyPrResult: () => applyPrResult,
  artifactOf: () => artifactOf,
  asArray: () => asArray,
  asNumber: () => asNumber,
  bandOf: () => bandOf,
  buildBehaviorSummary: () => buildBehaviorSummary,
  buildCoreDiff: () => buildCoreDiff,
  buildDigest: () => buildDigest,
  buildFixWindows: () => buildFixWindows,
  buildPromptTurns: () => buildPromptTurns,
  buildReadingTrace: () => buildReadingTrace,
  buildRtm: () => buildRtm,
  buildSpecQuality: () => buildSpecQuality,
  buildTaskGraph: () => buildTaskGraph,
  buildUriAlias: () => buildUriAlias,
  calculatorFile: () => calculatorFile,
  canonicalUri: () => canonicalUri,
  clamp01to100: () => clamp01to100,
  classifyWindow: () => classifyWindow,
  cleanPrompt: () => cleanPrompt,
  collectDiagnostics: () => collectDiagnostics,
  collectEvidence: () => collectEvidence,
  collectFileUris: () => collectFileUris,
  collectSpecUris: () => collectSpecUris,
  computeCredit: () => computeCredit,
  computeMetrics: () => computeMetrics,
  computeTaskSpectrum: () => computeTaskSpectrum,
  createAiInvolvementLayer: () => createAiInvolvementLayer,
  createAnalyticRegistry: () => createAnalyticRegistry,
  createBitfunLlmPort: () => createBitfunLlmPort,
  createCollabPatternLayer: () => createCollabPatternLayer,
  createContext: () => createContext,
  createDefaultAnalyticRegistry: () => createDefaultAnalyticRegistry,
  createMemoryCache: () => createMemoryCache,
  createMockLlmPort: () => createMockLlmPort,
  createNullLlmPort: () => createNullLlmPort,
  createOpenAILlmPort: () => createOpenAILlmPort,
  defaultAnalyticLayers: () => defaultAnalyticLayers,
  detectReviewSessions: () => detectReviewSessions,
  detectTestRuns: () => detectTestRuns,
  emptyProfile: () => emptyProfile,
  ensureJsonMode: () => ensureJsonMode,
  ensureKeywordEntries: () => ensureKeywordEntries,
  extractContent: () => extractContent,
  extractPrKeywords: () => extractPrKeywords,
  extractTestCases: () => extractTestCases,
  fallbackDesc: () => fallbackDesc,
  fetchGithubOverview: () => fetchGithubOverview,
  findNode: () => findNode,
  generateDescs: () => generateDescs,
  hasFailedRun: () => hasFailedRun,
  hasGitLines: () => hasGitLines,
  hasJsonKeyword: () => hasJsonKeyword,
  hashInput: () => hashInput,
  inferTaskType: () => inferTaskType,
  initProfileFromGit: () => initProfileFromGit,
  inputFingerprint: () => inputFingerprint,
  isAbsolutePath: () => isAbsolutePath,
  isCodeEdit: () => isCodeEdit,
  isDocUri: () => isDocUri,
  isExcludedFile: () => isExcludedFile,
  isInitialized: () => isInitialized,
  isMeaningfulLine: () => isMeaningfulLine,
  isReviewBehavior: () => isReviewBehavior,
  isSpecUri: () => isSpecUri,
  isTestCommand: () => isTestCommand,
  isTestUri: () => isTestUri,
  kwNorm: () => kwNorm,
  languageDistribution: () => languageDistribution,
  languageOf: () => languageOf,
  leaves: () => leaves,
  llmJson: () => llmJson,
  loadSpecDocs: () => loadSpecDocs,
  localLinesOf: () => localLinesOf,
  makeCacheKey: () => makeCacheKey,
  makeClassifyContext: () => makeClassifyContext,
  matchGlob: () => matchGlob,
  matchedKeywords: () => matchedKeywords,
  mergeCreditConfig: () => mergeCreditConfig,
  mergeGitData: () => mergeGitData,
  mergeTaskConfig: () => mergeTaskConfig,
  normUri: () => normUri,
  normalizeProfile: () => normalizeProfile,
  overallAiRatio: () => overallAiRatio,
  parseHomeUrl: () => parseHomeUrl,
  parseLooseJson: () => parseLooseJson,
  parseUnifiedDiff: () => parseUnifiedDiff,
  profileStamp: () => profileStamp,
  readApiKey: () => readApiKey,
  resolveGitUri: () => resolveGitUri,
  resolveKeywordLines: () => resolveKeywordLines,
  reviewSignalOf: () => reviewSignalOf,
  runEngine: () => runEngine,
  segmentBehaviors: () => segmentBehaviors,
  splitSpecItems: () => splitSpecItems,
  splitSubspans: () => splitSubspans,
  stripCodeBlocks: () => stripCodeBlocks,
  summarizeProfileKeywords: () => summarizeProfileKeywords,
  syncProfileFromGit: () => syncProfileFromGit,
  todayStr: () => todayStr,
  traceOf: () => traceOf,
  upsertHistoryTask: () => upsertHistoryTask,
  validateJson: () => validateJson,
  walk: () => walk
});
var init_dist2 = __esm({
  "../../packages/analyzer/dist/index.js"() {
    "use strict";
    init_llm();
    init_types();
    init_config();
    init_segment();
    init_testrun();
    init_review();
    init_stage();
    init_desc();
    init_files();
    init_spectrum();
    init_build();
    init_process();
    init_types2();
    init_config2();
    init_context();
    init_engine();
    init_aggregate();
    init_compute();
    init_diff_parser();
    init_reading();
    init_core_diff();
    init_spec_docs();
    init_rtm();
    init_llm_json();
    init_uri();
    init_spec_quality();
    init_profile();
    init_dist();
  }
});

// source/worker/llm-relay.js
var require_llm_relay = __commonJS({
  "source/worker/llm-relay.js"(exports2, module2) {
    "use strict";
    var DEFAULT_TIMEOUT_MS = 18e4;
    var pending = /* @__PURE__ */ new Map();
    var seq = 0;
    var emitFn = (event, data) => {
      if (typeof globalThis.rpcEmit === "function") globalThis.rpcEmit(event, data);
    };
    function setEmitter(fn) {
      emitFn = typeof fn === "function" ? fn : emitFn;
    }
    var aiEventName = "credit:llm";
    var aiResultMethod = "credit.__llmResult";
    function createRelayAi2({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
      return {
        complete({ system, user, model }) {
          const id = `llm-${++seq}-${Date.now()}`;
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              reject(new Error("LLM \u4E2D\u7EE7\u8D85\u65F6\uFF1Aiframe \u672A\u5728\u65F6\u9650\u5185\u56DE\u586B\u7ED3\u679C"));
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
        }
      };
    }
    function resolveLlm2({ id, text, error } = {}) {
      const p = pending.get(id);
      if (!p) return { ok: false, error: `\u65E0\u5F85\u56DE\u586B\u7684\u4E2D\u7EE7\u8BF7\u6C42\uFF1A${id}` };
      clearTimeout(p.timer);
      pending.delete(id);
      if (error) p.reject(new Error(String(error)));
      else p.resolve({ text: String(text ?? "") });
      return { ok: true };
    }
    function pendingCount() {
      return pending.size;
    }
    module2.exports = {
      createRelayAi: createRelayAi2,
      resolveLlm: resolveLlm2,
      setEmitter,
      pendingCount,
      aiEventName,
      aiResultMethod,
      DEFAULT_TIMEOUT_MS
    };
  }
});

// source/worker/entry.js
var fsp = require("fs/promises");
var os = require("os");
var path = require("path");
var { execFile } = require("child_process");
var { promisify } = require("util");
var {
  buildTaskGraph: buildTaskGraph2,
  computeCredit: computeCredit2,
  inputFingerprint: inputFingerprint2,
  parseUnifiedDiff: parseUnifiedDiff2,
  RULESET: RULESET2,
  createDefaultAnalyticRegistry: createDefaultAnalyticRegistry2,
  createMemoryCache: createMemoryCache2,
  DEFAULT_LLM_CONFIG: DEFAULT_LLM_CONFIG2,
  createBitfunLlmPort: createBitfunLlmPort2,
  normalizeProfile: normalizeProfile2,
  isInitialized: isInitialized2,
  ensureKeywordEntries: ensureKeywordEntries2,
  applyPrResult: applyPrResult2,
  initProfileFromGit: initProfileFromGit2,
  syncProfileFromGit: syncProfileFromGit2
} = (init_dist2(), __toCommonJS(dist_exports));
var execFileAsync = promisify(execFile);
var DATA_DIR = path.join(os.homedir(), ".bitfun", "credit");
var PROFILE_FILE = path.join(DATA_DIR, "dev_profile.json");
var DRAFT_FILE = path.join(DATA_DIR, "dev_profile.draft.json");
var COMMIT_WARN_THRESHOLD = 40;
var { createRelayAi, resolveLlm } = require_llm_relay();
function emit(event, data) {
  try {
    if (typeof globalThis.rpcEmit === "function") globalThis.rpcEmit(event, data);
  } catch {
  }
}
var llmCache = createMemoryCache2();
function createLlmPort() {
  return createBitfunLlmPort2({
    ai: createRelayAi(),
    model: DEFAULT_LLM_CONFIG2.bitfun.model,
    fallbackModel: DEFAULT_LLM_CONFIG2.bitfun.fallbackModel,
    cache: llmCache
  });
}
async function readJsonSafe(file) {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8"));
  } catch {
    return null;
  }
}
async function writeJsonAtomic(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmp, file);
}
async function readBehaviors(prId) {
  try {
    const text = await fsp.readFile(path.join(DATA_DIR, "behaviors", `${prId}.jsonl`), "utf8");
    return text.split("\n").filter(Boolean).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}
async function readProfile() {
  return normalizeProfile2(await readJsonSafe(PROFILE_FILE));
}
function normUri2(u) {
  const s = String(u ?? "").replace(/\\/g, "/");
  if (s.startsWith("a/") || s.startsWith("b/")) return s.slice(2);
  return s;
}
async function git(args, cwd) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  return stdout;
}
function parseNumstat(out) {
  const map = /* @__PURE__ */ new Map();
  for (const line of String(out).split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("	");
    if (parts.length < 3) continue;
    const added = parts[0] === "-" ? 0 : Number(parts[0]) || 0;
    const deleted = parts[1] === "-" ? 0 : Number(parts[1]) || 0;
    let uri = parts.slice(2).join("	");
    const arrow = uri.indexOf(" => ");
    if (arrow >= 0) uri = uri.replace(/\{[^}]*=> ([^}]*)\}/, "$1").split(" => ").pop();
    map.set(normUri2(uri), { added, deleted });
  }
  return map;
}
var gitPort = {
  async diff({ cwd, base, head }) {
    const range = [base, head].filter(Boolean).join("..");
    const args = (extra) => range ? ["diff", ...extra, range] : ["diff", ...extra];
    try {
      const [numstatOut, patchOut, headOut, logOut] = await Promise.all([
        git(args(["--numstat"]), cwd),
        git(args(["-U0"]), cwd),
        git(["rev-parse", "HEAD"], cwd),
        git(["log", "--oneline"], cwd)
      ]);
      const numstat = parseNumstat(numstatOut);
      const patch = parseUnifiedDiff2(patchOut);
      const patchByUri = new Map(patch.map((p) => [normUri2(p.uri), p]));
      const files = [...numstat.entries()].map(([uri, s]) => {
        const p = patchByUri.get(uri);
        return {
          uri,
          added: s.added,
          deleted: s.deleted,
          addedLines: p?.addedLines ?? null,
          addedTexts: p?.addedTexts ?? null
        };
      });
      return {
        available: true,
        files,
        commitCount: String(logOut).split("\n").filter(Boolean).length,
        base: base ?? void 0,
        head: headOut.trim()
      };
    } catch {
      return { available: false, files: null, commitCount: 0 };
    }
  },
  async commitCount({ cwd, base, head }) {
    const range = [base, head].filter(Boolean).join("..");
    try {
      const out = await git(range ? ["log", "--oneline", range] : ["log", "--oneline"], cwd);
      return String(out).split("\n").filter(Boolean).length;
    } catch {
      return 0;
    }
  }
};
var fsPort = {
  async readFile(uri) {
    try {
      return await fsp.readFile(uri, "utf8");
    } catch {
      return null;
    }
  }
};
var analyticRegistry = createDefaultAnalyticRegistry2();
async function loadTaskGraph(prId, { force = false } = {}) {
  const cacheFile = path.join(DATA_DIR, "tasks", `${prId}.json`);
  if (!force) {
    const cached = await readJsonSafe(cacheFile);
    if (cached) return { graph: cached, cached: true };
  }
  const behaviors = await readBehaviors(prId);
  if (behaviors.length === 0) return { graph: null, cached: false };
  const graph = await buildTaskGraph2({ prId, behaviors, llm: createLlmPort() });
  await writeJsonAtomic(cacheFile, graph);
  return { graph, cached: false };
}
async function runCompute({ prId, workspaceDir, force = false }) {
  const behaviors = await readBehaviors(prId);
  if (behaviors.length === 0) return { ok: false, error: `\u65E0\u884C\u4E3A\u6570\u636E\uFF1A${prId}` };
  const { graph } = await loadTaskGraph(prId, { force: false });
  if (!graph) return { ok: false, error: `Task \u5EFA\u6A21\u5931\u8D25\uFF1A${prId}` };
  const gitDiff = workspaceDir ? await gitPort.diff({ cwd: workspaceDir }) : { available: false, files: null, commitCount: 0 };
  const profile = await readProfile();
  const fp = inputFingerprint2({ behaviors, taskGraph: graph, gitDiff, profile, prId });
  const cacheFile = path.join(DATA_DIR, "pr_credit", `${prId}.json`);
  let cacheMiss = null;
  if (!force) {
    const cached = await readJsonSafe(cacheFile);
    if (cached) {
      emit("credit:progress", {
        phase: "cache",
        hit: true,
        fpStored: cached.generator?.inputFingerprint ?? null,
        fpCurrent: fp,
        fpEqual: cached.generator?.inputFingerprint === fp
      });
      return { ok: true, result: cached, cached: true, cacheNote: "snapshot\uFF08\u5DF2\u7ED3\u7B97 PR \u4EE5\u7F13\u5B58\u4E3A\u51C6\uFF09" };
    }
  }
  const result = await computeCredit2({
    prId,
    behaviors,
    taskGraph: graph,
    llm: createLlmPort(),
    gitDiff,
    git: gitPort,
    fs: fsPort,
    profile,
    onProgress: (p) => emit("credit:progress", p)
  });
  await writeJsonAtomic(cacheFile, result);
  if (profile && !force) {
    try {
      await applyProfileFromCredit(result);
    } catch (e) {
      emit("credit:progress", { warn: `\u753B\u50CF\u589E\u91CF\u66F4\u65B0\u5931\u8D25\uFF1A${String(e?.message ?? e)}` });
    }
  }
  return { ok: true, result, cached: false, cacheMiss };
}
async function applyProfileFromCredit(result) {
  const profile = await readProfile();
  if (!profile) return { changed: false, reason: "no-profile" };
  const prId = result.prId;
  let keywords = result.profileFeed?.profileKeywords ?? null;
  if (!keywords || keywords.length === 0) {
    keywords = [];
  }
  const out = applyPrResult2(profile, {
    prId,
    ts: result.generatedAt ?? Date.now(),
    prCredit: result.summary?.prCredit ?? 0,
    creditFingerprint: result.generator?.inputFingerprint,
    feed: { profileKeywords: keywords, aiCollabLines: result.profileFeed?.aiCollabLines ?? 0 },
    keywords
  });
  if (out.changed) await writeJsonAtomic(PROFILE_FILE, out.profile);
  return out;
}
function ok(data) {
  return { ok: true, ...data };
}
function fail(error) {
  return { ok: false, error: String(error) };
}
module.exports = {
  /** LLM 中继回填（iframe → Worker；见 D-051） */
  "credit.__llmResult"(params) {
    return resolveLlm(params);
  },
  /** 指标树结构（UI 渲染与 i18n 名共用的单一事实来源） */
  "credit.getRules"() {
    return ok({ ruleSet: RULESET2 });
  },
  /** UI 展示用阈值/权重（算法 §6.2 / 架构 §7.1） */
  "credit.getConfig"() {
    return ok({
      thresholds: { commitWarning: COMMIT_WARN_THRESHOLD },
      weights: { procWeight: 0.8, devWeight: 0.2 }
    });
  },
  async "credit.listPrs"() {
    try {
      const dir = path.join(DATA_DIR, "behaviors");
      const names = await fsp.readdir(dir);
      const items = [];
      for (const f of names.filter((n) => n.endsWith(".jsonl"))) {
        const full = path.join(dir, f);
        const st = await fsp.stat(full);
        const text = await fsp.readFile(full, "utf8");
        items.push({
          prId: f.replace(/\.jsonl$/, ""),
          size: st.size,
          mtimeMs: st.mtimeMs,
          behaviorCount: text.split("\n").filter(Boolean).length
        });
      }
      items.sort((a, b) => b.mtimeMs - a.mtimeMs);
      return ok({ items });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
  async "credit.getTaskStageView"({ prId, force }) {
    if (!prId) return fail("missing prId");
    try {
      const { graph, cached } = await loadTaskGraph(prId, { force: !!force });
      if (!graph) return fail(`\u65E0\u884C\u4E3A\u6570\u636E\uFF1A${prId}`);
      return ok({ graph, cached, analytics: analyticRegistry.runAll(graph, []) });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
  async "credit.getBehaviors"({ prId, ids }) {
    if (!prId) return fail("missing prId");
    const all = await readBehaviors(prId);
    const want = Array.isArray(ids) && ids.length > 0 ? new Set(ids) : null;
    return ok({ items: want ? all.filter((b) => want.has(b.id)) : all });
  },
  async "credit.compute"({ prId, workspaceDir, force }) {
    if (!prId) return fail("missing prId");
    try {
      return await runCompute({ prId, workspaceDir, force: !!force });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
  // ── 画像域（P3 逻辑零改动，仅换宿主：fs → 原生） ──
  async "credit.getProfile"() {
    const profile = await readProfile();
    return ok({
      initialized: isInitialized2(profile),
      profile,
      draft: await readJsonSafe(DRAFT_FILE),
      hasGithubToken: !!process.env.GITHUB_TOKEN
    });
  },
  async "credit.importProfileFromGit"({ homeUrl }) {
    if (!homeUrl) return fail("\u7F3A\u5C11 homeUrl");
    try {
      const out = await initProfileFromGit2({
        homeUrl: String(homeUrl),
        token: process.env.GITHUB_TOKEN ?? null,
        fetchLike: (url, init) => fetch(url, init),
        llm: createLlmPort()
      });
      if (!out.ok) return fail(out.error);
      await writeJsonAtomic(DRAFT_FILE, out.draft);
      return ok({ digestChars: out.digestChars, requests: out.requests });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
  async "credit.confirmProfileDraft"({ profile }) {
    const draft = await readJsonSafe(DRAFT_FILE);
    if (!draft?.profile && !profile) return fail("\u65E0\u5F85\u786E\u8BA4\u8349\u7A3F");
    const p = normalizeProfile2(profile ?? draft.profile);
    if (!p) return fail("\u8349\u7A3F\u6570\u636E\u4E0D\u5408\u6CD5");
    if (!isInitialized2(p)) return fail("\u8349\u7A3F\u4E3A\u7A7A\u753B\u50CF\uFF0C\u62D2\u7EDD\u786E\u8BA4");
    await writeJsonAtomic(PROFILE_FILE, p);
    try {
      await fsp.unlink(DRAFT_FILE);
    } catch {
    }
    return ok({ gitUser: p.gitUser, keywords: p.techDomain.keywords.length });
  },
  async "credit.discardProfileDraft"() {
    try {
      await fsp.unlink(DRAFT_FILE);
    } catch {
    }
    return ok({});
  },
  async "credit.syncProfileFromGit"() {
    const profile = await readProfile();
    if (!profile) return fail("\u5C1A\u672A\u521D\u59CB\u5316\u753B\u50CF");
    try {
      const out = await syncProfileFromGit2({
        profile,
        token: process.env.GITHUB_TOKEN ?? null,
        fetchLike: (url, init) => fetch(url, init),
        llm: createLlmPort()
      });
      if (!out.ok) return fail(out.error);
      await writeJsonAtomic(PROFILE_FILE, out.profile);
      return ok({ changes: out.changes, gitStats: out.profile.gitStats, requests: out.requests });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
  /** 本地增量更新：只消费已落盘的 pr_credit，**不重算 credit**（D-041） */
  async "credit.updateProfileFromPr"({ prId }) {
    if (!prId) return fail("missing prId");
    const result = await readJsonSafe(path.join(DATA_DIR, "pr_credit", `${prId}.json`));
    if (!result) return fail(`\u65E0 pr_credit \u7ED3\u679C\uFF1A${prId}`);
    try {
      const out = await applyProfileFromCredit(result);
      return ok({ changed: out.changed, reason: out.reason });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
  async "credit.saveProfile"({ profile }) {
    const p = normalizeProfile2(profile);
    if (!p) return fail("profile \u4E0D\u5408\u6CD5");
    await writeJsonAtomic(PROFILE_FILE, p);
    return ok({});
  },
  async "credit.editProfile"({ addKeywords, removeKeywords }) {
    const profile = await readProfile();
    if (!profile) return fail("\u5C1A\u672A\u521D\u59CB\u5316\u753B\u50CF");
    const add = Array.isArray(addKeywords) ? addKeywords : [];
    const remove = new Set(
      (Array.isArray(removeKeywords) ? removeKeywords : []).map((s) => String(s).toLowerCase())
    );
    if (add.length === 0 && remove.size === 0) return fail("\u65E0\u7F16\u8F91\u5185\u5BB9");
    ensureKeywordEntries2(profile, add, "local");
    profile.techDomain.keywords = profile.techDomain.keywords.filter(
      (k) => !remove.has(String(k.name).toLowerCase())
    );
    profile.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await writeJsonAtomic(PROFILE_FILE, profile);
    return ok({ keywords: profile.techDomain.keywords.length });
  },
  // ── 提交域（M6，D-048：只 commit，push 独立） ──
  async "credit.getChangedFiles"({ workspaceDir }) {
    if (!workspaceDir) return fail("\u7F3A\u5C11 workspaceDir");
    try {
      const out = await git(["status", "--porcelain"], workspaceDir);
      const files = String(out).split("\n").filter(Boolean).map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3).trim() }));
      return ok({ files });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
  async "credit.commitAndPush"({ workspaceDir, files, message, push }) {
    if (!workspaceDir) return fail("\u7F3A\u5C11 workspaceDir");
    if (!Array.isArray(files) || files.length === 0) return fail("\u672A\u9009\u62E9\u6587\u4EF6");
    if (!message || !String(message).trim()) return fail("commit \u8BF4\u660E\u4E3A\u7A7A");
    try {
      await git(["add", "--", ...files], workspaceDir);
      await git(["commit", "-m", String(message)], workspaceDir);
      const commitHash = (await git(["rev-parse", "--short", "HEAD"], workspaceDir)).trim();
      let pushed = false;
      if (push) {
        await git(["push"], workspaceDir);
        pushed = true;
      }
      return ok({ commitHash, pushed });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  },
  async "credit.push"({ workspaceDir }) {
    if (!workspaceDir) return fail("\u7F3A\u5C11 workspaceDir");
    try {
      await git(["push"], workspaceDir);
      return ok({ pushed: true });
    } catch (e) {
      return fail(e?.message ?? e);
    }
  }
};
