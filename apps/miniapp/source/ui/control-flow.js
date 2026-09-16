/**
 * Control Tab 四视图状态机（P4 · 决策 D-047）。
 *
 * 顶层三 Tab 不变（Control / History PRs / Developer Profile）；本模块只负责
 * **Control Tab 内部** `home → result → evidence → commit` 的可见视图判定：
 * 由会话状态 + 是否已有计算结果驱动。
 *
 * 纯函数、无 DOM —— 便于单测（AGENTS §3-R1.3）。
 */

export const CONTROL_VIEWS = ["home", "result", "evidence", "commit"];

/** 需要已有计算结果才可达的视图 */
const RESULT_DEPENDENT = ["result", "evidence", "commit"];

/** 该状态下允许出现的视图集合 */
export function allowedControlViews({ hasResult } = {}) {
  return hasResult ? ["home", ...RESULT_DEPENDENT] : ["home"];
}

/** 会话是否处于"进行中"（此时应停留在 home 展示状态与进度） */
export function isSessionBusy(sessionState) {
  return sessionState === "recording" || sessionState === "computing";
}

/**
 * 决定 Control Tab 当前应显示的视图。
 *
 * 优先级：
 * 1. 显式 `requested` 且被允许 → 采用（用户点击/流程跳转）；
 * 2. 会话 recording → `home`（正在采集，进度与状态优先）；
 * 3. 无结果 → `home`；
 * 4. 保留了合法的 `current` → 停留（避免重渲染时视图跳动）；
 * 5. 兜底 → `result`。
 */
export function resolveControlView({ sessionState, hasResult, current, requested } = {}) {
  const allowed = allowedControlViews({ hasResult });
  if (requested && allowed.includes(requested)) return requested;
  if (sessionState === "recording") return "home";
  if (!hasResult) return "home";
  if (current && allowed.includes(current)) return current;
  return "result";
}

/**
 * 会话状态 → 主操作按钮可用性（home 视图）。
 * `finish` 需在 recording 中；`reset` 需存在会话；`start` 仅 idle 可用。
 */
export function homeActions({ sessionState } = {}) {
  const hasSession = !!sessionState && sessionState !== "idle";
  return {
    canStart: !hasSession,
    canFinish: sessionState === "recording",
    canReset: hasSession,
    canViewResult: sessionState === "committed",
  };
}
