/**
 * 从 Agent 的 TODO/计划类工具调用中还原"任务拆解与推进轨迹"。
 *
 * **用途**：「大型修改分阶段施行」的主证据源（算法 §3.3.1，2026-09-08 改版）。
 *
 * **为何改用这个信号**：原实现用"PR 期间 commit 数 ≥ 2"判定分阶段，
 * 与本指标的语义**直接相悖** —— 我们考察的正是**一次** commit 内部的过程是否分阶段施行，
 * 所有修改本就落在同一个 commit 里，用 commit 数判定等于恒判"未分阶段"。
 * 真正的可观测证据是：Agent 是否**主动把大任务拆成 TODO，并按步骤推进完成**。
 *
 * 实测（样例 PR）：`TodoWrite` 14 次调用，还原出 3 轮完整生命周期
 * （调研 5 步 → 实施 5~7 步 → 修复 4 步），每轮均为 pending → in_progress → completed 推进。
 */
export interface TodoItem {
  id: string;
  content: string;
  /** 原始 status 字符串 */
  status: string;
  done: boolean;
  doing: boolean;
}

export interface TodoSnapshot {
  ts: number;
  behaviorId: string;
  todos: TodoItem[];
  completedCount: number;
}

/** 宽松的行为结构：不绑定具体 Behavior 类型，便于单测构造 */
export interface ToolCallLike {
  id: string;
  ts: number;
  action?: string;
  context?: Record<string, unknown> | null;
}

const DONE = /^(completed|complete|done|finished|success)/i;
const DOING = /^(in_progress|inprogress|in-progress|doing|active|started)/i;

function normStatus(raw: unknown): { status: string; done: boolean; doing: boolean } {
  const status = String(raw ?? "pending");
  return { status, done: DONE.test(status), doing: DOING.test(status) };
}

/** toolInput 可能是 object / JSON 字符串 / 直接是数组；todos 也可能在嵌套字段里 */
function parseTodos(raw: unknown): Array<Record<string, unknown>> | null {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  // 常见形态：{todos:[...]} / {items:[...]} / {plan:[...]} / 直接是数组
  for (const key of ["todos", "items", "plan", "steps", "tasks"]) {
    if (Array.isArray(o[key])) return o[key] as Array<Record<string, unknown>>;
  }
  if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
  return null;
}

/** toolName 是否命中 TODO/计划工具表（大小写不敏感、前缀匹配） */
export function isTodoTool(toolName: string, todoTools: string[]): boolean {
  const t = String(toolName ?? "").toLowerCase();
  if (!t) return false;
  return todoTools.some((p) => {
    const q = p.toLowerCase();
    return t === q || t.startsWith(q) || t.includes(q);
  });
}

/** 按时间升序提取 TODO 快照序列 */
export function extractTodoSnapshots(
  behaviors: ToolCallLike[],
  todoTools: string[],
): TodoSnapshot[] {
  const out: TodoSnapshot[] = [];
  for (const b of behaviors) {
    const name = String(b.context?.toolName ?? "");
    if (!isTodoTool(name, todoTools)) continue;
    const todos = parseTodos(b.context?.toolInput);
    if (!todos || todos.length === 0) continue;

    const items: TodoItem[] = todos.map((t, i) => {
      const { status, done, doing } = normStatus(t.status ?? t.state);
      return {
        id: String(t.id ?? t.index ?? i),
        content: String(t.content ?? t.text ?? t.title ?? "").slice(0, 200),
        status,
        done,
        doing,
      };
    });
    out.push({
      ts: b.ts,
      behaviorId: b.id,
      todos: items,
      completedCount: items.filter((x) => x.done).length,
    });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

export interface StagedPlanSignal {
  /** 是否观测到 TODO/计划类工具调用 */
  hasTodoTool: boolean;
  /** 拆解出的最大步数 */
  maxSteps: number;
  /** TODO 快照数（= 状态更新批次数） */
  snapshots: number;
  /** 最终完成的步数 */
  finalCompleted: number;
  /** 是否满足"拆解" */
  decomposed: boolean;
  /** 是否满足"分批推进"（completed 数出现过递增，而非一次性全勾） */
  progressed: boolean;
  /** 是否按列表顺序推进（弱证据：采样频率不足时会失真，仅作 evidence） */
  inOrder: boolean;
}

export function analyzeStagedPlan(
  snapshots: TodoSnapshot[],
  opts: { minSteps: number; minSnapshots: number; minCompleted: number },
): StagedPlanSignal {
  const empty: StagedPlanSignal = {
    hasTodoTool: false,
    maxSteps: 0,
    snapshots: 0,
    finalCompleted: 0,
    decomposed: false,
    progressed: false,
    inOrder: false,
  };
  if (snapshots.length === 0) return empty;

  const maxSteps = Math.max(...snapshots.map((s) => s.todos.length));
  const finalCompleted = snapshots[snapshots.length - 1]!.completedCount;

  // 分批推进：completed 计数出现过递增
  const counts = snapshots.map((s) => s.completedCount);
  const progressed = counts.some((c, i) => i > 0 && c > counts[i - 1]!);

  // 顺序性：按 id 首次出现的顺序，检查"首次完成批次"是否单调不减
  const order: string[] = [];
  for (const s of snapshots) {
    for (const t of s.todos) if (!order.includes(t.id)) order.push(t.id);
  }
  const firstDone = new Map<string, number>();
  snapshots.forEach((s, idx) => {
    for (const t of s.todos) {
      if (t.done && !firstDone.has(t.id)) firstDone.set(t.id, idx);
    }
  });
  const batches = order.map((id) => firstDone.get(id) ?? Number.POSITIVE_INFINITY);
  const inOrder = batches.every((b, i) => i === 0 || b >= batches[i - 1]!);

  return {
    hasTodoTool: true,
    maxSteps,
    snapshots: snapshots.length,
    finalCompleted,
    decomposed: maxSteps >= opts.minSteps,
    progressed: snapshots.length >= opts.minSnapshots && progressed && finalCompleted >= opts.minCompleted,
    inOrder,
  };
}
