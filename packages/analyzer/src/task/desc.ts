/**
 * Task.Desc 生成（P2-pre T4，SPEC §4.4；决策 D-018 修订 + D-023）。
 *
 * **核心**：主切分信号是 `promptSubmitted`，而 **Dev 的 prompt 本身就是用户用
 * 自然语言写下的目标描述**。因此 **LLM 的输入必须包含 prompt 原文** —— LLM 的作用
 * 不是凭空生成，而是在"用户第一手意图 + 行为上下文"之上做归纳与补全。
 *
 * **降级链**（LLM 优先，规则兜底）：
 * - L0 LLM(prompt 原文 + behaviorSummary) → `descSource: 'llm'`
 * - L1 LLM(agent.message + behaviorSummary) → `'llm'`
 * - L2 LLM(仅 behaviorSummary) → `'llm'`
 * - L3 prompt 原文截断 → `'prompt'`
 * - L4 agent.message 首句 → `'agent-message'`
 * - L5 无可得 → `desc = null`，`'rule'`
 */
import type { LlmPort } from "../llm/port.js";
import { mergeTaskConfig, type TaskConfig } from "./config.js";
import type { DescSource, StageId, TaskType } from "./types.js";

/** 宿主注入的上下文块（喂 LLM 前剥离，否则占大量 token 且无语义） */
const INJECTED_BLOCK = /\[(?:Directory|File|SelectedText|Attachment|Context):[^\]]*\]/gi;

/**
 * 系统生成的固定模板 prompt（用户不可编辑，对归纳无价值）。
 * 命中时以语义化标签替代 —— 样例中 review 的 4 条 prompt 均属此类。
 */
const SYSTEM_TEMPLATES: ReadonlyArray<{ re: RegExp; label: string }> = [
  {
    re: /^perform an independent adversarial review/i,
    label: "执行 AI Review",
  },
  {
    re: /the user approved remediation for selected review findings/i,
    label: "选择性采纳 Review 意见并授权修复",
  },
  {
    re: /the user approved remediation for all review findings/i,
    label: "全盘采纳 Review 意见并授权修复",
  },
  {
    re: /the user dismissed all review findings/i,
    label: "驳回全部 Review 意见",
  },
];

export interface CleanedPrompt {
  /** 清洗后的文本（系统模板时为空串） */
  text: string;
  systemTemplate: boolean;
  /** 系统模板的语义化标签 */
  templateLabel: string | null;
}

/** 清洗 prompt：剥离注入上下文块、识别系统模板、截断 */
export function cleanPrompt(raw: string | null | undefined, maxChars: number): CleanedPrompt {
  if (typeof raw !== "string" || !raw.trim()) {
    return { text: "", systemTemplate: false, templateLabel: null };
  }
  const stripped = raw.replace(INJECTED_BLOCK, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return { text: "", systemTemplate: false, templateLabel: null };

  for (const t of SYSTEM_TEMPLATES) {
    if (t.re.test(stripped)) {
      return { text: "", systemTemplate: true, templateLabel: t.label };
    }
  }
  const text =
    stripped.length > maxChars ? `${stripped.slice(0, maxChars)}…` : stripped;
  return { text, systemTemplate: false, templateLabel: null };
}

/** 取首句（L1/L4 用） */
function firstSentence(text: string, maxChars: number): string {
  const m = text.match(/^[^。！？\n.!?]{0,200}[。！？.!?]?/);
  let s = (m?.[0] ?? text).trim();
  if (s.length > maxChars) s = `${s.slice(0, maxChars)}…`;
  return s || text.slice(0, maxChars);
}

export interface DescTaskInput {
  taskId: string;
  /** 清洗后的 prompt 文本（系统模板为 ""） */
  promptText: string;
  systemTemplate: boolean;
  templateLabel: string | null;
  agentMessage: string | null;
  behaviorSummary: string;
  files: string[];
  stage: StageId;
}

export interface DescResult {
  desc: string | null;
  taskType: TaskType | null;
  source: DescSource;
}

/** 规则降级（L3–L5） */
export function fallbackDesc(input: DescTaskInput, cfg: TaskConfig): DescResult {
  // L3：系统模板 → 语义标签；普通 prompt → 原文（截断）
  if (input.systemTemplate && input.templateLabel) {
    return { desc: input.templateLabel, taskType: "review", source: "prompt" };
  }
  if (input.promptText) {
    const desc =
      input.promptText.length > cfg.descMaxChars
        ? `${input.promptText.slice(0, cfg.descMaxChars)}…`
        : input.promptText;
    return { desc, taskType: null, source: "prompt" };
  }
  // L4：AI 消息首句
  if (input.agentMessage) {
    return {
      desc: firstSentence(input.agentMessage, cfg.descMaxChars),
      taskType: null,
      source: "agent-message",
    };
  }
  // L5：仅行为摘要可用，Desc 置空
  return { desc: null, taskType: null, source: "rule" };
}

const SYSTEM_PROMPT = `你是软件工程过程分析助手。下面给出一次 PR 中若干"工作片段"的观测信息，请为每个片段归纳一句目标描述。

要求：
1. desc：不超过 30 个中文字符，动宾结构，说明这个片段**想做什么**；不要罗列文件名，不要复述命令原文。
2. taskType：从 feature / fix / test / docs / refactor / spec / review / unknown 中选一个。
3. prompt 字段是开发者当时对 AI 说的话，是判断意图的第一手依据，请优先依据它；systemLabel 是系统自动填充的模板，语义以它为准。
4. 若信息不足，desc 仍给出最贴切的表述，taskType 用 unknown；**不要留空、不要编造未出现的内容**。

严格输出 JSON，不要任何额外文字：
{"tasks":[{"id":"T1","desc":"...","taskType":"feature"}]}`;

/** 单次批量调用的 payload 结构（同时用作缓存键输入） */
interface DescPayload {
  id: string;
  prompt: string | null;
  systemLabel: string | null;
  agentMessage: string | null;
  summary: string;
  files: string[];
  stage: StageId;
}

function toPayload(t: DescTaskInput): DescPayload {
  return {
    id: t.taskId,
    prompt: t.systemTemplate ? null : t.promptText || null,
    systemLabel: t.systemTemplate ? t.templateLabel : null,
    agentMessage: t.agentMessage ? t.agentMessage.slice(0, 400) : null,
    summary: t.behaviorSummary,
    files: t.files.slice(0, 5),
    stage: t.stage,
  };
}

export interface DescBatchResult {
  results: Map<string, DescResult>;
  llmCalls: number;
  fallbackCount: number;
}

/**
 * 批量生成 Desc 与 taskType。
 *
 * **永不抛异常**：LLM 失败（任意原因）时整批退到规则降级，调用方无感。
 */
export async function generateDescs(
  inputs: DescTaskInput[],
  llm: LlmPort,
  cfgOverride?: Partial<TaskConfig>,
): Promise<DescBatchResult> {
  const cfg = mergeTaskConfig(cfgOverride);
  const results = new Map<string, DescResult>();
  let llmCalls = 0;
  let fallbackCount = 0;

  if (inputs.length === 0) return { results, llmCalls, fallbackCount };

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

    let ok = false;
    try {
      const r = await llm.complete({
        metricId: "task-desc",
        templateId: "task-desc-v1",
        system: SYSTEM_PROMPT,
        user: JSON.stringify({ tasks: payload }),
        input: { tasks: payload },
        schema: { type: "object", required: ["tasks"] },
      });
      llmCalls++;
      if (r.ok) {
        const parsed = r.json as { tasks?: Array<{ id?: string; desc?: string; taskType?: string }> };
        const arr = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
        const byId = new Map(arr.filter((x) => x?.id).map((x) => [String(x.id), x]));
        for (const t of batch) {
          const hit = byId.get(t.taskId);
          const desc = typeof hit?.desc === "string" && hit.desc.trim() ? hit.desc.trim() : null;
          if (desc) {
            results.set(t.taskId, {
              desc,
              taskType: (hit?.taskType as TaskType) ?? null,
              source: "llm",
            });
          } else {
            results.set(t.taskId, fallbackDesc(t, cfg));
            fallbackCount++;
          }
        }
        ok = true;
      }
    } catch {
      // 落入下方兜底
    }

    if (!ok) {
      for (const t of batch) {
        results.set(t.taskId, fallbackDesc(t, cfg));
        fallbackCount++;
      }
    }
  }

  return { results, llmCalls, fallbackCount };
}
