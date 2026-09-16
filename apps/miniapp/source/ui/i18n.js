/**
 * I18N（zh-CN / en-US）。
 *
 * MiniApp Skill 硬约束：从第一版就带上 i18n，静态文案可重渲染，动态文案走本表。
 * 动态内容包括：阶段名、Task 类型、分析图层名、协作模式名。
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
    "zh-CN": "Developer-AI 交互可信度",
    "en-US": "Developer-AI interaction reliability",
  },
  tabControl: { "zh-CN": "Control", "en-US": "Control" },
  tabHistory: { "zh-CN": "History PRs", "en-US": "History PRs" },
  tabProfile: { "zh-CN": "Developer Profile", "en-US": "Developer Profile" },

  // 通用
  btnConfirm: { "zh-CN": "确认", "en-US": "Confirm" },
  btnCancel: { "zh-CN": "取消", "en-US": "Cancel" },

  // Profile（P3）
  lblProfileStatus: { "zh-CN": "画像状态", "en-US": "Profile Status" },
  lblInitState: { "zh-CN": "初始化", "en-US": "Initialized" },
  lblGitUser: { "zh-CN": "git 用户", "en-US": "git User" },
  lblPrStats: { "zh-CN": "git PR 统计", "en-US": "git PR Stats" },
  lblUpdatedAt: { "zh-CN": "最近更新", "en-US": "Updated At" },
  lblProfileOps: { "zh-CN": "操作", "en-US": "Actions" },
  btnProfileInit: { "zh-CN": "git 初始化", "en-US": "Init from git" },
  btnProfileSync: { "zh-CN": "增量同步 git", "en-US": "Sync git (incremental)" },
  btnProfileUpdatePr: { "zh-CN": "从本地 PR 增量更新", "en-US": "Update from local PR" },
  hintProfileInit: {
    "zh-CN": "未初始化时填入 git 主页地址发起初始化；已初始化可用增量同步。初始化需草稿确认后才参与计分。",
    "en-US": "Enter your git homepage URL to initialize; incremental sync afterwards. Init requires draft confirmation before scoring.",
  },
  lblDraft: { "zh-CN": "初始化草稿（确认前不计分）", "en-US": "Draft (not scored until confirmed)" },
  btnConfirmDraft: { "zh-CN": "确认并落盘", "en-US": "Confirm & Save" },
  btnDiscardDraft: { "zh-CN": "放弃草稿", "en-US": "Discard Draft" },
  lblTechDomain: { "zh-CN": "主领域关键词", "en-US": "Tech Domain" },
  lblHistoryTasks: { "zh-CN": "本地历史 PR", "en-US": "Local History PRs" },
  profileReady: { "zh-CN": "已初始化", "en-US": "Ready" },
  profileEmpty: { "zh-CN": "未初始化", "en-US": "Not initialized" },
  prStatsNone: { "zh-CN": "未同步", "en-US": "Not synced" },
  noKeywords: { "zh-CN": "暂无关键词", "en-US": "No keywords yet" },
  noHistoryTasks: { "zh-CN": "暂无本地历史 PR", "en-US": "No local history PRs yet" },
  barLocal: { "zh-CN": "本地 AI 协作", "en-US": "Local AI-collab" },
  barLines: { "zh-CN": "累计行数", "en-US": "Total lines" },
  hintLocalFallback: {
    "zh-CN": "未同步 git，暂用本地行数",
    "en-US": "git not synced, using local lines",
  },
  lblCreditShort: { "zh-CN": "分", "en-US": "credit" },
  unitLines: { "zh-CN": " 行", "en-US": " lines" },
  draftMeta: {
    "zh-CN": "{n} 个关键词 · LLM 输入 {chars} 字符 · {req} 次 git 请求；蓝色描边为新增",
    "en-US": "{n} keywords · LLM digest {chars} chars · {req} git requests; outlined = new",
  },
  msgWorking: { "zh-CN": "处理中…", "en-US": "Working…" },
  msgFail: { "zh-CN": "失败：", "en-US": "Failed: " },
  msgNeedUrl: { "zh-CN": "请先填入 git 主页地址", "en-US": "Enter git homepage URL first" },
  msgInitDone: { "zh-CN": "初始化完成，请确认草稿", "en-US": "Init done, confirm the draft" },
  msgSyncDone: { "zh-CN": "增量同步完成", "en-US": "Sync done" },
  msgConfirmDone: { "zh-CN": "画像已落盘", "en-US": "Profile saved" },
  msgDiscardDone: { "zh-CN": "草稿已放弃", "en-US": "Draft discarded" },
  msgUpdateDone: { "zh-CN": "本地增量更新完成", "en-US": "Local update done" },
  promptPrId: { "zh-CN": "输入 prId（如 pr-20260902-103306-pxb23g）", "en-US": "Enter prId (e.g. pr-2026...)" },

  // Control
  btnStart: { "zh-CN": "开始记录", "en-US": "Start" },
  btnStartPr: { "zh-CN": "开始 PR", "en-US": "Start PR" },
  btnFinish: { "zh-CN": "结束并保存", "en-US": "Finish & Save" },
  btnFinishCompute: { "zh-CN": "结束开发并计算", "en-US": "Finish & Compute" },
  btnReset: { "zh-CN": "放弃本轮记录", "en-US": "Discard" },
  btnRecover: { "zh-CN": "模拟重启（重跑恢复）", "en-US": "Simulate Restart" },
  btnRefresh: { "zh-CN": "刷新状态", "en-US": "Refresh" },
  btnViewResult: { "zh-CN": "查看上次结果", "en-US": "View Last Result" },
  lblState: { "zh-CN": "状态", "en-US": "State" },
  lblPrId: { "zh-CN": "prId", "en-US": "prId" },
  lblSeq: { "zh-CN": "行为序号", "en-US": "Seq" },
  lblCounts: { "zh-CN": "事件计数", "en-US": "Counts" },
  lblStats: { "zh-CN": "治理统计", "en-US": "Governor" },
  lblDir: { "zh-CN": "数据目录", "en-US": "Data Dir" },
  lblDirs: { "zh-CN": "数据目录", "en-US": "Data Dir" },
  lblComputing: { "zh-CN": "正在计算", "en-US": "Computing" },
  lblDevOverview: { "zh-CN": "Dev_Credit 概览", "en-US": "Dev_Credit Overview" },

  // Control · result / evidence
  lblResult: { "zh-CN": "本轮 PR_Credit", "en-US": "PR_Credit (this PR)" },
  btnEvidence: { "zh-CN": "查看证据", "en-US": "Evidence" },
  btnToCommit: { "zh-CN": "去提交", "en-US": "Commit" },
  btnBack: { "zh-CN": "返回", "en-US": "Back" },
  lblNoEvidenceYet: { "zh-CN": "本次结果没有可展开的证据", "en-US": "No evidence for this result" },

  // Control · commit（M6）
  lblCommitFiles: { "zh-CN": "提交文件", "en-US": "Files to Commit" },
  btnSelectAll: { "zh-CN": "全选", "en-US": "Select all" },
  btnSelectNone: { "zh-CN": "全不选", "en-US": "Select none" },
  hintCommitFiles: {
    "zh-CN": "默认全选；取消勾选的文件不进入本次提交。",
    "en-US": "All selected by default; unchecked files are excluded.",
  },
  lblCommitMsg: { "zh-CN": "Commit 说明", "en-US": "Commit Message" },
  phCommitSubject: { "zh-CN": "一句话描述本次改动", "en-US": "One-line description" },
  hintCommitMsg: {
    "zh-CN": "CREDIT 声明行由工具自动生成并追加；可编辑最终提交内容。",
    "en-US": "The CREDIT line is generated automatically; the final message is editable.",
  },
  btnCommit: { "zh-CN": "确认提交", "en-US": "Commit" },
  btnPush: { "zh-CN": "推送", "en-US": "Push" },
  btnCopyMsg: { "zh-CN": "复制", "en-US": "Copy" },
  lblNoChanges: { "zh-CN": "没有检测到改动文件", "en-US": "No changed files" },
  warnLowScore: {
    "zh-CN": "WARNING：本次 PR_Credit 为 {score}，低于阈值 {threshold}。提交仍可继续，请确认已充分验证。",
    "en-US": "WARNING: PR_Credit is {score}, below threshold {threshold}. You may still commit — please verify first.",
  },
  confirmPush: {
    "zh-CN": "确认推送到远端？该操作不可撤销。",
    "en-US": "Push to remote? This cannot be undone.",
  },
  msgNoFiles: { "zh-CN": "请至少勾选一个文件", "en-US": "Select at least one file" },
  msgCommitDone: { "zh-CN": "已提交：", "en-US": "Committed: " },
  msgPushDone: { "zh-CN": "已推送", "en-US": "Pushed" },
  msgPushNoop: { "zh-CN": "无需推送（无上游或已同步）", "en-US": "Nothing to push" },
  msgCopied: { "zh-CN": "已复制到剪贴板", "en-US": "Copied to clipboard" },
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
  lblBehaviors: { "zh-CN": "行为数", "en-US": "Behaviors" },
  lblAiRatio: { "zh-CN": "AI 占比", "en-US": "AI share" },
  btnRecompute: {
    "zh-CN": "重新计算（忽略缓存）",
    "en-US": "Recompute (ignore cache)",
  },
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
    "zh-CN": "本次未产生 LLM 调用，Descriptions 走规则降级路径。",
    "en-US": "No LLM call this run; descriptions fall back to rules.",
  },
  errLoadFailed: { "zh-CN": "加载失败：", "en-US": "Load failed: " },

  // ── P2 · 指标树 ──
  lblCreditTree: { "zh-CN": "PR_Credit 指标树", "en-US": "PR_Credit Metric Tree" },
  btnRecomputeCredit: { "zh-CN": "重新计算", "en-US": "Recompute" },
  lblNoCredit: { "zh-CN": "暂无评分结果", "en-US": "No score yet" },
  // 实测：8 次 LLM 调用（推理模型）合计可达数分钟，"数十秒"是严重低估，会让人以为卡死
  lblCreditComputing: {
    "zh-CN": "正在计算（含 LLM 判定，首次约需数分钟）…",
    "en-US": "Computing (incl. LLM; first run may take several minutes)…",
  },
  lblCreditRecomputed: {
    "zh-CN": "本次为重新计算",
    "en-US": "Recomputed",
  },
  lblEvidence: { "zh-CN": "证据", "en-US": "Evidence" },
  lblFromProc: {
    "zh-CN": "Dev_Profile 未初始化，PR_Credit = Proc_Credits",
    "en-US": "Dev_Profile not initialized; PR_Credit = Proc_Credits",
  },
  lblGitOff: {
    "zh-CN": "未取到 git diff，相关指标按不适用或保守分处理",
    "en-US": "git diff unavailable; related metrics excluded or conservative",
  },
  lblWeighted: {
    "zh-CN": "（权重已重分配）",
    "en-US": "(weights redistributed)",
  },
  stPending: { "zh-CN": "待接入", "en-US": "Pending" },
  stExcluded: { "zh-CN": "不适用", "en-US": "N/A" },
  stNoEvidence: { "zh-CN": "无证据", "en-US": "No evidence" },
  stDegraded: { "zh-CN": "数据不足", "en-US": "Insufficient" },
  stError: { "zh-CN": "计算异常", "en-US": "Error" },
  evBehavior: { "zh-CN": "行为", "en-US": "Behavior" },
  evTask: { "zh-CN": "工作片段", "en-US": "Task" },
  evFile: { "zh-CN": "文件", "en-US": "File" },
  evPrompt: { "zh-CN": "对话", "en-US": "Prompt" },
  evTestRun: { "zh-CN": "测试运行", "en-US": "Test run" },
  evLlm: { "zh-CN": "LLM 判定", "en-US": "LLM" },
  evNote: { "zh-CN": "说明", "en-US": "Note" },

  // 甘特图缩放
  hintZoom: {
    "zh-CN": "Ctrl + 滚轮缩放 · 拖拽平移 · 双击重置",
    "en-US": "Ctrl+Wheel zoom · drag to pan · double-click to reset",
  },
  btnResetZoom: { "zh-CN": "重置", "en-US": "Reset" },
  lblSubspan: { "zh-CN": "跨阶段子段", "en-US": "cross-stage span" },
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
