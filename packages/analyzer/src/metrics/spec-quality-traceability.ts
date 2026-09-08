/**
 * SPEC质量·可追踪性（算法 §3.1.5⑤）：复用 C7 的三段链。
 *
 * ```
 * SPEC条目 → Task → Diff文件 → 测试用例
 * 每段算 Forward（源端有后继的比例）与 Backward（目标端有前驱的比例）
 * score = (Π F_i × B_i) ^ (1 / (2 × 段数)) × 100
 * ```
 * 缺失的段不参与几何平均；**全部段缺失 → excluded**（而非 0 分，避免误伤）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, excludedR } from "./helpers.js";

const ratio = (hit: number, total: number): number | null =>
  total > 0 ? hit / total : null;

export async function specQualityTraceability(
  ctx: MetricContext,
  node: RuleNode,
): Promise<MetricResult> {
  const id = node.id;
  const specs = await ctx.specDocs();
  if (specs.length === 0) return excludedR(id, "无 SPEC 文档");

  const m = await ctx.rtm();
  const tasks = ctx.tasks();
  const diffFiles = ctx.gitDiff.files?.map((f) => f.uri) ?? [];

  const factors: number[] = [];
  const evidence: Evidence[] = [];
  let segs = 0;

  // ── 段 1：SPEC条目 → Task ──
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
      text: `SPEC→Task：正向 ${mappedSpec}/${specIds.length}，反向 ${taskWithSpec}/${tasks.length}`,
    });
  }

  // ── 段 2：Task → Diff文件 ──
  const diffSet = new Set(diffFiles.map((u) => u.replace(/\\/g, "/").toLowerCase()));
  let taskWithDiff = 0;
  const diffWithTask = new Set<string>();
  for (const t of tasks) {
    const hit = t.files.filter((f) => diffSet.has(f.uri.replace(/\\/g, "/").toLowerCase()));
    if (hit.length > 0) {
      taskWithDiff++;
      for (const h of hit) diffWithTask.add(h.uri);
    }
  }
  const f2 = ratio(taskWithDiff, tasks.length);
  const b2 = ratio(diffWithTask.size, diffFiles.length);
  if (f2 != null && b2 != null) {
    factors.push(f2, b2);
    segs++;
    evidence.push({
      kind: "note",
      text: `Task→Diff：正向 ${taskWithDiff}/${tasks.length}，反向 ${diffWithTask.size}/${diffFiles.length}`,
    });
  }

  // ── 段 3：Diff文件 → 测试 ──
  const diffWithTest = Object.values(m.diffToTest).filter((v) => v.length > 0).length;
  const testWithDiff = new Set(Object.values(m.diffToTest).flat()).size;
  const f3 = ratio(diffWithTest, diffFiles.length);
  const b3 = ratio(testWithDiff, m.testCases.length);
  if (f3 != null && b3 != null) {
    factors.push(f3, b3);
    segs++;
    evidence.push({
      kind: "note",
      text: `Diff→测试：正向 ${diffWithTest}/${diffFiles.length}，反向 ${testWithDiff}/${m.testCases.length}`,
    });
  }

  if (segs === 0 || factors.length === 0) {
    return excludedR(id, "三段追溯链均无数据（无 Task、无 Diff 或无测试用例）");
  }

  const product = factors.reduce((a, b) => a * b, 1);
  const score = Math.pow(product, 1 / factors.length) * 100;

  return okR(
    id,
    Number(score.toFixed(2)),
    `${segs} 段追溯链的几何平均（含正向/反向共 ${factors.length} 个因子）`,
    evidence,
  );
}
