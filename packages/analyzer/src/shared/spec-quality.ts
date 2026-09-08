/**
 * SPEC 质量的**共享 LLM 判定**（算法 §1.1「共享中间产物懒加载、一次计算多指标复用」）。
 *
 * **为何合并**：完整性 / 一致性 / 可验证性三者**都只需要 SPEC 全文**，
 * 拆成三次调用意味着同一份文档要上传三遍 ——
 * 实测合计 11060 tokens（占全量 46%），其中三分之二是重复传输。
 * 改为一次调用输出三组判定，三个计算器各自消费。
 *
 * 注意：无歧义性（unambiguity）是**纯规则扫描**，不在此列，不消耗 LLM。
 */
import type { SpecDoc } from "../credit/types.js";
import type { LlmPort } from "../llm/port.js";
import { llmJson } from "./llm-json.js";
import { stripCodeBlocks } from "./spec-docs.js";

export interface SpecQualityJudgement {
  ok: boolean;
  /** 完整性：六维覆盖判定 */
  dims: Array<{ dim?: string; present?: boolean; quote?: string }>;
  /** 一致性：互相矛盾的条款对 */
  conflicts: Array<{ pair?: string; reason?: string }>;
  /**
   * 可验证性：三条件**全满足**的条目 id 列表 + 模型看到的条目总数。
   *
   * **刻意不要求逐条输出判定**：实测让模型输出 31 个条目的四字段对象，
   * 输出 token 成为瓶颈 —— 单次调用耗时 **309 秒**。而本指标真正需要的
   * 只是"全满足数 / 总数"，让模型只回 id 数组即可，语义等价且省一大截输出。
   */
  verifiability: { verifiableIds: string[]; itemCount: number };
  error?: string;
}

const SYS = `你是 SPEC 质量评审助手。下面是一份 SPEC 文档全文，请**同时**完成三项评审：

1. **完整性**（dims）：按六个维度判断是否覆盖 —— 目标、范围、主路径、边界、错误路径、非功能约束；
2. **一致性**（conflicts）：找出**互相矛盾**的条款对（必须 A vs 必须 B、范围/默认值冲突），
   没有就输出空数组，**不要把"表述不同但含义一致"算作冲突**；
3. **可验证性**（verifiability）：对每个条目（用 R1/R2… 标识）判断是否**同时**满足三个条件 ——
   写明可判定的验收标准、含可量化指标（数值/阈值/时延/覆盖率）、能对应具体测试用例。
   **只列出三个条件全满足的条目 id**，并给出你看到的条目总数。

只输出 json，字段名**必须严格如下**，不要改名：
{"dims":[{"dim":"目标","present":true,"quote":"..."}],"conflicts":[{"pair":"R1|R3","reason":"..."}],"verifiability":{"verifiableIds":["R1","R3"],"itemCount":31}}`;

/**
 * 解析可验证性。容忍三种形态：
 * - 规范：`{"verifiability":{"verifiableIds":[...],"itemCount":N}}`
 * - 模型拍平：`{"verifiableIds":[...],"itemCount":N}`
 * - 模型改回逐条判定：`{"items":[{"id":"R1","hasAcceptance":true,...}]}`（旧形态兜底）
 */
function parseVerifiability(data: unknown): { verifiableIds: string[]; itemCount: number } {
  const rec = (data ?? {}) as Record<string, unknown>;
  const v = rec.verifiability;

  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const ids = Array.isArray(o.verifiableIds) ? o.verifiableIds.map(String) : [];
    return { verifiableIds: ids, itemCount: Number(o.itemCount ?? ids.length) || ids.length };
  }
  if (Array.isArray(rec.verifiableIds)) {
    const ids = rec.verifiableIds.map(String);
    return { verifiableIds: ids, itemCount: Number(rec.itemCount ?? ids.length) || ids.length };
  }
  // 旧形态兜底：逐条判定里挑三条件全满足的
  const items = pickArray(data, ["items", "verifiability", "clauses"]);
  const ids = items
    .filter((i) => i.hasAcceptance && i.isQuantified && i.hasTestMapping)
    .map((i) => String(i.id ?? ""));
  return { verifiableIds: ids, itemCount: items.length || ids.length };
}

/** 容忍字段名被模型改名 */
function pickArray(data: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (!data || typeof data !== "object") return [];
  const rec = data as Record<string, unknown>;
  for (const k of keys) {
    if (Array.isArray(rec[k])) return rec[k] as Array<Record<string, unknown>>;
  }
  return [];
}

export async function buildSpecQuality(args: {
  specs: SpecDoc[];
  llm: LlmPort;
  /** 用于可验证性逐条判定的条目 id 列表 */
  itemIds: string[];
}): Promise<SpecQualityJudgement> {
  const empty: SpecQualityJudgement = {
    ok: false,
    dims: [],
    conflicts: [],
    verifiability: { verifiableIds: [], itemCount: 0 },
  };
  const content = args.specs.map((s) => s.content).join("\n\n");
  if (!content.trim()) return { ...empty, error: "SPEC 内容为空" };

  const specText = stripCodeBlocks(content).slice(0, 8000);

  const r = await llmJson<unknown>(args.llm, {
    metricId: "spec-quality",
    // **v2**：输出结构变了（逐条判定 → 只回全满足 id 列表），必须升版使旧缓存失效
    templateId: "spec-quality-v2",
    system: SYS,
    user: `下面是 SPEC 文档全文，请完成完整性 / 一致性 / 可验证性三项评审。
条目标识为 ${args.itemIds.slice(0, 40).join(", ") || "R1, R2, …"}。

=== SPEC 开始 ===
${specText}
=== SPEC 结束 ===`,
    schema: { type: "object" },
  });

  if (!r.ok || !r.data) return { ...empty, error: r.rationale };

  return {
    ok: true,
    dims: pickArray(r.data, ["dims", "dimensions", "completeness"]).map((d) => ({
      dim: String(d.dim ?? d.name ?? ""),
      present: Boolean(d.present ?? d.covered),
      quote: d.quote == null ? undefined : String(d.quote),
    })),
    conflicts: pickArray(r.data, ["conflicts", "contradictions", "inconsistencies"]).map((c) => ({
      pair: String(c.pair ?? ""),
      reason: String(c.reason ?? ""),
    })),
    verifiability: parseVerifiability(r.data),
  };
}
