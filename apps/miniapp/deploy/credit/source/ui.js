/* 自动生成（apps/miniapp/build.mjs）—— 源：source/ui/main.js + source/ui/*.js；请勿直接编辑本文件 */

// source/ui/i18n.js
var STAGE_I18N = {
  "spec-engineering": { "zh-CN": "SPEC\u5DE5\u7A0B", "en-US": "SPEC Engineering" },
  "test-planning": { "zh-CN": "\u6D4B\u8BD5\u65B9\u6848\u51C6\u5907", "en-US": "Test Planning" },
  "ai-code-generation": { "zh-CN": "AI\u4EE3\u7801\u751F\u6210", "en-US": "AI Code Generation" },
  "ai-testing": { "zh-CN": "AI\u8F6F\u4EF6\u6D4B\u8BD5", "en-US": "AI Testing" },
  "ai-fix": { "zh-CN": "AI\u4EE3\u7801\u4FEE\u590D", "en-US": "AI Fix" },
  "manual-verification": { "zh-CN": "\u4EBA\u5DE5\u8865\u6D4B\u9A8C\u8BC1", "en-US": "Manual Verification" },
  "ai-review": { "zh-CN": "AI Review", "en-US": "AI Review" },
  unknown: { "zh-CN": "\u672A\u5F52\u7C7B", "en-US": "Unclassified" }
};
var TASK_TYPE_I18N = {
  feature: { "zh-CN": "\u529F\u80FD", "en-US": "Feature" },
  fix: { "zh-CN": "\u4FEE\u590D", "en-US": "Fix" },
  test: { "zh-CN": "\u6D4B\u8BD5", "en-US": "Test" },
  docs: { "zh-CN": "\u6587\u6863", "en-US": "Docs" },
  refactor: { "zh-CN": "\u91CD\u6784", "en-US": "Refactor" },
  spec: { "zh-CN": "SPEC", "en-US": "SPEC" },
  review: { "zh-CN": "\u8BC4\u5BA1", "en-US": "Review" },
  unknown: { "zh-CN": "\u672A\u77E5", "en-US": "Unknown" }
};
var PATTERN_I18N = {
  cruise: { "zh-CN": "\u5DE1\u822A\u5F0F", "en-US": "Cruise" },
  pair: { "zh-CN": "\u7ED3\u5BF9\u5F0F", "en-US": "Pair" },
  review: { "zh-CN": "\u5BA1\u9605\u5F0F", "en-US": "Review" },
  manual: { "zh-CN": "\u624B\u5DE5\u5F0F", "en-US": "Manual" },
  unknown: { "zh-CN": "\u672A\u8BC6\u522B", "en-US": "Unknown" }
};
var MESSAGES = {
  appTitle: { "zh-CN": "CREDIT", "en-US": "CREDIT" },
  appSub: {
    "zh-CN": "Developer-AI \u4EA4\u4E92\u53EF\u4FE1\u5EA6",
    "en-US": "Developer-AI interaction reliability"
  },
  tabControl: { "zh-CN": "Control", "en-US": "Control" },
  tabHistory: { "zh-CN": "History PRs", "en-US": "History PRs" },
  tabProfile: { "zh-CN": "Developer Profile", "en-US": "Developer Profile" },
  // 通用
  btnConfirm: { "zh-CN": "\u786E\u8BA4", "en-US": "Confirm" },
  btnCancel: { "zh-CN": "\u53D6\u6D88", "en-US": "Cancel" },
  // Profile（P3）
  lblProfileStatus: { "zh-CN": "\u753B\u50CF\u72B6\u6001", "en-US": "Profile Status" },
  lblInitState: { "zh-CN": "\u521D\u59CB\u5316", "en-US": "Initialized" },
  lblGitUser: { "zh-CN": "git \u7528\u6237", "en-US": "git User" },
  lblPrStats: { "zh-CN": "git PR \u7EDF\u8BA1", "en-US": "git PR Stats" },
  lblUpdatedAt: { "zh-CN": "\u6700\u8FD1\u66F4\u65B0", "en-US": "Updated At" },
  lblProfileOps: { "zh-CN": "\u64CD\u4F5C", "en-US": "Actions" },
  btnProfileInit: { "zh-CN": "git \u521D\u59CB\u5316", "en-US": "Init from git" },
  btnProfileSync: { "zh-CN": "\u589E\u91CF\u540C\u6B65 git", "en-US": "Sync git (incremental)" },
  btnProfileUpdatePr: { "zh-CN": "\u4ECE\u672C\u5730 PR \u589E\u91CF\u66F4\u65B0", "en-US": "Update from local PR" },
  hintProfileInit: {
    "zh-CN": "\u672A\u521D\u59CB\u5316\u65F6\u586B\u5165 git \u4E3B\u9875\u5730\u5740\u53D1\u8D77\u521D\u59CB\u5316\uFF1B\u5DF2\u521D\u59CB\u5316\u53EF\u7528\u589E\u91CF\u540C\u6B65\u3002\u521D\u59CB\u5316\u9700\u8349\u7A3F\u786E\u8BA4\u540E\u624D\u53C2\u4E0E\u8BA1\u5206\u3002",
    "en-US": "Enter your git homepage URL to initialize; incremental sync afterwards. Init requires draft confirmation before scoring."
  },
  lblDraft: { "zh-CN": "\u521D\u59CB\u5316\u8349\u7A3F\uFF08\u786E\u8BA4\u524D\u4E0D\u8BA1\u5206\uFF09", "en-US": "Draft (not scored until confirmed)" },
  btnConfirmDraft: { "zh-CN": "\u786E\u8BA4\u5E76\u843D\u76D8", "en-US": "Confirm & Save" },
  btnDiscardDraft: { "zh-CN": "\u653E\u5F03\u8349\u7A3F", "en-US": "Discard Draft" },
  lblTechDomain: { "zh-CN": "\u4E3B\u9886\u57DF\u5173\u952E\u8BCD", "en-US": "Tech Domain" },
  lblHistoryTasks: { "zh-CN": "\u672C\u5730\u5386\u53F2 PR", "en-US": "Local History PRs" },
  profileReady: { "zh-CN": "\u5DF2\u521D\u59CB\u5316", "en-US": "Ready" },
  profileEmpty: { "zh-CN": "\u672A\u521D\u59CB\u5316", "en-US": "Not initialized" },
  prStatsNone: { "zh-CN": "\u672A\u540C\u6B65", "en-US": "Not synced" },
  noKeywords: { "zh-CN": "\u6682\u65E0\u5173\u952E\u8BCD", "en-US": "No keywords yet" },
  noHistoryTasks: { "zh-CN": "\u6682\u65E0\u672C\u5730\u5386\u53F2 PR", "en-US": "No local history PRs yet" },
  barLocal: { "zh-CN": "\u672C\u5730 AI \u534F\u4F5C", "en-US": "Local AI-collab" },
  barLines: { "zh-CN": "\u7D2F\u8BA1\u884C\u6570", "en-US": "Total lines" },
  hintLocalFallback: {
    "zh-CN": "\u672A\u540C\u6B65 git\uFF0C\u6682\u7528\u672C\u5730\u884C\u6570",
    "en-US": "git not synced, using local lines"
  },
  lblCreditShort: { "zh-CN": "\u5206", "en-US": "credit" },
  unitLines: { "zh-CN": " \u884C", "en-US": " lines" },
  draftMeta: {
    "zh-CN": "{n} \u4E2A\u5173\u952E\u8BCD \xB7 LLM \u8F93\u5165 {chars} \u5B57\u7B26 \xB7 {req} \u6B21 git \u8BF7\u6C42\uFF1B\u84DD\u8272\u63CF\u8FB9\u4E3A\u65B0\u589E",
    "en-US": "{n} keywords \xB7 LLM digest {chars} chars \xB7 {req} git requests; outlined = new"
  },
  msgWorking: { "zh-CN": "\u5904\u7406\u4E2D\u2026", "en-US": "Working\u2026" },
  msgFail: { "zh-CN": "\u5931\u8D25\uFF1A", "en-US": "Failed: " },
  msgNeedUrl: { "zh-CN": "\u8BF7\u5148\u586B\u5165 git \u4E3B\u9875\u5730\u5740", "en-US": "Enter git homepage URL first" },
  msgInitDone: { "zh-CN": "\u521D\u59CB\u5316\u5B8C\u6210\uFF0C\u8BF7\u786E\u8BA4\u8349\u7A3F", "en-US": "Init done, confirm the draft" },
  msgSyncDone: { "zh-CN": "\u589E\u91CF\u540C\u6B65\u5B8C\u6210", "en-US": "Sync done" },
  msgConfirmDone: { "zh-CN": "\u753B\u50CF\u5DF2\u843D\u76D8", "en-US": "Profile saved" },
  msgDiscardDone: { "zh-CN": "\u8349\u7A3F\u5DF2\u653E\u5F03", "en-US": "Draft discarded" },
  msgUpdateDone: { "zh-CN": "\u672C\u5730\u589E\u91CF\u66F4\u65B0\u5B8C\u6210", "en-US": "Local update done" },
  promptPrId: { "zh-CN": "\u8F93\u5165 prId\uFF08\u5982 pr-20260902-103306-pxb23g\uFF09", "en-US": "Enter prId (e.g. pr-2026...)" },
  // Control
  btnStart: { "zh-CN": "\u5F00\u59CB\u8BB0\u5F55", "en-US": "Start" },
  btnStartPr: { "zh-CN": "\u5F00\u59CB PR", "en-US": "Start PR" },
  btnFinish: { "zh-CN": "\u7ED3\u675F\u5E76\u4FDD\u5B58", "en-US": "Finish & Save" },
  btnFinishCompute: { "zh-CN": "\u7ED3\u675F\u5F00\u53D1\u5E76\u8BA1\u7B97", "en-US": "Finish & Compute" },
  btnReset: { "zh-CN": "\u653E\u5F03\u672C\u8F6E\u8BB0\u5F55", "en-US": "Discard" },
  btnRecover: { "zh-CN": "\u6A21\u62DF\u91CD\u542F\uFF08\u91CD\u8DD1\u6062\u590D\uFF09", "en-US": "Simulate Restart" },
  btnRefresh: { "zh-CN": "\u5237\u65B0\u72B6\u6001", "en-US": "Refresh" },
  btnViewResult: { "zh-CN": "\u67E5\u770B\u4E0A\u6B21\u7ED3\u679C", "en-US": "View Last Result" },
  lblState: { "zh-CN": "\u72B6\u6001", "en-US": "State" },
  lblPrId: { "zh-CN": "prId", "en-US": "prId" },
  lblSeq: { "zh-CN": "\u884C\u4E3A\u5E8F\u53F7", "en-US": "Seq" },
  lblCounts: { "zh-CN": "\u4E8B\u4EF6\u8BA1\u6570", "en-US": "Counts" },
  lblStats: { "zh-CN": "\u6CBB\u7406\u7EDF\u8BA1", "en-US": "Governor" },
  lblDir: { "zh-CN": "\u6570\u636E\u76EE\u5F55", "en-US": "Data Dir" },
  lblDirs: { "zh-CN": "\u6570\u636E\u76EE\u5F55", "en-US": "Data Dir" },
  lblComputing: { "zh-CN": "\u6B63\u5728\u8BA1\u7B97", "en-US": "Computing" },
  lblDevOverview: { "zh-CN": "Dev_Credit \u6982\u89C8", "en-US": "Dev_Credit Overview" },
  // Control · result / evidence
  lblResult: { "zh-CN": "\u672C\u8F6E PR_Credit", "en-US": "PR_Credit (this PR)" },
  btnEvidence: { "zh-CN": "\u67E5\u770B\u8BC1\u636E", "en-US": "Evidence" },
  btnToCommit: { "zh-CN": "\u53BB\u63D0\u4EA4", "en-US": "Commit" },
  btnBack: { "zh-CN": "\u8FD4\u56DE", "en-US": "Back" },
  lblNoEvidenceYet: { "zh-CN": "\u672C\u6B21\u7ED3\u679C\u6CA1\u6709\u53EF\u5C55\u5F00\u7684\u8BC1\u636E", "en-US": "No evidence for this result" },
  // Control · commit（M6）
  lblCommitFiles: { "zh-CN": "\u63D0\u4EA4\u6587\u4EF6", "en-US": "Files to Commit" },
  btnSelectAll: { "zh-CN": "\u5168\u9009", "en-US": "Select all" },
  btnSelectNone: { "zh-CN": "\u5168\u4E0D\u9009", "en-US": "Select none" },
  hintCommitFiles: {
    "zh-CN": "\u9ED8\u8BA4\u5168\u9009\uFF1B\u53D6\u6D88\u52FE\u9009\u7684\u6587\u4EF6\u4E0D\u8FDB\u5165\u672C\u6B21\u63D0\u4EA4\u3002",
    "en-US": "All selected by default; unchecked files are excluded."
  },
  lblCommitMsg: { "zh-CN": "Commit \u8BF4\u660E", "en-US": "Commit Message" },
  phCommitSubject: { "zh-CN": "\u4E00\u53E5\u8BDD\u63CF\u8FF0\u672C\u6B21\u6539\u52A8", "en-US": "One-line description" },
  hintCommitMsg: {
    "zh-CN": "CREDIT \u58F0\u660E\u884C\u7531\u5DE5\u5177\u81EA\u52A8\u751F\u6210\u5E76\u8FFD\u52A0\uFF1B\u53EF\u7F16\u8F91\u6700\u7EC8\u63D0\u4EA4\u5185\u5BB9\u3002",
    "en-US": "The CREDIT line is generated automatically; the final message is editable."
  },
  btnCommit: { "zh-CN": "\u786E\u8BA4\u63D0\u4EA4", "en-US": "Commit" },
  btnPush: { "zh-CN": "\u63A8\u9001", "en-US": "Push" },
  btnCopyMsg: { "zh-CN": "\u590D\u5236", "en-US": "Copy" },
  lblNoChanges: { "zh-CN": "\u6CA1\u6709\u68C0\u6D4B\u5230\u6539\u52A8\u6587\u4EF6", "en-US": "No changed files" },
  warnLowScore: {
    "zh-CN": "WARNING\uFF1A\u672C\u6B21 PR_Credit \u4E3A {score}\uFF0C\u4F4E\u4E8E\u9608\u503C {threshold}\u3002\u63D0\u4EA4\u4ECD\u53EF\u7EE7\u7EED\uFF0C\u8BF7\u786E\u8BA4\u5DF2\u5145\u5206\u9A8C\u8BC1\u3002",
    "en-US": "WARNING: PR_Credit is {score}, below threshold {threshold}. You may still commit \u2014 please verify first."
  },
  confirmPush: {
    "zh-CN": "\u786E\u8BA4\u63A8\u9001\u5230\u8FDC\u7AEF\uFF1F\u8BE5\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
    "en-US": "Push to remote? This cannot be undone."
  },
  msgNoFiles: { "zh-CN": "\u8BF7\u81F3\u5C11\u52FE\u9009\u4E00\u4E2A\u6587\u4EF6", "en-US": "Select at least one file" },
  msgCommitDone: { "zh-CN": "\u5DF2\u63D0\u4EA4\uFF1A", "en-US": "Committed: " },
  msgPushDone: { "zh-CN": "\u5DF2\u63A8\u9001", "en-US": "Pushed" },
  msgPushNoop: { "zh-CN": "\u65E0\u9700\u63A8\u9001\uFF08\u65E0\u4E0A\u6E38\u6216\u5DF2\u540C\u6B65\uFF09", "en-US": "Nothing to push" },
  msgCopied: { "zh-CN": "\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F", "en-US": "Copied to clipboard" },
  msgStarted: { "zh-CN": "\u5DF2\u5F00\u59CB\u8BB0\u5F55", "en-US": "Recording started" },
  msgFinished: { "zh-CN": "\u5DF2\u7ED3\u675F\u5E76\u4FDD\u5B58", "en-US": "Finished and saved" },
  msgReset: { "zh-CN": "\u5DF2\u653E\u5F03\u672C\u8F6E\u8BB0\u5F55\uFF08\u6570\u636E\u6587\u4EF6\u5DF2\u5220\u9664\uFF09", "en-US": "Discarded (data files deleted)" },
  msgRecovered: { "zh-CN": "\u5DF2\u91CD\u8DD1\u65AD\u70B9\u6062\u590D", "en-US": "Recovery re-run" },
  confirmReset: {
    "zh-CN": "\u786E\u8BA4\u653E\u5F03\u672C\u8F6E\u8BB0\u5F55\uFF1F\u672C\u8F6E\u5DF2\u91C7\u96C6\u7684\u4E8B\u4EF6\u5C06\u88AB\u5220\u9664\u4E14\u4E0D\u53EF\u6062\u590D\u3002",
    "en-US": "Discard this round? Collected events will be deleted permanently."
  },
  recoverResume: { "zh-CN": "\u81EA\u52A8\u63A5\u7EED\u4E0A\u8F6E\u672A\u63D0\u4EA4\u8BB0\u5F55", "en-US": "Resumed previous recording" },
  recoverRewind: { "zh-CN": "\u4E0A\u8F6E\u505C\u5728 computing\uFF0C\u5DF2\u56DE\u9000\u4E3A recording", "en-US": "Rewound computing \u2192 recording" },
  recoverDegraded: { "zh-CN": "\u4F1A\u8BDD\u6587\u4EF6\u5F02\u5E38\uFF0C\u5DF2\u5B89\u5168\u964D\u7EA7\u4E3A idle\uFF08\u672A\u5220\u9664\u4EFB\u4F55\u6570\u636E\uFF09", "en-US": "Session file corrupt, degraded to idle" },
  recoverNone: { "zh-CN": "\u65E0\u5386\u53F2\u4F1A\u8BDD", "en-US": "No history session" },
  // History
  lblPrList: { "zh-CN": "\u5386\u53F2 PR", "en-US": "History PRs" },
  lblNoPr: { "zh-CN": "\u6682\u65E0\u5386\u53F2 PR \u6570\u636E", "en-US": "No PR data yet" },
  lblLoading: { "zh-CN": "\u52A0\u8F7D\u4E2D\u2026", "en-US": "Loading\u2026" },
  lblTimeline: { "zh-CN": "\u8FC7\u7A0B\u65F6\u95F4\u7EBF", "en-US": "Process Timeline" },
  lblAnalytics: { "zh-CN": "\u8FC7\u7A0B\u5206\u6790", "en-US": "Analytics" },
  lblBehaviors: { "zh-CN": "\u884C\u4E3A\u6570", "en-US": "Behaviors" },
  lblAiRatio: { "zh-CN": "AI \u5360\u6BD4", "en-US": "AI share" },
  btnRecompute: {
    "zh-CN": "\u91CD\u65B0\u8BA1\u7B97\uFF08\u5FFD\u7565\u7F13\u5B58\uFF09",
    "en-US": "Recompute (ignore cache)"
  },
  lblDuration: { "zh-CN": "\u65F6\u957F", "en-US": "Duration" },
  lblStage: { "zh-CN": "\u9636\u6BB5", "en-US": "Stage" },
  lblType: { "zh-CN": "\u7C7B\u578B", "en-US": "Type" },
  lblDesc: { "zh-CN": "\u76EE\u6807", "en-US": "Goal" },
  lblSummary: { "zh-CN": "\u884C\u4E3A\u6458\u8981", "en-US": "Summary" },
  lblFiles: { "zh-CN": "\u6D89\u53CA\u6587\u4EF6", "en-US": "Files" },
  lblSpans: { "zh-CN": "\u5185\u90E8\u5206\u6BB5", "en-US": "Spans" },
  lblBehaviorsInTask: { "zh-CN": "\u884C\u4E3A\u660E\u7EC6", "en-US": "Behaviors" },
  hintDescFallback: {
    "zh-CN": "\uFF08\u65E0\u76EE\u6807\u63CF\u8FF0\uFF0C\u5C55\u793A\u884C\u4E3A\u6458\u8981\uFF09",
    "en-US": "(no goal description; showing behavior summary)"
  },
  hintClickTask: {
    "zh-CN": "\u70B9\u51FB Task \u5757\u67E5\u770B\u8BE6\u60C5\uFF1B\u8272\u6DF1\u8868\u793A AI \u884C\u4E3A\u5360\u6BD4\u3002",
    "en-US": "Click a block for details; shading indicates AI behavior ratio."
  },
  hintLlmOff: {
    "zh-CN": "\u672C\u6B21\u672A\u4EA7\u751F LLM \u8C03\u7528\uFF0CDescriptions \u8D70\u89C4\u5219\u964D\u7EA7\u8DEF\u5F84\u3002",
    "en-US": "No LLM call this run; descriptions fall back to rules."
  },
  errLoadFailed: { "zh-CN": "\u52A0\u8F7D\u5931\u8D25\uFF1A", "en-US": "Load failed: " },
  // ── P2 · 指标树 ──
  lblCreditTree: { "zh-CN": "PR_Credit \u6307\u6807\u6811", "en-US": "PR_Credit Metric Tree" },
  btnRecomputeCredit: { "zh-CN": "\u91CD\u65B0\u8BA1\u7B97", "en-US": "Recompute" },
  lblNoCredit: { "zh-CN": "\u6682\u65E0\u8BC4\u5206\u7ED3\u679C", "en-US": "No score yet" },
  // 实测：8 次 LLM 调用（推理模型）合计可达数分钟，"数十秒"是严重低估，会让人以为卡死
  lblCreditComputing: {
    "zh-CN": "\u6B63\u5728\u8BA1\u7B97\uFF08\u542B LLM \u5224\u5B9A\uFF0C\u9996\u6B21\u7EA6\u9700\u6570\u5206\u949F\uFF09\u2026",
    "en-US": "Computing (incl. LLM; first run may take several minutes)\u2026"
  },
  lblCreditRecomputed: {
    "zh-CN": "\u672C\u6B21\u4E3A\u91CD\u65B0\u8BA1\u7B97",
    "en-US": "Recomputed"
  },
  lblEvidence: { "zh-CN": "\u8BC1\u636E", "en-US": "Evidence" },
  lblFromProc: {
    "zh-CN": "Dev_Profile \u672A\u521D\u59CB\u5316\uFF0CPR_Credit = Proc_Credits",
    "en-US": "Dev_Profile not initialized; PR_Credit = Proc_Credits"
  },
  lblGitOff: {
    "zh-CN": "\u672A\u53D6\u5230 git diff\uFF0C\u76F8\u5173\u6307\u6807\u6309\u4E0D\u9002\u7528\u6216\u4FDD\u5B88\u5206\u5904\u7406",
    "en-US": "git diff unavailable; related metrics excluded or conservative"
  },
  lblWeighted: {
    "zh-CN": "\uFF08\u6743\u91CD\u5DF2\u91CD\u5206\u914D\uFF09",
    "en-US": "(weights redistributed)"
  },
  stPending: { "zh-CN": "\u5F85\u63A5\u5165", "en-US": "Pending" },
  stExcluded: { "zh-CN": "\u4E0D\u9002\u7528", "en-US": "N/A" },
  stNoEvidence: { "zh-CN": "\u65E0\u8BC1\u636E", "en-US": "No evidence" },
  stDegraded: { "zh-CN": "\u6570\u636E\u4E0D\u8DB3", "en-US": "Insufficient" },
  stError: { "zh-CN": "\u8BA1\u7B97\u5F02\u5E38", "en-US": "Error" },
  evBehavior: { "zh-CN": "\u884C\u4E3A", "en-US": "Behavior" },
  evTask: { "zh-CN": "\u5DE5\u4F5C\u7247\u6BB5", "en-US": "Task" },
  evFile: { "zh-CN": "\u6587\u4EF6", "en-US": "File" },
  evPrompt: { "zh-CN": "\u5BF9\u8BDD", "en-US": "Prompt" },
  evTestRun: { "zh-CN": "\u6D4B\u8BD5\u8FD0\u884C", "en-US": "Test run" },
  evLlm: { "zh-CN": "LLM \u5224\u5B9A", "en-US": "LLM" },
  evNote: { "zh-CN": "\u8BF4\u660E", "en-US": "Note" },
  // 甘特图缩放
  hintZoom: {
    "zh-CN": "Ctrl + \u6EDA\u8F6E\u7F29\u653E \xB7 \u62D6\u62FD\u5E73\u79FB \xB7 \u53CC\u51FB\u91CD\u7F6E",
    "en-US": "Ctrl+Wheel zoom \xB7 drag to pan \xB7 double-click to reset"
  },
  btnResetZoom: { "zh-CN": "\u91CD\u7F6E", "en-US": "Reset" },
  lblSubspan: { "zh-CN": "\u8DE8\u9636\u6BB5\u5B50\u6BB5", "en-US": "cross-stage span" },
  btnZoomIn: { "zh-CN": "\u653E\u5927", "en-US": "Zoom in" },
  btnZoomOut: { "zh-CN": "\u7F29\u5C0F", "en-US": "Zoom out" },
  lblZoomed: { "zh-CN": "\u5DF2\u7F29\u653E", "en-US": "Zoomed" }
};
var currentLocale = "zh-CN";
function getLocale() {
  return currentLocale;
}
function setLocale(loc) {
  if (loc === "zh-CN" || loc === "en-US") currentLocale = loc;
  return currentLocale;
}
function t(key) {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return entry[currentLocale] ?? entry["zh-CN"] ?? key;
}
function tMap(map, key) {
  if (!map || !key) return key;
  const entry = map[key];
  if (!entry) return key;
  return entry[currentLocale] ?? entry["zh-CN"] ?? key;
}
var tStage = (stage) => tMap(STAGE_I18N, stage);
var tTaskType = (type) => tMap(TASK_TYPE_I18N, type);
var tPattern = (p) => tMap(PATTERN_I18N, p);

// source/ui/transport.js
var TransportError = class extends Error {
  constructor(method, message, cause) {
    super(`[${method}] ${message}`);
    this.name = "TransportError";
    this.method = method;
    this.reason = message;
    this.cause = cause;
  }
};
var FETCH_ROUTES = {
  "credit.getStatus": () => ({ httpMethod: "GET", path: "/api/credit/status" }),
  "credit.start": () => ({ httpMethod: "POST", path: "/api/credit/start" }),
  "credit.finish": () => ({ httpMethod: "POST", path: "/api/credit/finish" }),
  "credit.reset": () => ({ httpMethod: "POST", path: "/api/credit/reset" }),
  "credit.listPrs": () => ({ httpMethod: "GET", path: "/api/pr/list" }),
  "credit.getTaskStageView": (p) => ({
    httpMethod: "GET",
    path: `/api/pr/${encodeURIComponent(p.prId)}/graph${p.force ? "?force=1" : ""}`
  }),
  "credit.getBehaviors": (p) => ({
    httpMethod: "GET",
    path: `/api/pr/${encodeURIComponent(p.prId)}/behaviors${p.ids?.length ? `?ids=${encodeURIComponent(p.ids.join(","))}` : ""}`
  }),
  "credit.compute": (p) => ({
    httpMethod: "GET",
    path: `/api/pr/${encodeURIComponent(p.prId)}/credit${p.force ? "?force=1" : ""}`
  }),
  "credit.getRules": () => ({ httpMethod: "GET", path: "/api/rules/tree" }),
  "credit.getProfile": () => ({ httpMethod: "GET", path: "/api/profile/get" }),
  "credit.importProfileFromGit": () => ({ httpMethod: "POST", path: "/api/profile/init" }),
  "credit.confirmProfileDraft": () => ({ httpMethod: "POST", path: "/api/profile/confirm" }),
  "credit.discardProfileDraft": () => ({ httpMethod: "POST", path: "/api/profile/discardDraft" }),
  "credit.syncProfileFromGit": () => ({ httpMethod: "POST", path: "/api/profile/sync" }),
  "credit.updateProfileFromPr": (p) => ({
    httpMethod: "GET",
    path: `/api/profile/updateFromPr?prId=${encodeURIComponent(p.prId ?? "")}`
  }),
  "credit.editProfile": () => ({ httpMethod: "POST", path: "/api/profile/edit" })
};
var BODY_METHODS = /* @__PURE__ */ new Set([
  "credit.start",
  "credit.finish",
  "credit.importProfileFromGit",
  "credit.confirmProfileDraft",
  "credit.editProfile"
]);
function normalizeResult(method, data) {
  if (data?.ok === false) throw new TransportError(method, data.error ?? "\u8C03\u7528\u5931\u8D25");
  return data;
}
var NEED_WORKSPACE = /* @__PURE__ */ new Set([
  "credit.compute",
  "credit.getChangedFiles",
  "credit.commitAndPush",
  "credit.push"
]);
function createAppTransport(app) {
  return {
    kind: "app",
    async call(method, params) {
      if (typeof app?.call !== "function") {
        throw new TransportError(method, "\u5BBF\u4E3B app.call \u4E0D\u53EF\u7528\uFF08\u9700 node.enabled=true\uFF09");
      }
      let payload = params ?? {};
      if (NEED_WORKSPACE.has(method) && payload.workspaceDir === void 0) {
        payload = { ...payload, workspaceDir: app.workspaceDir ?? null };
      }
      let data;
      try {
        data = await app.call(method, payload);
      } catch (e) {
        throw new TransportError(method, e?.message ?? String(e), e);
      }
      return normalizeResult(method, data);
    },
    /** Worker → iframe 推送事件；返回取消订阅函数 */
    on(event, fn) {
      if (typeof app?.on !== "function") return () => {
      };
      app.on(event, fn);
      return () => app.off?.(event, fn);
    },
    /** 计算进度流（`credit:progress`）*/
    onProgress(fn) {
      return this.on("worker:credit:progress", fn);
    }
  };
}
function createFetchTransport(baseUrl = "") {
  return {
    kind: "fetch",
    async call(method, params = {}) {
      const route = FETCH_ROUTES[method];
      if (!route) {
        throw new TransportError(method, "\u539F\u578B\u5BBF\u4E3B\u4E0D\u652F\u6301\u8BE5\u65B9\u6CD5\uFF08\u4EC5 MiniApp \u53EF\u7528\uFF09");
      }
      const { httpMethod, path } = route(params);
      const init2 = { method: httpMethod, headers: { "content-type": "application/json" } };
      if (BODY_METHODS.has(method)) init2.body = JSON.stringify(params ?? {});
      let res;
      try {
        res = await fetch(baseUrl + path, init2);
      } catch (e) {
        throw new TransportError(method, `\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\uFF1A${e?.message ?? String(e)}`, e);
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new TransportError(method, data?.error ?? `HTTP ${res.status}`);
      }
      return normalizeResult(method, data);
    },
    onProgress() {
      return () => {
      };
    }
  };
}
function createTransport(opts = {}) {
  const app = opts.app ?? (typeof window !== "undefined" ? window.app : void 0);
  if (app && typeof app.call === "function") return createAppTransport(app);
  if (opts.fetchBase !== void 0 || typeof window !== "undefined") {
    return createFetchTransport(opts.fetchBase ?? "");
  }
  throw new TransportError("transport", "\u672A\u627E\u5230\u53EF\u7528\u5BBF\u4E3B\uFF08app.call / fetch \u5747\u4E0D\u53EF\u7528\uFF09");
}

// source/ui/credit-tree.js
var STATUS_KEYS = {
  ok: null,
  // 不显示徽标
  pending: "stPending",
  excluded: "stExcluded",
  excluded_no_evidence: "stNoEvidence",
  degraded: "stDegraded",
  error: "stError"
};
var EV_KEYS = {
  behavior: "evBehavior",
  task: "evTask",
  file: "evFile",
  prompt: "evPrompt",
  testrun: "evTestRun",
  llm: "evLlm",
  note: "evNote"
};
var DEFAULT_EXPAND_LEVEL = 3;
function levelOf(node) {
  const m = /^L(\d+)$/.exec(String(node.level ?? ""));
  return m ? Number(m[1]) : 4;
}
function nameOf(node) {
  return node.name?.[getLocale()] ?? node.name?.["zh-CN"] ?? node.id;
}
function svgInfo() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("aria-hidden", "true");
  const circle = document.createElementNS(ns, "circle");
  circle.setAttribute("cx", "8");
  circle.setAttribute("cy", "8");
  circle.setAttribute("r", "7");
  circle.setAttribute("fill", "none");
  circle.setAttribute("stroke", "currentColor");
  circle.setAttribute("stroke-width", "1.2");
  const bar = document.createElementNS(ns, "rect");
  bar.setAttribute("x", "7.2");
  bar.setAttribute("y", "6.8");
  bar.setAttribute("width", "1.6");
  bar.setAttribute("height", "5");
  bar.setAttribute("fill", "currentColor");
  const dot = document.createElementNS(ns, "circle");
  dot.setAttribute("cx", "8");
  dot.setAttribute("cy", "4.6");
  dot.setAttribute("r", "1");
  dot.setAttribute("fill", "currentColor");
  svg.append(circle, bar, dot);
  return svg;
}
function renderEvidence(list, onTaskJump) {
  if (!list || list.length === 0) return null;
  const box = document.createElement("div");
  box.className = "ct-ev";
  const title = document.createElement("div");
  title.className = "ct-ev-title";
  title.textContent = t("lblEvidence");
  box.append(title);
  for (const e of list) {
    const row = document.createElement("div");
    row.className = "ct-ev-row";
    const kind = document.createElement("span");
    kind.className = "ct-ev-kind";
    kind.textContent = t(EV_KEYS[e.kind] ?? "evNote");
    row.append(kind);
    const body = document.createElement("span");
    body.className = "ct-ev-body";
    if (e.kind === "task") {
      for (const id of e.ids ?? []) {
        const btn = document.createElement("button");
        btn.className = "ct-ev-link";
        btn.textContent = id;
        btn.addEventListener("click", () => onTaskJump?.(id));
        body.append(btn);
      }
      if (e.label) body.append(document.createTextNode(` ${e.label}`));
    } else if (e.kind === "file") {
      body.textContent = `${(e.uris ?? []).join(", ")}${e.lines?.length ? ` (${e.lines.length} \u884C)` : ""}${e.label ? ` \u2014 ${e.label}` : ""}`;
    } else if (e.kind === "prompt") {
      body.textContent = String(e.text ?? "").slice(0, 220);
    } else {
      body.textContent = String(e.label ?? e.text ?? e.rationale ?? "").slice(0, 220);
    }
    row.append(body);
    box.append(row);
  }
  return box;
}
function renderNode(resultNode, depth, ctxOpts) {
  const { node, result } = resultNode;
  const wrap = document.createElement("div");
  wrap.className = "ct-node";
  wrap.dataset.id = node.id;
  const row = document.createElement("div");
  row.className = "ct-row";
  row.style.paddingLeft = `${depth * 12}px`;
  const hasChildren = (resultNode.children ?? []).length > 0;
  const toggle = document.createElement("button");
  toggle.className = "ct-toggle";
  toggle.setAttribute("aria-label", "toggle");
  if (!hasChildren) toggle.classList.add("ct-toggle-empty");
  row.append(toggle);
  const name = document.createElement("span");
  name.className = "ct-name";
  name.textContent = nameOf(node);
  row.append(name);
  const statusKey = STATUS_KEYS[result.status];
  if (statusKey) {
    const badge = document.createElement("span");
    badge.className = `ct-badge ct-badge-${result.status}`;
    badge.textContent = t(statusKey);
    row.append(badge);
  }
  const score = document.createElement("span");
  score.className = "ct-score";
  score.textContent = result.score == null ? "\u2014" : Number(result.score).toFixed(1);
  row.append(score);
  const info = document.createElement("button");
  info.className = "ct-info";
  info.setAttribute("aria-label", t("lblEvidence"));
  info.append(svgInfo());
  row.append(info);
  wrap.append(row);
  if (result.detail) {
    const detail = document.createElement("div");
    detail.className = "ct-detail";
    detail.style.paddingLeft = `${depth * 12 + 20}px`;
    detail.textContent = result.detail;
    wrap.append(detail);
  }
  const ev = renderEvidence(result.evidence, ctxOpts.onTaskJump);
  if (ev) {
    ev.hidden = true;
    ev.style.paddingLeft = `${depth * 12 + 20}px`;
    wrap.append(ev);
    let open = false;
    info.addEventListener("click", () => {
      open = !open;
      ev.hidden = !open;
      info.classList.toggle("is-open", open);
    });
  } else {
    info.disabled = true;
    info.classList.add("is-empty");
  }
  const kids = document.createElement("div");
  kids.className = "ct-children";
  for (const c of resultNode.children ?? []) kids.append(renderNode(c, depth + 1, ctxOpts));
  if (hasChildren) wrap.append(kids);
  const shouldExpand = levelOf(node) <= DEFAULT_EXPAND_LEVEL;
  const collapsed = !shouldExpand;
  wrap.classList.toggle("is-collapsed", collapsed);
  toggle.classList.toggle("is-collapsed", collapsed);
  toggle.addEventListener("click", () => {
    const nowCollapsed = !wrap.classList.contains("is-collapsed");
    wrap.classList.toggle("is-collapsed", nowCollapsed);
    toggle.classList.toggle("is-collapsed", nowCollapsed);
  });
  return wrap;
}
var BANDS = [
  { band: "blind", max: 40 },
  { band: "selective", max: 60 },
  { band: "verified", max: 80 },
  { band: "mastered", max: 100 }
];
function renderCreditSummary(host2, result) {
  host2.hidden = false;
  host2.replaceChildren();
  const s = result.summary;
  const score = Number(s.prCredit);
  const card2 = document.createElement("div");
  card2.className = "ct-summary-card";
  const top = document.createElement("div");
  top.className = "ct-summary-top";
  const num = document.createElement("div");
  num.className = "ct-total";
  num.textContent = score.toFixed(1);
  top.append(num);
  const right = document.createElement("div");
  right.className = "ct-summary-meta";
  const band = document.createElement("div");
  band.className = "ct-band";
  band.textContent = s.bandLabel?.[getLocale()] ?? s.band;
  right.append(band);
  const comment = document.createElement("div");
  comment.className = "ct-comment";
  comment.textContent = s.overallComment ?? "";
  right.append(comment);
  top.append(right);
  card2.append(top);
  card2.append(renderGauge(score, s.band));
  host2.append(card2);
}
function renderGauge(score, currentBand) {
  const wrap = document.createElement("div");
  wrap.className = "ct-gauge";
  const track = document.createElement("div");
  track.className = "ct-gauge-track";
  for (const b of BANDS) {
    const seg = document.createElement("span");
    seg.className = "ct-seg" + (b.band === currentBand ? " is-current" : "");
    seg.dataset.band = b.band;
    track.append(seg);
  }
  const pct = Math.max(0, Math.min(100, score));
  const pointer = document.createElement("span");
  pointer.className = "ct-gauge-pointer";
  pointer.style.left = `${pct}%`;
  pointer.setAttribute("aria-label", `PR_Credit ${score.toFixed(1)}`);
  track.append(pointer);
  wrap.append(track);
  const scale = document.createElement("div");
  scale.className = "ct-gauge-scale";
  for (const v of [0, 40, 60, 80, 100]) {
    const tick = document.createElement("span");
    tick.className = "ct-tick";
    tick.style.left = `${v}%`;
    tick.textContent = String(v);
    scale.append(tick);
  }
  wrap.append(scale);
  return wrap;
}
function renderCreditTree(host2, result, opts = {}) {
  host2.replaceChildren();
  if (!result?.tree) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = t("lblNoCredit");
    host2.append(empty);
    return;
  }
  host2.append(renderNode(result.tree, 0, opts));
}

// source/ui/control-flow.js
var RESULT_DEPENDENT = ["result", "evidence", "commit"];
function allowedControlViews({ hasResult } = {}) {
  return hasResult ? ["home", ...RESULT_DEPENDENT] : ["home"];
}
function isSessionBusy(sessionState) {
  return sessionState === "recording" || sessionState === "computing";
}
function resolveControlView({ sessionState, hasResult, current, requested } = {}) {
  const allowed = allowedControlViews({ hasResult });
  if (requested && allowed.includes(requested)) return requested;
  if (sessionState === "recording") return "home";
  if (!hasResult) return "home";
  if (current && allowed.includes(current)) return current;
  return "result";
}
function homeActions({ sessionState } = {}) {
  const hasSession = !!sessionState && sessionState !== "idle";
  return {
    canStart: !hasSession,
    canFinish: sessionState === "recording",
    canReset: hasSession,
    canViewResult: sessionState === "committed"
  };
}

// source/ui/confirm.js
function askConfirm(host2, { message, okLabel, cancelLabel } = {}) {
  return new Promise((resolve) => {
    const bar = document.createElement("div");
    bar.className = "confirm-bar";
    const text = document.createElement("span");
    text.className = "confirm-msg";
    text.textContent = message ?? "";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "primary";
    ok.textContent = okLabel ?? t("btnConfirm");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = cancelLabel ?? t("btnCancel");
    const done = (value) => {
      bar.remove();
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === "Escape") done(false);
    };
    ok.addEventListener("click", () => done(true));
    cancel.addEventListener("click", () => done(false));
    document.addEventListener("keydown", onKey);
    bar.append(text, ok, cancel);
    host2.append(bar);
    ok.focus();
  });
}

// source/ui/view-control.js
var FALLBACK_WARN_THRESHOLD = 40;
function createControlView(root, transport2, opts = {}) {
  const $ = (id) => root.querySelector(`#${id}`);
  const call = (method, params) => transport2.call(method, params ?? {});
  const VIEW_HOSTS = {
    home: $("ctl-view-home"),
    result: $("ctl-view-result"),
    evidence: $("ctl-view-evidence"),
    commit: $("ctl-view-commit")
  };
  let sessionState = "idle";
  let prId = null;
  let credit = null;
  let profile = null;
  let progressOff = null;
  let changedFiles = [];
  let warnThreshold = FALLBACK_WARN_THRESHOLD;
  function show(view) {
    const next = resolveControlView({
      sessionState,
      hasResult: !!credit,
      current: currentView,
      requested: view
    });
    currentView = next;
    for (const [key, host2] of Object.entries(VIEW_HOSTS)) {
      if (host2) host2.hidden = key !== next;
    }
  }
  let currentView = "home";
  function renderStatus(data) {
    const s = data.session;
    sessionState = s?.state ?? "idle";
    prId = s?.prId ?? prId;
    const stateEl = $("ctl-state");
    stateEl.textContent = sessionState;
    stateEl.className = `state ${sessionState}`;
    $("ctl-prid").textContent = prId ?? "-";
    $("ctl-seq").textContent = s?.seq ?? 0;
    $("ctl-counts").textContent = s ? JSON.stringify(s.counts ?? {}) : "-";
    $("ctl-dirs").textContent = data.dirs?.rootDir ?? "-";
    const banner = $("ctl-banner");
    const r = data.recover;
    if (r && ["resume", "rewind", "degraded"].includes(r.action)) {
      banner.className = "banner warn";
      banner.textContent = `${t(`recover${r.action[0].toUpperCase()}${r.action.slice(1)}`)}${r.prId ? `\uFF08prId=${r.prId}\uFF09` : ""}`;
    } else {
      banner.className = "banner";
      banner.textContent = "";
    }
    const a = homeActions({ sessionState });
    $("btn-start").disabled = !a.canStart;
    $("btn-finish").disabled = !a.canFinish;
    $("btn-reset").disabled = !a.canReset;
    $("btn-view-result").disabled = !credit;
    renderProgress(isSessionBusy(sessionState));
    if (!isSessionBusy(sessionState)) show(currentView);
  }
  function renderProgress(busy) {
    const panel = $("ctl-progress-panel");
    if (!panel) return;
    panel.hidden = !busy;
    if (!busy) {
      $("ctl-progress-bar").style.width = "0%";
      $("ctl-progress-text").textContent = "";
    }
  }
  function onProgress(p) {
    const panel = $("ctl-progress-panel");
    if (!panel || !p) return;
    panel.hidden = false;
    const pct = p.total ? Math.round(p.done / p.total * 100) : 0;
    $("ctl-progress-bar").style.width = `${pct}%`;
    $("ctl-progress-text").textContent = `${p.done}/${p.total}${p.nodeId ? ` \xB7 ${p.nodeId}` : ""}`;
  }
  async function renderDevOverview() {
    const host2 = $("ctl-devc");
    try {
      const data = await call("credit.getProfile");
      profile = data.profile;
      if (!data.initialized || !profile) {
        host2.innerHTML = `<div class="empty">${t("profileEmpty")}</div>`;
        return;
      }
      const kws = [...profile.techDomain?.keywords ?? []].sort((a, b) => (b.gitLines ?? 0) - (a.gitLines ?? 0)).slice(0, 6);
      const gs = profile.gitStats;
      host2.innerHTML = `<div class="kw-meta">git ${profile.gitUser ?? "-"} \xB7 ${gs ? `${gs.mergedPrCount}/${gs.totalPrCount} merged` : t("prStatsNone")}</div><div>${kws.map(
        (k) => `<span class="draft-kw">${esc2(k.name)} <span class="kw-meta">${k.gitLines ?? 0}</span></span>`
      ).join("")}</div>`;
    } catch (e) {
      host2.innerHTML = `<div class="empty">${t("errLoadFailed")}${esc2(e.message)}</div>`;
    }
  }
  async function refresh() {
    try {
      renderStatus(await call("credit.getStatus"));
    } catch (e) {
      $("ctl-msg").textContent = `${t("msgFail")}${e.message}`;
    }
  }
  async function act(method, params, okKey, confirmKey) {
    if (confirmKey && !await askConfirm(VIEW_HOSTS.home, { message: t(confirmKey) })) return null;
    $("ctl-msg").textContent = t("msgWorking");
    try {
      const data = await call(method, params);
      $("ctl-msg").textContent = t(okKey);
      await refresh();
      return data;
    } catch (e) {
      $("ctl-msg").textContent = `${t("msgFail")}${e.message}`;
      await refresh();
      return null;
    }
  }
  async function loadResult(force = false) {
    if (!prId) return;
    $("ctl-tree").innerHTML = `<div class="empty">${t("lblCreditComputing")}</div>`;
    try {
      const data = await call("credit.compute", { prId, force });
      credit = data.result;
      renderCreditSummary($("ctl-score"), credit);
      renderCreditTree($("ctl-tree"), credit, {});
      const notes = [];
      if (!credit.diagnostics?.gitDiffAvailable) notes.push(t("lblGitOff"));
      if (data.cacheMiss) notes.push(`${t("lblCreditRecomputed")}\uFF1A${data.cacheMiss}`);
      const hint = $("ctl-tree-hint");
      hint.textContent = notes.join("\uFF1B");
      hint.hidden = notes.length === 0;
      show("result");
    } catch (e) {
      credit = null;
      $("ctl-tree").innerHTML = `<div class="empty">${t("errLoadFailed")}${esc2(e.message)}</div>`;
    }
  }
  function collectEvidence(node, out = []) {
    if (!node) return out;
    const ev = node.result?.evidence ?? [];
    if (ev.length > 0) out.push(node);
    for (const c of node.children ?? []) collectEvidence(c, out);
    return out;
  }
  function renderEvidenceView() {
    const host2 = $("ctl-view-evidence");
    if (!credit?.tree) {
      host2.innerHTML = `<div class="empty">${t("lblNoCredit")}</div>`;
      return;
    }
    const nodes = collectEvidence(credit.tree);
    if (nodes.length === 0) {
      host2.innerHTML = `<div class="empty">${t("lblNoEvidenceYet")}</div>`;
      return;
    }
    host2.innerHTML = `<div class="row" style="justify-content: space-between; align-items: baseline">
         <h2>${esc2(t("lblEvidence"))}</h2>
         <button id="btn-back-result-2" data-i18n="btnBack">${esc2(t("btnBack"))}</button>
       </div>` + nodes.map((n) => {
      const name = n.node?.name?.[getLocale()] ?? n.node?.name?.["zh-CN"] ?? n.node?.id;
      const items = (n.result.evidence ?? []).map((e) => `<li>${esc2(evidenceText(e))}</li>`).join("");
      return `<div class="panel"><div class="ct-name">${esc2(name)}${n.result.score == null ? "" : ` \xB7 ${Number(n.result.score).toFixed(1)}`}</div><ul class="ev-list">${items}</ul></div>`;
    }).join("");
    $("btn-back-result-2")?.addEventListener("click", () => show("result"));
  }
  function evidenceText(e) {
    if (e.kind === "task") return `${t("evTask")}: ${(e.ids ?? []).join(", ")}${e.label ? ` \u2014 ${e.label}` : ""}`;
    if (e.kind === "file") return `${t("evFile")}: ${(e.uris ?? []).join(", ")}${e.label ? ` \u2014 ${e.label}` : ""}`;
    if (e.kind === "prompt") return `${t("evPrompt")}: ${String(e.text ?? "").slice(0, 200)}`;
    return `${t("evNote")}: ${String(e.label ?? e.text ?? e.rationale ?? "").slice(0, 200)}`;
  }
  async function loadCommit() {
    if (!prId) return;
    show("commit");
    $("commit-msg-status").textContent = t("msgWorking");
    try {
      const [{ files }, cfg] = await Promise.all([
        call("credit.getChangedFiles"),
        call("credit.getConfig").catch(() => null)
      ]);
      changedFiles = files ?? [];
      if (cfg?.thresholds?.commitWarning != null) warnThreshold = cfg.thresholds.commitWarning;
      renderCommitFiles();
      renderCommitMsg();
      renderCommitWarning();
      $("commit-msg-status").textContent = "";
    } catch (e) {
      $("commit-msg-status").textContent = `${t("msgFail")}${e.message}`;
    }
  }
  function renderCommitFiles() {
    const host2 = $("commit-files");
    if (changedFiles.length === 0) {
      host2.innerHTML = `<div class="empty">${t("lblNoChanges")}</div>`;
      return;
    }
    host2.innerHTML = changedFiles.map(
      (f, i) => `<label class="commit-file">
          <input type="checkbox" data-idx="${i}" checked />
          <span class="cf-path">${esc2(f.path)}</span>
          <span class="cf-status">${esc2(f.status ?? "")}</span>
        </label>`
    ).join("");
    host2.querySelectorAll("input[type=checkbox]").forEach(
      (el) => el.addEventListener("change", renderCommitMsg)
    );
  }
  function selectedFiles() {
    const host2 = $("commit-files");
    return [...host2.querySelectorAll("input[type=checkbox]")].filter((el) => el.checked).map((el) => changedFiles[Number(el.dataset.idx)]?.path).filter(Boolean);
  }
  function creditLine() {
    const s = credit?.summary;
    if (!s) return "";
    const band = s.bandLabel?.[getLocale()] ?? s.band ?? "";
    return `CREDIT: score=${Number(s.prCredit).toFixed(1)} grade=${band} summary=${s.overallComment ?? ""} pr=${prId ?? ""}`;
  }
  function renderCommitMsg() {
    const subject = $("commit-subject").value.trim();
    const files = selectedFiles().map((p) => `- ${p}`).join("\n");
    const parts = [subject || t("phCommitSubject")];
    if (files) parts.push(files);
    const line = creditLine();
    if (line) parts.push(line);
    $("commit-msg").value = parts.join("\n\n");
  }
  function renderCommitWarning() {
    const warn = $("commit-warning");
    const score = Number(credit?.summary?.prCredit);
    if (!Number.isFinite(score) || score >= warnThreshold) {
      warn.hidden = true;
      return;
    }
    warn.hidden = false;
    warn.textContent = t("warnLowScore").replace("{score}", score.toFixed(1)).replace("{threshold}", String(warnThreshold));
  }
  $("btn-start").addEventListener("click", () => act("credit.start", {}, "msgStarted"));
  $("btn-finish").addEventListener("click", async () => {
    const data = await act("credit.finish", {}, "msgFinished");
    if (data) await loadResult(false);
  });
  $("btn-reset").addEventListener(
    "click",
    () => act("credit.reset", {}, "msgReset", "confirmReset")
  );
  $("btn-refresh").addEventListener("click", () => refresh());
  $("btn-view-result").addEventListener("click", () => loadResult(false));
  $("btn-recompute-credit").addEventListener("click", () => loadResult(true));
  $("btn-to-evidence").addEventListener("click", () => {
    renderEvidenceView();
    show("evidence");
  });
  $("btn-back-home").addEventListener("click", () => show("home"));
  $("btn-to-commit").addEventListener("click", () => loadCommit());
  $("btn-back-result").addEventListener("click", () => show("result"));
  $("commit-select-all").addEventListener("click", () => {
    $("commit-files").querySelectorAll("input[type=checkbox]").forEach((el) => el.checked = true);
    renderCommitMsg();
  });
  $("commit-select-none").addEventListener("click", () => {
    $("commit-files").querySelectorAll("input[type=checkbox]").forEach((el) => el.checked = false);
    renderCommitMsg();
  });
  $("commit-subject").addEventListener("input", renderCommitMsg);
  $("btn-commit").addEventListener("click", async () => {
    const files = selectedFiles();
    if (files.length === 0) {
      $("commit-msg-status").textContent = t("msgNoFiles");
      return;
    }
    $("commit-msg-status").textContent = t("msgWorking");
    try {
      const r = await call("credit.commitAndPush", {
        files,
        message: $("commit-msg").value,
        push: false
      });
      $("commit-msg-status").textContent = `${t("msgCommitDone")}${r.commitHash ?? ""}`;
      await refresh();
    } catch (e) {
      $("commit-msg-status").textContent = `${t("msgFail")}${e.message}`;
    }
  });
  $("btn-push").addEventListener("click", async () => {
    if (!await askConfirm(VIEW_HOSTS.commit, { message: t("confirmPush") })) return;
    $("commit-msg-status").textContent = t("msgWorking");
    try {
      const r = await call("credit.push");
      $("commit-msg-status").textContent = r.pushed ? t("msgPushDone") : t("msgPushNoop");
    } catch (e) {
      $("commit-msg-status").textContent = `${t("msgFail")}${e.message}`;
    }
  });
  $("btn-copy-msg").addEventListener("click", async () => {
    try {
      await opts.copyText?.($("commit-msg").value);
      $("commit-msg-status").textContent = t("msgCopied");
    } catch (e) {
      $("commit-msg-status").textContent = `${t("msgFail")}${e.message}`;
    }
  });
  function esc2(s) {
    return String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  }
  return {
    refresh,
    start() {
      if (!progressOff) progressOff = transport2.onProgress(onProgress);
      refresh();
      renderDevOverview();
    },
    stop() {
      progressOff?.();
      progressOff = null;
    },
    /** 外部（ui.js）在换 Tab / 语言切换后调用 */
    applyI18n() {
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
      });
      root.querySelectorAll("[data-i18n-ph]").forEach((el) => {
        el.placeholder = t(el.dataset.i18nPh);
      });
      if (credit) {
        renderCreditSummary($("ctl-score"), credit);
        renderCreditTree($("ctl-tree"), credit, {});
      }
      renderCommitMsg();
      renderCommitWarning();
    },
    /** 会话结束后由 ui.js 调用，进入结果视图 */
    showResult: () => loadResult(false),
    show
  };
}

// source/ui/gantt.js
var STAGE_ORDER = [
  "spec-engineering",
  "test-planning",
  "ai-code-generation",
  "ai-testing",
  "ai-fix",
  "manual-verification",
  "ai-review"
];
var MIN_SPAN_MS = 1e3;
var ZOOM_STEP = 1.15;
var DRAG_THRESHOLD = 4;
var TICK_COUNT = 4;
var NARROW_BLOCK_PX = 4;
var vp = null;
var vpForPr = null;
var bounds = null;
var lastArgs = null;
var lastDragMoved = false;
var drag = null;
var rafPending = false;
var boundHosts = /* @__PURE__ */ new WeakSet();
function stageColor(stage) {
  return `var(--st-${stage}, var(--st-unknown))`;
}
function stageRgb(stage) {
  return `var(--st-rgb-${stage}, var(--st-rgb-unknown))`;
}
var ALPHA_RANGE = {
  dark: { ai: 0.22, dev: 0.9 },
  light: { ai: 0.42, dev: 0.95 }
};
function isLightTheme() {
  return document.documentElement.getAttribute("data-bf-appearance-mode") === "light";
}
function alphaFor(ai) {
  const v = Number.isFinite(ai) ? Math.min(1, Math.max(0, ai)) : 0;
  const r = isLightTheme() ? ALPHA_RANGE.light : ALPHA_RANGE.dark;
  return r.ai + (1 - v) * (r.dev - r.ai);
}
function buildSolid(stage, ai) {
  return `rgb(${stageRgb(stage)} / ${alphaFor(ai).toFixed(2)})`;
}
function buildGradient(spectrum, stage, fallbackAi) {
  const pts = Array.isArray(spectrum) ? spectrum : [];
  if (pts.length < 2) return buildSolid(stage, fallbackAi);
  const base = stageRgb(stage);
  const stops = pts.map(
    (p) => `rgb(${base} / ${alphaFor(p.ai).toFixed(2)}) ${(Math.min(1, Math.max(0, p.t)) * 100).toFixed(1)}%`
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
function fmtDur(ms) {
  if (ms < 1e3) return `${Math.round(ms)}ms`;
  if (ms < 6e4) return `${(ms / 1e3).toFixed(0)}s`;
  if (ms < 36e5) return `${(ms / 6e4).toFixed(1)}m`;
  return `${(ms / 36e5).toFixed(1)}h`;
}
function fmtClock(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function buildMarks(task) {
  const marks = [];
  const c = task.counts ?? {};
  if (c["prompt.submit"]) marks.push({ cls: "prompt", title: `prompt \xD7${c["prompt.submit"]}` });
  if (task.metrics?.testFailed)
    marks.push({ cls: "test-fail", title: `\u6D4B\u8BD5\u5931\u8D25 ${task.metrics.testFailed}` });
  else if (task.metrics?.testRunCount)
    marks.push({ cls: "test-pass", title: `\u6D4B\u8BD5\u8FD0\u884C ${task.metrics.testRunCount}` });
  if (c["edit"]) marks.push({ cls: "edit", title: `\u7F16\u8F91 \xD7${c["edit"]}` });
  if (task.stage === "ai-review") marks.push({ cls: "review", title: "AI Review" });
  return marks;
}
function trackRect(host2) {
  const t2 = host2.querySelector(".lane-track");
  return t2 ? t2.getBoundingClientRect() : host2.getBoundingClientRect();
}
function clampVp(start, end, min, max) {
  const total = Math.max(1, max - min);
  const span = Math.min(Math.max(end - start, MIN_SPAN_MS), total);
  const s = Math.max(min, Math.min(start, max - span));
  return { start: s, end: s + span };
}
function scheduleApply() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    applyViewport(lastArgs?.host ?? null);
  });
}
function setRange(vs, ve) {
  if (!bounds) return;
  const c = clampVp(vs, ve, bounds.min, bounds.max);
  bounds.vs = c.start;
  bounds.ve = c.end;
  vp = { start: c.start, end: c.end };
  scheduleApply();
}
function applyViewport(host2) {
  if (!host2 || !bounds) return;
  const { vs, ve, min, max } = bounds;
  const span = Math.max(1, ve - vs);
  const pct = (ts) => (ts - vs) / span * 100;
  const trackW = host2.querySelector(".lane-track")?.getBoundingClientRect().width ?? 0;
  for (const el of host2.querySelectorAll(".task-block")) {
    const s0 = Number(el.dataset.s0);
    const s1 = Number(el.dataset.s1);
    const visible = !(s1 < vs || s0 > ve);
    el.hidden = !visible;
    if (!visible) continue;
    el.style.left = `${pct(s0)}%`;
    el.style.width = `max(0.6%, ${Math.max(0.5, (s1 - s0) / span * 100)}%)`;
    const fill = el.querySelector(".fill");
    if (fill) {
      const wPx = trackW > 0 ? (s1 - s0) / span * trackW : Number.POSITIVE_INFINITY;
      fill.style.background = wPx < NARROW_BLOCK_PX ? el.dataset.solid || "" : el.dataset.grad || el.dataset.solid || "";
    }
  }
  for (const el of host2.querySelectorAll(".axis-tick")) {
    const i = Number(el.dataset.i);
    el.textContent = fmtClock(vs + span * i / TICK_COUNT);
  }
  const axisStart = host2.querySelector(".axis-start");
  if (axisStart) axisStart.textContent = fmtClock(vs);
  const level = host2.querySelector(".zoom-level");
  if (level) {
    const ratio = Math.max(1, max - min) / span;
    level.textContent = `${ratio.toFixed(1)}\xD7 \xB7 ${fmtClock(vs)}\u2013${fmtClock(ve)}`;
  }
  const zin = host2.querySelector(".zoom-btn-in");
  const zout = host2.querySelector(".zoom-btn-out");
  const zreset = host2.querySelector(".zoom-reset");
  const total = Math.max(1, max - min);
  if (zout) zout.disabled = span >= total;
  if (zin) zin.disabled = span <= MIN_SPAN_MS * 1.01;
  if (zreset) zreset.disabled = vp === null;
}
function bindInteractions(host2) {
  host2.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (!bounds) return;
      const rect = trackRect(host2);
      if (rect.width <= 0) return;
      e.preventDefault();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const { vs, ve } = bounds;
      const span = ve - vs;
      const focus = vs + ratio * span;
      const ns = span * (e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
      setRange(focus - ratio * ns, focus - ratio * ns + ns);
    },
    { passive: false }
  );
  host2.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !bounds) return;
    lastDragMoved = false;
    drag = {
      x: e.clientX,
      vs: bounds.vs,
      ve: bounds.ve,
      id: e.pointerId,
      captured: false
    };
  });
  host2.addEventListener("pointermove", (e) => {
    if (!drag || !bounds) return;
    const dx = e.clientX - drag.x;
    if (!drag.captured && Math.abs(dx) > DRAG_THRESHOLD) {
      lastDragMoved = true;
      drag.captured = true;
      try {
        host2.setPointerCapture(drag.id);
      } catch {
      }
      host2.querySelector(".gantt")?.classList.add("grabbing");
    }
    if (!lastDragMoved) return;
    const rect = trackRect(host2);
    if (rect.width <= 0) return;
    const dt = dx / rect.width * (drag.ve - drag.vs);
    setRange(drag.vs - dt, drag.ve - dt);
  });
  const endDrag = (e) => {
    if (!drag) return;
    if (drag.captured) {
      try {
        host2.releasePointerCapture(e.pointerId);
      } catch {
      }
    }
    drag = null;
    host2.querySelector(".gantt")?.classList.remove("grabbing");
  };
  host2.addEventListener("pointerup", endDrag);
  host2.addEventListener("pointercancel", endDrag);
  host2.addEventListener("dblclick", () => {
    if (!bounds) return;
    vp = null;
    bounds.vs = bounds.min;
    bounds.ve = bounds.max;
    scheduleApply();
  });
}
function renderGantt(host2, graph, opts = {}) {
  host2.innerHTML = "";
  lastArgs = { host: host2, graph, opts };
  if (!graph || !graph.tasks?.length) {
    bounds = null;
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "\uFF08\u65E0 Task \u6570\u636E\uFF09";
    host2.appendChild(empty);
    return;
  }
  if (vpForPr !== graph.prId) {
    vp = null;
    vpForPr = graph.prId;
  }
  const tasks = graph.tasks;
  const min = Math.min(...tasks.map((t2) => t2.startTs));
  const max = Math.max(...tasks.map((t2) => t2.endTs));
  const vs = vp?.start ?? min;
  const ve = vp?.end ?? max;
  bounds = { min, max, vs, ve };
  const span = Math.max(1, ve - vs);
  const pct = (ts) => (ts - vs) / span * 100;
  const bar = document.createElement("div");
  bar.className = "gantt-zoom";
  const tip = document.createElement("span");
  tip.className = "hint";
  tip.style.marginTop = "0";
  tip.textContent = t("hintZoom");
  const level = document.createElement("span");
  level.className = "zoom-level mono";
  bar.append(tip, level);
  const mkZoomBtn = (label, title, cls, factor) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `zoom-btn ${cls}`;
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener("click", () => {
      if (!bounds) return;
      const center = bounds.vs + (bounds.ve - bounds.vs) / 2;
      const ns = (bounds.ve - bounds.vs) * factor;
      setRange(center - ns / 2, center + ns / 2);
    });
    return btn;
  };
  bar.append(
    mkZoomBtn("\u2212", t("btnZoomOut"), "zoom-btn-out", ZOOM_STEP),
    mkZoomBtn("+", t("btnZoomIn"), "zoom-btn-in", 1 / ZOOM_STEP)
  );
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "zoom-reset";
  reset.textContent = t("btnResetZoom");
  reset.addEventListener("click", () => {
    if (!bounds) return;
    vp = null;
    bounds.vs = bounds.min;
    bounds.ve = bounds.max;
    scheduleApply();
  });
  bar.appendChild(reset);
  host2.appendChild(bar);
  const wrap = document.createElement("div");
  wrap.className = "gantt";
  const axis = document.createElement("div");
  axis.className = "axis";
  const axisLabel = document.createElement("div");
  axisLabel.className = "lane-label axis-start";
  const scale = document.createElement("div");
  scale.className = "axis-scale";
  for (let i = 0; i <= TICK_COUNT; i++) {
    const tick = document.createElement("span");
    tick.className = "axis-tick";
    tick.dataset.i = String(i);
    tick.style.left = `${i / TICK_COUNT * 100}%`;
    scale.appendChild(tick);
  }
  axis.append(axisLabel, scale);
  wrap.appendChild(axis);
  const byStage = new Map(STAGE_ORDER.map((s) => [s, []]));
  for (const t2 of tasks) {
    const spans = t2.spans?.length ? t2.spans : [{ stage: t2.stage, weight: 1, startTs: t2.startTs, endTs: t2.endTs }];
    for (const sp of spans) {
      const key = byStage.has(sp.stage) ? sp.stage : "ai-code-generation";
      byStage.get(key).push({ task: t2, span: sp });
    }
  }
  for (const stage of STAGE_ORDER) {
    const list = byStage.get(stage) ?? [];
    const lane = document.createElement("div");
    lane.className = `gantt-lane${list.length === 0 ? " empty" : ""}`;
    const label = document.createElement("div");
    label.className = "lane-label";
    const dot = document.createElement("span");
    dot.className = "lane-dot";
    dot.style.background = stageColor(stage);
    const name = document.createElement("span");
    name.textContent = tStage(stage);
    label.append(dot, name);
    const track = document.createElement("div");
    track.className = "lane-track";
    for (const item of list) {
      const t2 = item.task;
      const sp = item.span;
      const s0 = sp.startTs || t2.startTs;
      const s1 = sp.endTs || t2.endTs;
      const block = document.createElement("button");
      block.type = "button";
      block.className = "task-block";
      block.dataset.s0 = String(s0);
      block.dataset.s1 = String(s1);
      block.dataset.grad = buildGradient(t2.spectrum, stage, t2.metrics.aiRatio);
      block.dataset.solid = buildSolid(stage, t2.metrics.aiRatio);
      const head = `${tStage(sp.stage)} \xB7 ${fmtDur(s1 - s0)} \xB7 AI ${Math.round(
        t2.metrics.aiRatio * 100
      )}%${(t2.spans?.length ?? 0) > 1 ? ` \xB7 ${t("lblSubspan")}` : ""}`;
      const body = t2.desc || t2.behaviorSummary || "";
      block.title = body ? `${head}
${body}` : head;
      const fill = document.createElement("span");
      fill.className = "fill";
      block.append(fill);
      const marks = buildMarks(t2);
      if (marks.length > 0) {
        const m = document.createElement("span");
        m.className = "marks";
        for (const mk of marks) {
          const el = document.createElement("span");
          el.className = `mark ${mk.cls}`;
          el.title = mk.title;
          m.appendChild(el);
        }
        block.appendChild(m);
      }
      if (opts.selectedId === t2.id) block.setAttribute("aria-selected", "true");
      block.addEventListener("click", () => {
        if (lastDragMoved) return;
        opts.onSelect?.(t2);
      });
      track.appendChild(block);
    }
    lane.append(label, track);
    wrap.appendChild(lane);
  }
  host2.appendChild(wrap);
  if (!boundHosts.has(host2)) {
    bindInteractions(host2);
    boundHosts.add(host2);
  }
  applyViewport(host2);
}
function resetZoom() {
  vp = null;
  vpForPr = null;
  bounds = null;
  drag = null;
  lastDragMoved = false;
}

// source/ui/analytic-layer.js
function card(title, summary) {
  const el = document.createElement("div");
  el.className = "analytic";
  const h = document.createElement("h3");
  h.textContent = title;
  const s = document.createElement("div");
  s.className = "summary";
  s.textContent = summary ?? "";
  el.append(h, s);
  return el;
}
function renderSpectrum(view) {
  const d = view.data;
  const el = card("AI \u53C2\u4E0E\u5EA6\u5149\u8C31", view.summary);
  if (!d?.points?.length) return el;
  const box = document.createElement("div");
  box.className = "spectrum";
  for (const p of d.points) {
    const bar = document.createElement("div");
    bar.className = `spectrum-bar${p.aiRatio < 0.5 ? " low" : ""}`;
    bar.style.height = `${Math.max(4, Math.round(p.aiRatio * 100))}%`;
    bar.title = `${p.taskId} \xB7 AI ${Math.round(p.aiRatio * 100)}% \xB7 ${p.desc ?? ""}`;
    box.appendChild(bar);
  }
  el.appendChild(box);
  return el;
}
function renderPattern(view) {
  const d = view.data;
  const el = card("\u534F\u4F5C\u6A21\u5F0F\u753B\u50CF", view.summary);
  if (!d) return el;
  const badge = document.createElement("span");
  badge.className = "pattern-badge";
  badge.textContent = d.pattern ? tPattern(d.pattern) : "-";
  el.appendChild(badge);
  const grid = document.createElement("dl");
  grid.className = "detail-grid";
  grid.style.marginTop = "8px";
  const s = d.signals ?? {};
  const rows = [
    ["\u884C\u4E3A\u603B\u6570", s.total],
    ["AI \u5360\u6BD4", s.aiRatio != null ? `${Math.round(s.aiRatio * 100)}%` : "-"],
    ["Dev \u7F16\u8F91\u884C\u5360\u6BD4", s.devEditRatio != null ? `${Math.round(s.devEditRatio * 100)}%` : "-"],
    ["\u9605\u8BFB\u884C\u4E3A\u5360\u6BD4", s.readRatio != null ? `${Math.round(s.readRatio * 100)}%` : "-"],
    ["\u6BCF Task prompt \u6570", s.promptPerTask],
    ["AI \u5DE5\u5177\u8C03\u7528", s.toolCalls]
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = String(v ?? "-");
    grid.append(dt, dd);
  }
  el.appendChild(grid);
  return el;
}
function renderGeneric(view, layerName) {
  const el = card(layerName ?? view.id, view.summary);
  if (view.data != null) {
    const pre = document.createElement("div");
    pre.className = "mono";
    pre.style.cssText = "font-size:11px;color:var(--text-dim);margin-top:8px;max-height:120px;overflow:auto";
    pre.textContent = JSON.stringify(view.data, null, 1).slice(0, 800);
    el.appendChild(pre);
  }
  return el;
}
function renderAnalytics(host2, analytics, layerNames = {}) {
  host2.innerHTML = "";
  if (!analytics?.length) return;
  for (const v of analytics) {
    let el;
    if (v.data == null) {
      el = card(layerNames[v.id]?.name?.["zh-CN"] ?? v.id, v.summary);
      el.classList.add("unavailable");
    } else if (v.id === "ai-involvement") {
      el = renderSpectrum(v);
    } else if (v.id === "collab-pattern") {
      el = renderPattern(v);
    } else {
      el = renderGeneric(v, layerNames[v.id]?.name?.["zh-CN"]);
    }
    for (const w of v.warnings ?? []) {
      const p = document.createElement("div");
      p.className = "warn";
      p.textContent = w;
      el.appendChild(p);
    }
    host2.appendChild(el);
  }
}

// source/ui/behavior-summary.js
var DEFAULT_MAX_CHARS = 120;
function flatten(s, maxChars) {
  const t2 = String(s ?? "").replace(/\s+/g, " ").trim();
  if (!t2) return "";
  return t2.length > maxChars ? `${t2.slice(0, maxChars)}\u2026` : t2;
}
function basename(uri) {
  return String(uri ?? "").split(/[\\/]/).pop() || String(uri ?? "");
}
function diffSummary(ctx) {
  const diff = ctx?.diff;
  if (Array.isArray(diff) && diff.length > 0) {
    const parts = [];
    for (const h of diff.slice(0, 4)) {
      const op = h?.op === "delete" ? "-" : h?.op === "insert" ? "+" : "~";
      const lines = Array.isArray(h?.lines) ? h.lines : [];
      for (const l of lines.slice(0, 3)) parts.push(`${op} ${String(l).trim()}`);
    }
    if (parts.length > 0) return parts.join(" | ");
  }
  const before = ctx?.before;
  const after = ctx?.after;
  if (before || after) {
    return `${flatten(before, 60)} -> ${flatten(after, 60)}`;
  }
  return "";
}
function toolInputSummary(input) {
  if (!input || typeof input !== "object") return "";
  const pick = (k) => typeof input[k] === "string" ? input[k] : void 0;
  const preferred = pick("cmd") ?? pick("command") ?? pick("pattern") ?? pick("path") ?? pick("file_path") ?? pick("query") ?? pick("description");
  if (preferred) return preferred;
  const keys = Object.keys(input).slice(0, 3);
  return keys.map((k) => `${k}=${flatten(input[k], 20)}`).join(", ");
}
function extract(b) {
  const ctx = b?.context ?? {};
  switch (b?.action) {
    case "prompt.submit":
      return String(ctx.promptText ?? "");
    case "edit":
      return diffSummary(ctx);
    case "terminal.exec": {
      const cmd = String(ctx.cmd ?? "").trim();
      const out = flatten(ctx.output, 80);
      return out ? `${cmd} | ${out}` : cmd;
    }
    case "agent.tool": {
      const name = String(ctx.toolName ?? "");
      const input = toolInputSummary(ctx.toolInput);
      const out = flatten(ctx.output, 60);
      return [name, input, out].filter(Boolean).join(" | ");
    }
    case "agent.message":
      return String(ctx.after ?? "");
    case "file.open":
    case "view":
    case "file.scroll":
    case "cursor": {
      const uri = basename(b?.object?.uri);
      const lr = b?.object?.lineRange;
      if (Array.isArray(lr) && lr.length === 2) return `${uri}:${lr[0]}-${lr[1]}`;
      return uri;
    }
    default:
      return String(ctx.cmd ?? ctx.promptText ?? ctx.after ?? b?.object?.uri ?? "");
  }
}
function describeBehavior(b, opts = {}) {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  const raw = extract(b);
  const full = String(raw ?? "").replace(/\s+/g, " ").trim();
  return { text: flatten(raw, maxChars), full };
}

// source/ui/view-history.js
var LAYER_NAMES = {
  "ai-involvement": { name: { "zh-CN": "AI \u53C2\u4E0E\u5EA6\u5149\u8C31" } },
  "collab-pattern": { name: { "zh-CN": "\u534F\u4F5C\u6A21\u5F0F\u753B\u50CF" } }
};
function createHistoryView(root, transport2) {
  const $ = (id) => root.querySelector(`#${id}`);
  const call = (method, params) => transport2.call(method, params ?? {});
  let graph = null;
  let selectedTask = null;
  let currentPrId = null;
  let credit = null;
  async function loadList() {
    const list = $("pr-list");
    list.innerHTML = `<div class="empty">${t("lblLoading")}</div>`;
    try {
      const { items } = await call("credit.listPrs");
      list.innerHTML = "";
      if (items.length === 0) {
        list.innerHTML = `<div class="empty">${t("lblNoPr")}</div>`;
        return;
      }
      for (const it of items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pr-item";
        btn.setAttribute("aria-selected", "false");
        const id = document.createElement("span");
        id.className = "pr-id";
        id.textContent = it.prId;
        const meta = document.createElement("span");
        meta.className = "pr-meta";
        meta.textContent = `${it.behaviorCount} \u6761 \xB7 ${new Date(it.mtimeMs).toLocaleString()}`;
        btn.append(id, meta);
        btn.addEventListener("click", () => selectPr(it.prId));
        list.appendChild(btn);
      }
      selectPr(items[0].prId);
    } catch (e) {
      list.innerHTML = `<div class="empty">${t("errLoadFailed")}${e.message}</div>`;
    }
  }
  function markSelected(prId) {
    root.querySelectorAll(".pr-item").forEach((el) => {
      const isSel = el.querySelector(".pr-id")?.textContent === prId;
      el.setAttribute("aria-selected", isSel ? "true" : "false");
    });
  }
  async function loadCredit(prId, { force = false } = {}) {
    const treeHost = $("credit-tree");
    const sumHost = $("credit-summary");
    const hint = $("credit-hint");
    sumHost.hidden = true;
    hint.hidden = true;
    treeHost.innerHTML = `<div class="empty">${t("lblCreditComputing")}</div>`;
    try {
      const data = await call("credit.compute", { prId, force });
      credit = data.result;
      renderCreditSummary(sumHost, credit);
      renderCreditTree(treeHost, credit, { onTaskJump: jumpToTask });
      $("credit-recompute").hidden = false;
      const notes = [];
      if (!credit.diagnostics?.gitDiffAvailable) notes.push(t("lblGitOff"));
      if (data.cacheMiss) notes.push(`${t("lblCreditRecomputed")}\uFF1A${data.cacheMiss}`);
      if (notes.length > 0) {
        hint.textContent = notes.join("\uFF1B");
        hint.hidden = false;
      }
    } catch (e) {
      credit = null;
      treeHost.innerHTML = `<div class="empty">${t("errLoadFailed")}${e.message}</div>`;
    }
  }
  function jumpToTask(taskId) {
    const task = graph?.tasks?.find((x) => x.id === taskId);
    if (!task) return;
    selectTask(task);
    $("detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  async function selectPr(prId, { force = false } = {}) {
    currentPrId = prId;
    selectedTask = null;
    resetZoom();
    markSelected(prId);
    const host2 = $("gantt-host");
    host2.innerHTML = `<div class="empty">${t("lblLoading")}</div>`;
    $("detail").innerHTML = "";
    $("detail").hidden = true;
    try {
      const data = await call("credit.getTaskStageView", { prId, force });
      graph = data.graph;
      renderAnalytics($("analytics"), data.analytics, LAYER_NAMES);
      renderModelHint();
      renderGantt(host2, graph, { onSelect: selectTask });
      $("recompute").hidden = false;
      loadCredit(prId, { force });
    } catch (e) {
      host2.innerHTML = `<div class="empty">${t("errLoadFailed")}${e.message}</div>`;
      $("analytics").innerHTML = "";
    }
  }
  function renderModelHint() {
    const host2 = $("model-hint");
    if (!host2) return;
    const d = graph?.diagnostics ?? {};
    const llmCalls = d.llmCalls ?? 0;
    if (llmCalls === 0) {
      host2.textContent = t("hintLlmOff");
      host2.hidden = false;
    } else {
      host2.textContent = "";
      host2.hidden = true;
    }
  }
  async function selectTask(task) {
    selectedTask = task;
    renderGantt($("gantt-host"), graph, { onSelect: selectTask, selectedId: task.id });
    renderDetail(task);
    try {
      const ids = task.bs.slice(0, 200);
      const { items } = await call("credit.getBehaviors", { prId: currentPrId, ids });
      renderBehaviorList(items);
    } catch {
      $("behavior-list").innerHTML = `<div class="empty">${t("errLoadFailed")}-</div>`;
    }
  }
  function basename2(uri) {
    return String(uri).split(/[\\/]/).pop() || String(uri);
  }
  function addExtraRow(host2, label, value) {
    if (!value) return;
    const row = document.createElement("div");
    row.className = "detail-extra-row";
    const k = document.createElement("span");
    k.className = "detail-extra-key";
    k.textContent = label;
    const v = document.createElement("span");
    v.className = "detail-extra-val";
    v.textContent = value;
    row.append(k, v);
    host2.appendChild(row);
  }
  function renderDetail(task) {
    const host2 = $("detail");
    host2.innerHTML = "";
    host2.hidden = false;
    const head = document.createElement("div");
    head.className = "detail-head";
    const h3 = document.createElement("h3");
    h3.textContent = task.desc || task.behaviorSummary || task.id;
    const badge = document.createElement("span");
    badge.className = "pattern-badge";
    badge.textContent = tTaskType(task.fp?.taskType);
    head.append(h3, badge);
    host2.appendChild(head);
    const meta = document.createElement("div");
    meta.className = "detail-meta";
    meta.textContent = [
      tStage(task.stage),
      fmtDur(task.durationMs),
      `${t("lblAiRatio")} ${Math.round((task.metrics?.aiRatio ?? 0) * 100)}%`,
      `${task.metrics?.behaviorCount ?? 0} ${t("lblBehaviors")}`,
      `Dev ${task.metrics?.devBehaviors ?? 0} / AI ${task.metrics?.aiBehaviors ?? 0}`
    ].join("  \xB7  ");
    host2.appendChild(meta);
    const extra = document.createElement("div");
    extra.className = "detail-extra";
    if (task.desc) addExtraRow(extra, t("lblSummary"), task.behaviorSummary);
    if (task.spans?.length > 1) {
      addExtraRow(
        extra,
        t("lblSpans"),
        task.spans.map((s) => `${tStage(s.stage)} ${Math.round(s.weight * 100)}%`).join(" \xB7 ")
      );
    }
    if (task.files?.length > 0) {
      const names = task.files.slice(0, 6).map((f) => basename2(f.uri)).join(", ");
      addExtraRow(
        extra,
        `${t("lblFiles")}\uFF08${task.files.length}\uFF09`,
        task.files.length > 6 ? `${names} \u2026` : names
      );
    }
    if (extra.childElementCount > 0) host2.appendChild(extra);
    const bTitle = document.createElement("div");
    bTitle.className = "detail-section";
    bTitle.textContent = t("lblBehaviorsInTask");
    host2.appendChild(bTitle);
    const listHost = document.createElement("div");
    listHost.id = "behavior-list";
    listHost.className = "behavior-list";
    listHost.innerHTML = `<div class="empty">${t("lblLoading")}</div>`;
    host2.appendChild(listHost);
  }
  function renderBehaviorList(items) {
    const host2 = $("behavior-list");
    if (!host2) return;
    host2.innerHTML = "";
    if (!items?.length) {
      host2.innerHTML = `<div class="empty">-</div>`;
      return;
    }
    for (const b of items) {
      const row = document.createElement("div");
      row.className = "behavior-row";
      const ts = document.createElement("span");
      ts.className = "ts";
      ts.textContent = new Date(b.ts).toLocaleTimeString();
      const act = document.createElement("span");
      act.className = "act";
      act.textContent = `${b.actor}:${b.action}`;
      const { text, full } = describeBehavior(b, { maxChars: 120 });
      const txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = text || "\u2014";
      txt.title = full || text || "";
      row.append(ts, act, txt);
      host2.appendChild(row);
    }
  }
  $("recompute").addEventListener("click", () => {
    if (currentPrId) selectPr(currentPrId, { force: true });
  });
  $("credit-recompute").addEventListener("click", () => {
    if (currentPrId) loadCredit(currentPrId, { force: true });
  });
  return {
    refresh: loadList,
    start() {
      if (!graph) loadList();
    },
    stop() {
    },
    applyI18n() {
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
      });
      if (!graph) return;
      renderModelHint();
      if (selectedTask) {
        selectTask(selectedTask);
      } else {
        renderGantt($("gantt-host"), graph, { onSelect: selectTask });
      }
      if (credit) {
        renderCreditSummary($("credit-summary"), credit);
        renderCreditTree($("credit-tree"), credit, { onTaskJump: jumpToTask });
      }
    }
  };
}

// source/ui/view-profile.js
var FULL_MARK_LINES = 5e5;
function scoreOfLines(lines, scale = "log") {
  const L = Math.max(0, lines || 0);
  return scale === "linear" ? Math.min(100, L / FULL_MARK_LINES * 100) : Math.min(100, Math.log10(1 + L) / Math.log10(1 + FULL_MARK_LINES) * 100);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
function createProfileView(root, transport2) {
  const $ = (id) => root.querySelector(`#${id}`);
  const call = (method, params) => transport2.call(method, params ?? {});
  let lastDraft = null;
  let lastProfile = null;
  function renderStatus(data) {
    const initialized = data.initialized && data.profile;
    const st = $("pf-state");
    st.textContent = initialized ? t("profileReady") : t("profileEmpty");
    st.className = `state ${initialized ? "committed" : "idle"}`;
    $("pf-gituser").textContent = initialized ? data.profile.gitUser || "-" : "-";
    const gs = data.profile?.gitStats;
    $("pf-prstats").textContent = gs ? `${gs.mergedPrCount}/${gs.totalPrCount} merged` : t("prStatsNone");
    $("pf-updated").textContent = data.profile?.updatedAt?.slice(0, 19).replace("T", " ") || "-";
    lastProfile = data.profile;
    renderKeywords(initialized ? data.profile : null);
    renderTasks(initialized ? data.profile : null);
    renderDraft(data.draft);
    $("pf-init").disabled = !!initialized;
    $("pf-sync").disabled = !initialized;
    $("pf-update-pr").disabled = !initialized;
  }
  function localLinesOf(profile, name) {
    const key = String(name).trim().toLowerCase();
    const seen = /* @__PURE__ */ new Set();
    let total = 0;
    for (const task of profile.historyTasks ?? []) {
      if (seen.has(task.prId)) continue;
      if ((task.keywords ?? []).some((k) => String(k).trim().toLowerCase() === key)) {
        seen.add(task.prId);
        total += task.aiCollabLines;
      }
    }
    return total;
  }
  function renderKeywords(profile) {
    const host2 = $("pf-keywords");
    if (!profile || profile.techDomain.keywords.length === 0) {
      host2.innerHTML = `<div class="empty">${esc(t("noKeywords"))}</div>`;
      return;
    }
    const useGit = profile.techDomain.keywords.some((k) => k.gitLines > 0);
    const kws = [...profile.techDomain.keywords].map((k) => ({
      ...k,
      _local: localLinesOf(profile, k.name),
      // 单轨（D-043）：同步过 git 用 gitLines，否则退到本地 AI 协作行数
      _lines: useGit ? k.gitLines : localLinesOf(profile, k.name)
    })).sort((a, b) => b._lines - a._lines);
    host2.innerHTML = kws.map((k) => {
      const w = scoreOfLines(k._lines);
      return `
        <div class="kw-item">
          <div class="kw-head">
            <span class="kw-name">${esc(k.name)}</span>
            <span class="kw-meta">${esc(k.lastSeen)} \xB7 ${esc(k.source)}</span>
          </div>
          <div class="kw-bars">
            <div class="kw-bar-row">
              <span class="kw-bar-label">${esc(t("barLines"))}</span>
              <span class="kw-bar-track"><span class="kw-bar-fill total" style="width:${w}%"></span></span>
              <span class="kw-bar-val">${k._lines}${esc(t("unitLines"))} \xB7 ${w.toFixed(1)}${esc(t("lblCreditShort"))}</span>
            </div>
            <div class="kw-meta">git ${k.gitLines}${esc(t("unitLines"))} \xB7 ${esc(t("barLocal"))} ${k._local}${esc(t("unitLines"))}${useGit ? "" : `\uFF08${esc(t("hintLocalFallback"))}\uFF09`}</div>
          </div>
        </div>`;
    }).join("");
  }
  function renderTasks(profile) {
    const host2 = $("pf-tasks");
    const tasks = profile?.historyTasks ?? [];
    if (tasks.length === 0) {
      host2.innerHTML = `<div class="empty">${esc(t("noHistoryTasks"))}</div>`;
      return;
    }
    host2.innerHTML = [...tasks].sort((a, b) => b.ts - a.ts).map(
      (task) => `
      <div class="pf-task">
        <span class="t-id">${esc(task.prId)}</span>
        <span class="t-meta">${esc(new Date(task.ts).toISOString().slice(0, 10))} \xB7 ${esc(t("lblCreditShort"))} ${task.prCredit} \xB7 AI ${task.aiCollabLines}${esc(t("unitLines"))}</span>
      </div>`
    ).join("");
  }
  function renderDraft(draft) {
    lastDraft = draft?.profile ? draft : null;
    const panel = $("pf-draft-panel");
    if (!lastDraft) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const kws = lastDraft.profile.techDomain.keywords ?? [];
    const existing = new Set((lastProfile?.techDomain.keywords ?? []).map((k) => k.name.toLowerCase()));
    $("pf-draft-body").innerHTML = `<div class="hint">${esc(t("draftMeta").replace("{n}", kws.length).replace("{chars}", lastDraft.digestChars ?? "?").replace("{req}", lastDraft.requests ?? "?"))}</div><div>${kws.map((k) => `<span class="draft-kw${existing.has(k.name.toLowerCase()) ? "" : " new"}">${esc(k.name)} (${k.gitLines}${esc(t("unitLines"))})</span>`).join("")}</div>`;
  }
  async function refresh() {
    try {
      renderStatus(await call("credit.getProfile"));
    } catch (e) {
      $("pf-msg").textContent = `${t("msgFail")}${e.message}`;
    }
  }
  async function act(promise, okMsg) {
    $("pf-msg").textContent = t("msgWorking");
    try {
      const data = await promise;
      $("pf-msg").textContent = `${okMsg}${data.changes ? `\uFF08${data.changes}\uFF09` : ""}${data.digestChars ? ` \xB7 LLM \u8F93\u5165 ${data.digestChars} chars / ${data.requests} req` : ""}`;
      await refresh();
      return data;
    } catch (e) {
      $("pf-msg").textContent = `${t("msgFail")}${e.message}`;
      await refresh();
      return null;
    }
  }
  $("pf-init").addEventListener("click", () => {
    const homeUrl = $("pf-home-url").value.trim();
    if (!homeUrl) {
      $("pf-msg").textContent = t("msgNeedUrl");
      return;
    }
    act(call("credit.importProfileFromGit", { homeUrl }), t("msgInitDone"));
  });
  $("pf-sync").addEventListener("click", () => act(call("credit.syncProfileFromGit"), t("msgSyncDone")));
  $("pf-confirm").addEventListener("click", () => act(call("credit.confirmProfileDraft"), t("msgConfirmDone")));
  $("pf-discard").addEventListener("click", () => act(call("credit.discardProfileDraft"), t("msgDiscardDone")));
  $("pf-update-pr").addEventListener("click", () => {
    const prId = $("pf-pr-id").value.trim();
    if (!prId) {
      $("pf-msg").textContent = t("promptPrId");
      $("pf-pr-id").focus();
      return;
    }
    act(call("credit.updateProfileFromPr", { prId }), t("msgUpdateDone"));
  });
  $("pf-refresh").addEventListener("click", () => refresh());
  return {
    refresh,
    start() {
      refresh();
    },
    stop() {
    },
    applyI18n() {
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
      });
      $("pf-home-url").placeholder = "https://github.com/<user>";
      refresh();
    }
  };
}

// source/ui/main.js
var transport = createTransport({ fetchBase: "" });
var host = typeof window !== "undefined" ? window.app : void 0;
var hosted = transport.kind === "app";
async function copyText(text) {
  if (hosted && typeof host?.clipboard?.writeText === "function") {
    return host.clipboard.writeText(text);
  }
  return navigator.clipboard.writeText(text);
}
var VIEWS = { control: null, history: null, profile: null };
var active = "control";
function switchTab(name) {
  active = name;
  for (const el of document.querySelectorAll(".tab")) {
    el.setAttribute("aria-selected", String(el.dataset.tab === name));
  }
  for (const [key, view] of Object.entries(VIEWS)) {
    const el = document.getElementById(`view-${key}`);
    if (!el) continue;
    const isActive = key === name;
    el.hidden = !isActive;
    if (isActive) view?.start?.();
    else view?.stop?.();
  }
}
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  for (const v of Object.values(VIEWS)) v?.applyI18n?.();
}
function setAppearance(mode) {
  if (mode !== "light" && mode !== "dark") return;
  document.documentElement.setAttribute("data-bf-appearance-mode", mode);
  const btn = document.getElementById("btn-theme");
  if (btn) btn.textContent = mode === "light" ? "Light" : "Dark";
}
function initManualToggles() {
  const actions = document.getElementById("header-actions");
  if (hosted) {
    if (actions) actions.hidden = true;
    return;
  }
  const themeBtn = document.getElementById("btn-theme");
  const localeBtn = document.getElementById("btn-locale");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-bf-appearance-mode");
      setAppearance(cur === "light" ? "dark" : "light");
      applyI18n();
    });
  }
  if (localeBtn) {
    localeBtn.addEventListener("click", () => {
      const next = getLocale() === "zh-CN" ? "en-US" : "zh-CN";
      setLocale(next);
      localeBtn.textContent = next === "zh-CN" ? "EN" : "\u4E2D";
      applyI18n();
    });
  }
  setAppearance("dark");
}
function initLlmRelay() {
  if (!hosted || typeof host?.ai?.complete !== "function") return;
  transport.on("worker:credit:llm", async (payload) => {
    const { id, system, user, model } = payload ?? {};
    if (!id) return;
    try {
      const res = await host.ai.complete(user ?? "", { systemPrompt: system, model });
      const text = typeof res === "string" ? res : res?.text ?? "";
      await transport.call("credit.__llmResult", { id, text });
    } catch (e) {
      await transport.call("credit.__llmResult", { id, error: e?.message ?? String(e) }).catch(() => {
      });
    }
  });
}
function initHostEvents() {
  if (typeof host?.locale === "string") setLocale(host.locale);
  setAppearance(host?.appearanceMode ?? "dark");
  host?.onLocaleChange?.((loc) => {
    setLocale(loc);
    applyI18n();
  });
  host?.onAppearanceChange?.((payload) => {
    setAppearance(payload?.mode);
    applyI18n();
  });
}
function init() {
  initHostEvents();
  initLlmRelay();
  initManualToggles();
  VIEWS.control = createControlView(document.getElementById("view-control"), transport, {
    copyText
  });
  VIEWS.history = createHistoryView(document.getElementById("view-history"), transport);
  VIEWS.profile = createProfileView(document.getElementById("view-profile"), transport);
  document.querySelectorAll(".tab").forEach((el) => {
    el.addEventListener("click", () => switchTab(el.dataset.tab));
  });
  applyI18n();
  switchTab("control");
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
