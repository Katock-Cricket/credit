/**
 * SPEC质量·一致性（算法 §3.1.5②）：内部矛盾（LLM）+ 外部冲突（规则）。
 *
 * - 内部：条款两两配对，LLM 输出矛盾对；`contradictionRatio = 矛盾对 / 检测对`
 *   （条款 > 15 时只配同章节 + 相邻章节，控制 LLM 输入量）
 * - 外部：SPEC 中声明的技术栈/依赖 vs 仓库 manifest，规则比对
 *   `violationRatio = 未声明数 / 比对总数`（比对数为 0 则不参与）
 * - `score = (1 − max(两者)) × 100`
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { clamp01to100 } from "../shared/llm-json.js";
import { okR, excludedR } from "./helpers.js";

/**
 * 一致性 = **内部矛盾（共享 LLM 判定）** + 外部冲突（纯规则，比对 manifest）。
 *
 * **内部矛盾不再单独调 LLM**：v1 是"条款两两配对"逐对比较 —— n 个条目 → O(n²) 组，
 * 且每组都重复携带条款文本，实测 31 条目 → 24 组 → **19538 字符（≈9.7k tokens）**，
 * 是全部调用中最大的一笔，其中绝大部分是同一批文本的重复拷贝。
 * 现与完整性、可验证性**共用一次全文调用**（`shared/spec-quality.ts`），本指标只消费 `conflicts`。
 */

/** 从 SPEC 文本提取依赖声明（包名@版本 / import from / use crate） */
function extractDecls(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(/([@a-z0-9][\w.@/-]{2,40})@(\d+\.\d+[\w.-]*)/gi)) out.add(m[1]!);
  for (const m of content.matchAll(/\bfrom\s+["']([\w@][\w@/.-]*)["']/g)) out.add(m[1]!);
  for (const m of content.matchAll(/require\(["']([\w@][\w@/.-]*)["']\)/g)) out.add(m[1]!);
  return [...out];
}

const MANIFESTS = ["package.json", "Cargo.toml", "requirements.txt", "pyproject.toml", "go.mod"];

async function readManifests(ctx: MetricContext): Promise<string> {
  if (!ctx.fs) return "";
  // 从 SPEC 所在目录逐级向上找 manifest
  const dirs = new Set<string>();
  for (const doc of await ctx.specDocs()) {
    const parts = doc.uri.replace(/\\/g, "/").split("/");
    for (let i = parts.length - 1; i >= Math.max(0, parts.length - 4); i--) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  const chunks: string[] = [];
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

export async function specQualityConsistency(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return excludedR(id, "无 SPEC 文档");

  const items = specs.flatMap((s) => s.items);
  const evidence: Evidence[] = [];

  // ── 内部矛盾（消费共享判定，与完整性/可验证性共用一次调用）──
  let contradictionRatio = 0;
  if (items.length >= 2) {
    const q = await ctx.specQuality();
    if (q.ok) {
      /**
       * 归一化基准用**条目数**：v1 曾以"检测对数"为分母，而对数随条目数变化
       * （且被 |i-j|≤3 截断），导致同一份 SPEC 在不同 n 下比率不可比。
       */
      contradictionRatio = Math.min(1, q.conflicts.length / Math.max(1, items.length));
      for (const c of q.conflicts.slice(0, 5)) {
        evidence.push({
          kind: "llm",
          templateId: "spec-quality-v2",
          rationale: `内部矛盾 ${c.pair || "?"}：${String(c.reason ?? "").slice(0, 120)}`,
        });
      }
    } else {
      evidence.push({ kind: "note", text: `内部矛盾检测未完成：${q.error ?? "未知原因"}` });
    }
  }

  // ── 外部冲突（规则） ──
  let violationRatio: number | null = null;
  const manifest = await readManifests(ctx);
  if (manifest) {
    const decls = extractDecls(specs.map((s) => s.content).join("\n"));
    if (decls.length > 0) {
      const missing = decls.filter((d) => !manifest.toLowerCase().includes(d.toLowerCase()));
      violationRatio = missing.length / decls.length;
      if (missing.length > 0) {
        evidence.push({
          kind: "note",
          text: `SPEC 声明的依赖未在 manifest 中找到：${missing.slice(0, 5).join(", ")}`,
        });
      }
    }
  }

  const worst = Math.max(contradictionRatio, violationRatio ?? 0);
  const detail =
    violationRatio == null
      ? `内部矛盾率 ${(contradictionRatio * 100).toFixed(0)}%（外部冲突：无 manifest 可比对，不参与）`
      : `内部矛盾率 ${(contradictionRatio * 100).toFixed(0)}%，外部冲突率 ${(violationRatio * 100).toFixed(0)}%`;

  return okR(id, clamp01to100((1 - worst) * 100), detail, evidence);
}
