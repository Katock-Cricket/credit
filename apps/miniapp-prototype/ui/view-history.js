/**
 * History PRs Tab —— 过程可视化主视图（P2-pre T8，决策 D-012）。
 *
 * 布局：左侧历史 PR 列表 / 右侧泳道甘特图 + 分析图层 + 切分自检 + Task 详情。
 * 数据全部来自 `/api/pr/*`（离线消费已落盘的 PR 数据，不依赖 Bitfun 桌面）。
 */
import { t, tStage, tTaskType } from "./i18n.js";
import { renderGantt, fmtDur, resetZoom } from "./gantt.js";
import { renderAnalytics } from "./analytic-layer.js";
import { describeBehavior } from "./behavior-summary.js";

const LAYER_NAMES = {
  "ai-involvement": { name: { "zh-CN": "AI 参与度光谱" } },
  "collab-pattern": { name: { "zh-CN": "协作模式画像" } },
};

async function getJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "request failed");
  return data;
}

export function createHistoryView(root) {
  const $ = (id) => root.querySelector(`#${id}`);
  let graph = null;
  let selectedTask = null;
  let currentPrId = null;

  // ── PR 列表 ──
  async function loadList() {
    const list = $("pr-list");
    list.innerHTML = `<div class="empty">${t("lblLoading")}</div>`;
    try {
      const { items } = await getJson("/api/pr/list");
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
        meta.textContent = `${it.behaviorCount} 条 · ${new Date(it.mtimeMs).toLocaleString()}`;
        btn.append(id, meta);
        btn.addEventListener("click", () => selectPr(it.prId));
        list.appendChild(btn);
      }
      // 默认选中第一个
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

  // ── 选中 PR → 加载建模结果 ──
  async function selectPr(prId, { force = false } = {}) {
    currentPrId = prId;
    selectedTask = null;
    resetZoom(); // 换 PR 时回到全览（gantt 内部亦有 prId 保险，此处为显式表达）
    markSelected(prId);
    const host = $("gantt-host");
    host.innerHTML = `<div class="empty">${t("lblLoading")}</div>`;
    $("detail").innerHTML = "";
    $("detail").hidden = true;
    try {
      const data = await getJson(
        `/api/pr/${encodeURIComponent(prId)}/graph${force ? "?force=1" : ""}`,
      );
      graph = data.graph;
      renderAnalytics($("analytics"), data.analytics, LAYER_NAMES);
      renderModelHint();
      renderGantt(host, graph, { onSelect: selectTask });
      $("recompute").hidden = false;
    } catch (e) {
      host.innerHTML = `<div class="empty">${t("errLoadFailed")}${e.message}</div>`;
      $("analytics").innerHTML = "";
    }
  }

  /**
   * 建模状态提示（一行，置于时间线面板内）。
   *
   * 原「切分自检」模块已移除；仅保留对**解读结果有影响**的状态信息：
   * 当前 Desc 是 LLM 生成的还是规则降级的。
   */
  function renderModelHint() {
    const host = $("model-hint");
    if (!host) return;
    const d = graph?.diagnostics ?? {};
    const llmCalls = d.llmCalls ?? 0;
    if (llmCalls === 0) {
      host.textContent = t("hintLlmOff");
      host.hidden = false;
    } else {
      host.textContent = "";
      host.hidden = true;
    }
  }

  // ── 选中 Task → 详情 ──
  async function selectTask(task) {
    selectedTask = task;
    renderGantt($("gantt-host"), graph, { onSelect: selectTask, selectedId: task.id });
    renderDetail(task);
    // 按需拉取行为明细
    try {
      const ids = task.bs.slice(0, 200).join(",");
      const { items } = await getJson(
        `/api/pr/${encodeURIComponent(currentPrId)}/behaviors?ids=${encodeURIComponent(ids)}`,
      );
      renderBehaviorList(items);
    } catch {
      $("behavior-list").innerHTML = `<div class="empty">${t("errLoadFailed")}-</div>`;
    }
  }

  /** 取文件名（工件名） */
  function basename(uri) {
    return String(uri).split(/[\\/]/).pop() || String(uri);
  }

  /** 补充说明行：「标签 + 值」，纵向罗列（不再用 dt/dd 交错网格） */
  function addExtraRow(host, label, value) {
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
    host.appendChild(row);
  }

  /**
   * 详情面板 —— **单一自上而下的阅读顺序**：
   * ① 标题（Task.Desc）→ ② 一行概览 → ③ 补充说明 → ④ 行为明细。
   *
   * 原实现把 时长/AI占比/行为数/Dev-AI/目标 放进 dt/dd 自适应网格，
   * 会随宽度在"横排/竖排"之间跳变，阅读方向不明确（用户反馈）。
   */
  function renderDetail(task) {
    const host = $("detail");
    host.innerHTML = "";
    host.hidden = false;

    // ① 标题：Task.Desc（无描述时回退行为摘要）
    const head = document.createElement("div");
    head.className = "detail-head";
    const h3 = document.createElement("h3");
    h3.textContent = task.desc || task.behaviorSummary || task.id;
    const badge = document.createElement("span");
    badge.className = "pattern-badge";
    badge.textContent = tTaskType(task.fp?.taskType);
    head.append(h3, badge);
    host.appendChild(head);

    // ② 一行概览：阶段 · 时长 · AI 占比 · 行为数 · Dev/AI
    const meta = document.createElement("div");
    meta.className = "detail-meta";
    meta.textContent = [
      tStage(task.stage),
      fmtDur(task.durationMs),
      `${t("lblAiRatio")} ${Math.round((task.metrics?.aiRatio ?? 0) * 100)}%`,
      `${task.metrics?.behaviorCount ?? 0} ${t("lblBehaviors")}`,
      `Dev ${task.metrics?.devBehaviors ?? 0} / AI ${task.metrics?.aiBehaviors ?? 0}`,
    ].join("  ·  ");
    host.appendChild(meta);

    // ③ 补充说明
    const extra = document.createElement("div");
    extra.className = "detail-extra";
    if (task.desc) addExtraRow(extra, t("lblSummary"), task.behaviorSummary);
    if (task.spans?.length > 1) {
      addExtraRow(
        extra,
        t("lblSpans"),
        task.spans.map((s) => `${tStage(s.stage)} ${Math.round(s.weight * 100)}%`).join(" · "),
      );
    }
    if (task.files?.length > 0) {
      const names = task.files.slice(0, 6).map((f) => basename(f.uri)).join(", ");
      addExtraRow(
        extra,
        `${t("lblFiles")}（${task.files.length}）`,
        task.files.length > 6 ? `${names} …` : names,
      );
    }
    if (extra.childElementCount > 0) host.appendChild(extra);

    // ④ 行为明细
    const bTitle = document.createElement("div");
    bTitle.className = "detail-section";
    bTitle.textContent = t("lblBehaviorsInTask");
    host.appendChild(bTitle);
    const listHost = document.createElement("div");
    listHost.id = "behavior-list";
    listHost.className = "behavior-list";
    listHost.innerHTML = `<div class="empty">${t("lblLoading")}</div>`;
    host.appendChild(listHost);
  }

  function renderBehaviorList(items) {
    const host = $("behavior-list");
    if (!host) return;
    host.innerHTML = "";
    if (!items?.length) {
      host.innerHTML = `<div class="empty">-</div>`;
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
      // 按动作类型提取有信息量的内容（edit diff / 命令与输出 / 工具入参与输出 / AI 文本 / 文件行范围）
      const { text, full } = describeBehavior(b, { maxChars: 120 });
      const txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = text || "—";
      txt.title = full || text || "";
      row.append(ts, act, txt);
      host.appendChild(row);
    }
  }

  $("recompute").addEventListener("click", () => {
    if (currentPrId) selectPr(currentPrId, { force: true });
  });

  return {
    refresh: loadList,
    start() {
      if (!graph) loadList();
    },
    stop() {},
    applyI18n() {
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
      });
      if (graph) {
        renderGantt($("gantt-host"), graph, {
          onSelect: selectTask,
          selectedId: selectedTask?.id,
        });
        renderModelHint();
        if (selectedTask) renderDetail(selectedTask);
      }
    },
  };
}
