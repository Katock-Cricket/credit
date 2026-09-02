/**
 * I18N（zh-CN / en-US）。
 *
 * MiniApp Skill 硬约束：从第一版就带上 i18n，静态文案可重渲染，动态文案走本表。
 * 动态内容包括：阶段名、Task 类型、分析图层名、diagnostics 字段名、协作模式名。
 * **不翻译**：`Task.desc`（取自用户 prompt 原文，原样呈现）。
 */

export const STAGE_I18N = {
  "spec-engineering": { "zh-CN": "SPEC工程", "en-US": "SPEC Engineering" },
  "test-planning": { "zh-CN": "测试方案准备", "en-US": "Test Planning" },
  "ai-code-generation": { "zh-CN": "AI代码生成", "en-US": "AI Code Generation" },
  "ai-testing": { "zh-CN": "AI软件测试", "en-US": "AI Testing" },
  "ai-fix": { "zh-CN": "AI代码修复", "en-US": "AI Fix" },
  "manual-verification": { "zh-CN": "人工补测验证", "en-US": "Manual Verification" },
  "ai-review": { "zh-CN": "AI Review", "en-US": "AI Review" },
  unknown: { "zh-CN": "未归类", "en-US": "Unclassified" },
};

export const TASK_TYPE_I18N = {
  feature: { "zh-CN": "功能", "en-US": "Feature" },
  fix: { "zh-CN": "修复", "en-US": "Fix" },
  test: { "zh-CN": "测试", "en-US": "Test" },
  docs: { "zh-CN": "文档", "en-US": "Docs" },
  refactor: { "zh-CN": "重构", "en-US": "Refactor" },
  spec: { "zh-CN": "SPEC", "en-US": "SPEC" },
  review: { "zh-CN": "评审", "en-US": "Review" },
  unknown: { "zh-CN": "未知", "en-US": "Unknown" },
};

export const PATTERN_I18N = {
  cruise: { "zh-CN": "巡航式", "en-US": "Cruise" },
  pair: { "zh-CN": "结对式", "en-US": "Pair" },
  review: { "zh-CN": "审阅式", "en-US": "Review" },
  manual: { "zh-CN": "手工式", "en-US": "Manual" },
  unknown: { "zh-CN": "未识别", "en-US": "Unknown" },
};

export const MESSAGES = {
  appTitle: { "zh-CN": "CREDIT", "en-US": "CREDIT" },
  appSub: {
    "zh-CN": "过程建模与可视化原型 · P2-pre",
    "en-US": "Process Modeling Prototype · P2-pre",
  },
  tabControl: { "zh-CN": "Control", "en-US": "Control" },
  tabHistory: { "zh-CN": "History PRs", "en-US": "History PRs" },

  // Control
  btnStart: { "zh-CN": "开始记录", "en-US": "Start" },
  btnFinish: { "zh-CN": "结束并保存", "en-US": "Finish & Save" },
  btnReset: { "zh-CN": "放弃本轮记录", "en-US": "Discard" },
  btnRecover: { "zh-CN": "模拟重启（重跑恢复）", "en-US": "Simulate Restart" },
  btnRefresh: { "zh-CN": "刷新状态", "en-US": "Refresh" },
  lblState: { "zh-CN": "状态", "en-US": "State" },
  lblPrId: { "zh-CN": "prId", "en-US": "prId" },
  lblSeq: { "zh-CN": "行为序号", "en-US": "Seq" },
  lblCounts: { "zh-CN": "事件计数", "en-US": "Counts" },
  lblStats: { "zh-CN": "治理统计", "en-US": "Governor" },
  lblDirs: { "zh-CN": "数据目录", "en-US": "Data Dir" },
  msgStarted: { "zh-CN": "已开始记录", "en-US": "Recording started" },
  msgFinished: { "zh-CN": "已结束并保存", "en-US": "Finished and saved" },
  msgReset: { "zh-CN": "已放弃本轮记录（数据文件已删除）", "en-US": "Discarded (data files deleted)" },
  msgRecovered: { "zh-CN": "已重跑断点恢复", "en-US": "Recovery re-run" },
  confirmReset: {
    "zh-CN": "确认放弃本轮记录？本轮已采集的事件将被删除且不可恢复。",
    "en-US": "Discard this round? Collected events will be deleted permanently.",
  },
  recoverResume: { "zh-CN": "自动接续上轮未提交记录", "en-US": "Resumed previous recording" },
  recoverRewind: { "zh-CN": "上轮停在 computing，已回退为 recording", "en-US": "Rewound computing → recording" },
  recoverDegraded: { "zh-CN": "会话文件异常，已安全降级为 idle（未删除任何数据）", "en-US": "Session file corrupt, degraded to idle" },
  recoverNone: { "zh-CN": "无历史会话", "en-US": "No history session" },

  // History
  lblPrList: { "zh-CN": "历史 PR", "en-US": "History PRs" },
  lblNoPr: { "zh-CN": "暂无历史 PR 数据", "en-US": "No PR data yet" },
  lblLoading: { "zh-CN": "加载中…", "en-US": "Loading…" },
  lblTimeline: { "zh-CN": "过程时间线", "en-US": "Process Timeline" },
  lblAnalytics: { "zh-CN": "过程分析", "en-US": "Analytics" },
  lblDiagnostics: { "zh-CN": "切分自检", "en-US": "Diagnostics" },
  lblDev: { "zh-CN": "Dev", "en-US": "Dev" },
  lblAi: { "zh-CN": "AI", "en-US": "AI" },
  lblTasks: { "zh-CN": "Task 数", "en-US": "Tasks" },
  lblBehaviors: { "zh-CN": "行为数", "en-US": "Behaviors" },
  lblAvgTask: { "zh-CN": "平均时长", "en-US": "Avg Task" },
  lblMixed: { "zh-CN": "跨阶段 Task", "en-US": "Mixed-stage" },
  lblLlmCalls: { "zh-CN": "LLM 调用", "en-US": "LLM Calls" },
  lblFallback: { "zh-CN": "降级 Task", "en-US": "Fallback" },
  lblReview: { "zh-CN": "Review 轮次", "en-US": "Review Rounds" },
  lblDuration: { "zh-CN": "时长", "en-US": "Duration" },
  lblStage: { "zh-CN": "阶段", "en-US": "Stage" },
  lblType: { "zh-CN": "类型", "en-US": "Type" },
  lblDesc: { "zh-CN": "目标", "en-US": "Goal" },
  lblSummary: { "zh-CN": "行为摘要", "en-US": "Summary" },
  lblFiles: { "zh-CN": "涉及文件", "en-US": "Files" },
  lblSpans: { "zh-CN": "内部分段", "en-US": "Spans" },
  lblBehaviorsInTask: { "zh-CN": "行为明细", "en-US": "Behaviors" },
  hintDescFallback: {
    "zh-CN": "（无目标描述，展示行为摘要）",
    "en-US": "(no goal description; showing behavior summary)",
  },
  hintClickTask: {
    "zh-CN": "点击 Task 块查看详情；色深表示 AI 行为占比。",
    "en-US": "Click a block for details; shading indicates AI behavior ratio.",
  },
  hintLlmOff: {
    "zh-CN": "未检测到 OPENAI_API_KEY，Descriptions 走规则降级路径。",
    "en-US": "OPENAI_API_KEY not found; descriptions fall back to rules.",
  },
  errLoadFailed: { "zh-CN": "加载失败：", "en-US": "Load failed: " },

  // 甘特图缩放
  hintZoom: {
    "zh-CN": "Ctrl + 滚轮缩放 · 拖拽平移 · 双击重置",
    "en-US": "Ctrl+Wheel zoom · drag to pan · double-click to reset",
  },
  btnResetZoom: { "zh-CN": "重置", "en-US": "Reset" },
  btnZoomIn: { "zh-CN": "放大", "en-US": "Zoom in" },
  btnZoomOut: { "zh-CN": "缩小", "en-US": "Zoom out" },
  lblZoomed: { "zh-CN": "已缩放", "en-US": "Zoomed" },
};

let currentLocale = "zh-CN";

export function getLocale() {
  return currentLocale;
}

export function setLocale(loc) {
  if (loc === "zh-CN" || loc === "en-US") currentLocale = loc;
  return currentLocale;
}

/** 取文案（动态内容用对应的 *I18N 表，静态用 MESSAGES） */
export function t(key) {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return entry[currentLocale] ?? entry["zh-CN"] ?? key;
}

/** 取动态内容的译文 */
export function tMap(map, key) {
  if (!map || !key) return key;
  const entry = map[key];
  if (!entry) return key;
  return entry[currentLocale] ?? entry["zh-CN"] ?? key;
}

export const tStage = (stage) => tMap(STAGE_I18N, stage);
export const tTaskType = (type) => tMap(TASK_TYPE_I18N, type);
export const tPattern = (p) => tMap(PATTERN_I18N, p);
