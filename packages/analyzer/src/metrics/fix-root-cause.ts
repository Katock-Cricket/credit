/**
 * 审阅修复Diff并区分根因（算法 §3.5.3，ordinal 三档）：
 * 未审阅 → 0；浏览但未区分 → 50；区分根因 vs 症状 → 100。
 *
 * 无修复 Accept 时（对话式修复），以"修复后对相关文件的阅读"替代。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, ordinal } from "./helpers.js";
import { traceOf } from "../shared/reading.js";

const ROOT_CAUSE =
  /根因|根本原因|治标不治本|绕过|只是.{0,6}(补丁|patch)|root\s*cause|workaround|治本/i;

export async function fixRootCause(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;

  // 修复相关的文件：修复阶段 Task 涉及的文件，或所有被 AI 编辑过的文件
  const fixFiles = new Set<string>();
  for (const t of ctx.tasks()) {
    const isFix = t.stage === "ai-fix" || t.spans.some((s) => s.stage === "ai-fix");
    if (isFix) for (const f of t.files) fixFiles.add(f.uri);
  }
  if (fixFiles.size === 0) {
    for (const uri of Object.keys(ctx.coreDiff().aiLines)) fixFiles.add(uri);
  }

  // ① 是否审阅
  const idx = ctx.reading();
  let reviewed = false;
  const evidence: Evidence[] = [];
  for (const uri of fixFiles) {
    const t = traceOf(idx, uri);
    if (t.dwellMs > 0 || t.readLines.length > 0) {
      reviewed = true;
      evidence.push({
        kind: "file",
        uris: [uri],
        lines: t.readLines.slice(0, 30),
        label: `审阅修复文件 ${uri}（停留 ${(t.dwellMs / 1000).toFixed(1)}s）`,
      });
    }
  }

  if (!reviewed) {
    return okR(id, ordinal(ctx, "threeTier", 0), "修复产物未被审阅", evidence);
  }

  // ② 是否区分根因
  const discussed = ctx.prompts().filter((t) => ROOT_CAUSE.test(t.promptText));
  if (discussed.length > 0) {
    for (const t of discussed.slice(0, 3)) {
      evidence.push({ kind: "prompt", ids: [t.id], text: t.promptText.slice(0, 300) });
    }
    return okR(id, ordinal(ctx, "threeTier", 2), "审阅了修复 Diff 并讨论了根因", evidence);
  }

  return okR(id, ordinal(ctx, "threeTier", 1), "浏览了修复 Diff，但未区分根因与症状", evidence);
}
