/**
 * TC-L5 过程行为参与（算法 §3.2.5，三项各 1/3）：
 *
 * 1. **参与设计**：Dev 亲手编辑测试文件（且该编辑不在 AI 行标记集内）
 * 2. **审阅**：测试文件被有效阅读（覆盖 ≥ 10% 或 dwell ≥ 5s）
 * 3. **增补**：Dev 在 AI 生成测试之后新增了测试函数
 *
 * `score = 命中数 / 3 × 100`。三项全空 → ok(0)（有测试活动但零参与）。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR } from "./helpers.js";
import { traceOf } from "../shared/reading.js";
import { isTestUri } from "../shared/spec-docs.js";

const TEST_FN = /(test\s*\(|it\s*\(|def\s+test_|func\s+Test|#\[test\])/i;

export async function testPlanTcL5(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const testUris = new Set(ctx.testUris());
  const cd = ctx.coreDiff();
  const idx = ctx.reading();
  const cfg = ctx.config.review;

  // ① 参与设计：Dev 编辑测试文件，且该行不在 AI 行集内
  let designed = false;
  for (const b of ctx.behaviors) {
    if (b.action !== "edit" || b.actor !== "dev") continue;
    const uri = b.object?.kind === "file" ? b.object.uri : undefined;
    if (!uri || !isTestUri(uri)) continue;
    const aiSet = new Set(cd.aiLines[uri] ?? []);
    const lr = b.object?.lineRange;
    const inAi =
      Array.isArray(lr) && lr.length === 2
        ? aiSet.has(Number(lr[0]))
        : false;
    if (!inAi) {
      designed = true;
      break;
    }
  }

  // ② 审阅
  let reviewed = false;
  for (const uri of testUris) {
    const t = traceOf(idx, uri);
    const total = Math.max(1, t.readLines.length > 0 ? t.readLines[t.readLines.length - 1]! : 0);
    if (t.readLines.length / total >= cfg.testCoverageRatio || t.dwellMs >= cfg.testDwellMs) {
      reviewed = true;
      break;
    }
  }

  // ③ 增补：AI 生成测试之后，Dev 编辑的内容含测试函数签名
  const aiTestEdits = ctx.behaviors
    .filter(
      (b) =>
        (b.action === "edit" && b.actor === "ai") ||
        (b.action === "agent.tool" && /^(write|edit|multiedit)$/i.test(String(b.context?.toolName ?? ""))),
    )
    .map((b) => b.ts)
    .sort((a, b) => a - b);

  let supplemented = false;
  if (aiTestEdits.length > 0) {
    const first = aiTestEdits[0]!;
    for (const b of ctx.behaviors) {
      if (b.action !== "edit" || b.actor !== "dev" || b.ts <= first) continue;
      const after = String(b.context?.after ?? "");
      const lr = b.object?.lineRange;
      const nearTestFile =
        (b.object?.kind === "file" && b.object.uri && testUris.has(b.object.uri)) ||
        (Array.isArray(lr) && (cd.aiLines[b.object?.uri ?? ""] ?? []).length > 0);
      if (nearTestFile && TEST_FN.test(after)) {
        supplemented = true;
        break;
      }
    }
  }

  const hit = [designed, reviewed, supplemented].filter(Boolean).length;
  const evidence: Evidence[] = [
    { kind: "note", text: `参与设计：${designed ? "命中" : "未命中"}` },
    { kind: "note", text: `审阅测试：${reviewed ? "命中" : "未命中"}` },
    { kind: "note", text: `AI 生成后增补：${supplemented ? "命中" : "未命中"}` },
  ];

  return okR(id, Number(((hit / 3) * 100).toFixed(2)), `三项参与行为命中 ${hit}/3`, evidence);
}
