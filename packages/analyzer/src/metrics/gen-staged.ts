/**
 * 大型修改分阶段施行（算法 §3.3.1，binary）—— **2026-09-08 改版**。
 *
 * ## 为何改版
 *
 * 原实现用"PR 期间 commit 数 ≥ 2"判定分阶段。这与本指标语义**直接相悖**：
 * 我们考察的正是**一次 commit 内部**的实施过程是否分阶段进行，而所有修改本就落在
 * 同一个 commit 里 —— 用 commit 数判定等于**恒判"未分阶段"**。
 *
 * ## 新判据
 *
 * 看 Agent 是否**把大任务拆解成 TODO/步骤，并在实施时按拆解逐步推进**：
 *
 * 1. **拆解**：TODO 项数 ≥ `minSteps`（默认 2）—— 拆成了多步；
 * 2. **分步施行**：TODO 状态更新批次 ≥ `minSnapshots` 且完成数出现过递增，
 *    最终完成 ≥ `minCompleted` —— 说明是**一步步做完的**，而非"列出清单后一次性全勾"。
 *
 * 证据源是 Agent 的 TODO/计划类工具（`TodoWrite` 等，工具名 config-driven 以兼容多平台），
 * 从 `toolInput.todos` 还原每轮快照。实测样例 PR：14 次 `TodoWrite`，还原出 3 轮完整生命周期
 * （调研 5 步 → 实施 5~7 步 → 修复 4 步），均为 pending → in_progress → completed 推进。
 *
 * **刻意不用 TaskGraph**：P2-pre 切出的 Task 是**事后算法切分**，不是 Agent 的主动拆解，
 * 用它判定会形成循环论证（"我们切出了多个 Task，所以判定为分阶段施行"）。
 *
 * ## 降级路径
 *
 * - git 不可用 → degraded（无法判定改动规模）；
 * - 无 TODO 工具轨迹，但 AI 在对话中输出了分步计划 → degraded（**有拆解但无法验证施行**）；
 * - 完全无拆解证据 → 0。
 */
import type { RuleNode } from "@credit/rules";
import type { MetricContext } from "../credit/context.js";
import type { MetricResult, Evidence } from "../credit/types.js";
import { okR, degradedR } from "./helpers.js";
import {
  extractTodoSnapshots,
  analyzeStagedPlan,
  type ToolCallLike,
} from "../shared/todo-plan.js";

/**
 * 结构化步骤标记：`步骤1`/`阶段一`/`Step 2`/`Phase 3` 标题、markdown 勾选框、有序列表。
 * 命中 ≥ 2 处才认为"输出了分步计划"（单处命中通常是行文顺带提及）。
 */
const STEP_PATTERN =
  /(?:(?:^|\n)\s*(?:#{1,6}\s*)?(?:步骤|阶段|Step|Phase)\s*[0-9一二三四五六七八九十]+)|(?:(?:^|\n)\s*[-*]\s*\[[ xX]\])|(?:(?:^|\n)\s*[0-9]+[.、)]\s+\S)/g;

export async function genStaged(ctx: MetricContext, node: RuleNode): Promise<MetricResult> {
  const id = node.id;
  const gd = ctx.gitDiff;

  if (!gd.available || !gd.files) {
    return degradedR(ctx, id, "git diff 不可用，无法判定改动规模");
  }

  const totalLines = gd.files.reduce((s, f) => s + f.added + f.deleted, 0);
  const threshold = ctx.config.diff.largeChangeThreshold;
  const cfg = ctx.config.stagedPlan;
  const scaleNote: Evidence = {
    kind: "note",
    text: `改动规模 ${totalLines} 行（阈值 ${threshold}）`,
  };

  // 小改动：不适用本指标，视为通过
  if (totalLines <= threshold) {
    return okR(id, 100, `改动 ${totalLines} 行 ≤ 阈值 ${threshold}，不适用分阶段要求`, [
      scaleNote,
    ]);
  }

  // ① 主信号：TODO/计划类工具的拆解与推进轨迹
  const snapshots = extractTodoSnapshots(
    ctx.behaviors as unknown as ToolCallLike[],
    cfg.todoTools,
  );
  const sig = analyzeStagedPlan(snapshots, cfg);

  if (sig.hasTodoTool) {
    const passed = sig.decomposed && sig.progressed;
    const evidence: Evidence[] = [
      scaleNote,
      {
        kind: "note",
        text:
          `TODO 轨迹：${sig.snapshots} 次更新，最多拆 ${sig.maxSteps} 步，` +
          `最终完成 ${sig.finalCompleted} 步${sig.inOrder ? "（按列表顺序推进）" : ""}`,
      },
      ...snapshots.slice(0, 3).map<Evidence>((s) => ({
        kind: "behavior",
        ids: [s.behaviorId],
        label: `TODO 更新：${s.todos.filter((t) => t.done).length}/${s.todos.length} 步完成`,
      })),
    ];
    return okR(
      id,
      passed ? 100 : 0,
      passed
        ? `大改动拆解为 ${sig.maxSteps} 步，并分批推进完成 ${sig.finalCompleted} 步`
        : `未达分阶段施行：拆解 ${sig.maxSteps} 步 / 更新 ${sig.snapshots} 批 / 完成 ` +
            `${sig.finalCompleted} 步（要求拆 ≥${cfg.minSteps} 步，且分批完成 ≥${cfg.minCompleted} 步）`,
      evidence,
    );
  }

  // ② 回退：AI 在对话中输出过分步计划 —— 有拆解但无法验证施行 → degraded
  if (hasPlanSteps(ctx)) {
    return degradedR(
      ctx,
      id,
      "AI 输出了分步计划，但未观测到 TODO 推进轨迹，无法确认是否按步骤施行",
      [scaleNote],
    );
  }

  // ③ 完全无拆解证据
  return okR(id, 0, `大改动（${totalLines} 行）未见任务拆解与分步施行证据`, [
    scaleNote,
    { kind: "note", text: "无 TODO/计划类工具调用，对话中也未检出分步计划" },
  ]);
}

/**
 * AI 是否在对话里输出过分步计划。
 *
 * **只看 `agent.message`（AI 的发言）**：SPEC/plan 文档天然带有步骤标题，
 * 若把文档算进去，几乎任何有 SPEC 的 PR 都会命中 —— 那不表示"实施时"分阶段。
 */
function hasPlanSteps(ctx: MetricContext): boolean {
  for (const b of ctx.behaviors) {
    if (b.action !== "agent.message") continue;
    const text = String(b.context?.promptText ?? b.context?.output ?? "");
    if ((text.match(STEP_PATTERN) ?? []).length >= 2) return true;
  }
  return false;
}
