/**
 * History PRs Tab —— 过程可视化主视图（P2-pre T8，决策 D-012）。
 *
 * 布局：左侧历史 PR 列表 / 右侧泳道甘特图 + 分析图层 + 切分自检 + Task 详情。
 * 数据全部来自 `/api/pr/*`（离线消费已落盘的 PR 数据，不依赖 Bitfun 桌面）。
 */
import { t, tStage, tTaskType } from "./i18n.js";
import { renderGantt, fmtDur, resetZoom } from "./gantt.js";
import { renderAnalytics } from "./analytic-layer.js";

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
      renderDiagnostics();
      renderGantt(host, graph, { onSelect: selectTask });
      $("recompute").hidden = false;
    } catch (e) {
      host.innerHTML = `<div class="empty">${t("errLoadFailed")}${e.message}</div>`;
      $("analytics").innerHTML = "";
      $("diagnostics").innerHTML = "";
    }
  }

  // ── 切分自检 ──
  function renderDiagnostics() {
    const host = $("diagnostics");
    host.innerHTML = "";
    if (!graph) return;
    const d = graph.diagnostics ?? {};
    const tasks = graph.tasks ?? [];
    const devB = tasks.reduce((s, x) => s + x.metrics.devBehaviors, 0);
    const aiB = tasks.reduce((s, x) => s + x.metrics.aiBehaviors, 0);
    const total = devB + aiB || 1;

    const dl = document.createElement("dl");
    dl.className = "detail-grid";
    const rows = [
      [t("lblTasks"), tasks.length],
      [t("lblBehaviors"), tasks.reduce((s, x) => s + x.metrics.behaviorCount, 0)],
      [t("lblAvgTask"), fmtDur(d.avgTaskDurationMs ?? 0)],
      [t("lblMixed"), d.mixedStageTaskCount ?? 0],
      [t("lblReview"), graph.reviewSessions?.length ?? 0],
      [t("lblLlmCalls"), d.llmCalls ?? 0],
      [t("lblFallback"), d.llmFallbackCount ?? 0],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = String(v);
      dl.append(dt, dd);
    }
    host.appendChild(dl);

    // Dev / AI 占比条
    const barWrap = document.createElement("div");
    barWrap.className = "gantt-toolbar";
    barWrap.style.marginTop = "8px";
    const lb = document.createElement("span");
    lb.textContent = `${t("lblDev")} ${Math.round((devB / total) * 100)}%`;
    const rb = document.createElement("span");
    rb.textContent = `${t("lblAi")} ${Math.round((aiB / total) * 100)}%`;
    const bar = document.createElement("div");
    bar.className = "dev-ai-bar";
    const devEl = document.createElement("div");
    devEl.className = "dev";
    devEl.style.width = `${(devB / total) * 100}%`;
    const aiEl = document.createElement("div");
    aiEl.className = "ai";
    aiEl.style.width = `${(aiB / total) * 100}%`;
    bar.append(devEl, aiEl);
    barWrap.append(lb, bar, rb);
    host.appendChild(barWrap);

    // 提示：LLM 未启用
    if ((d.llmCalls ?? 0) === 0) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = t("hintLlmOff");
      host.appendChild(hint);
    }

    const cut = document.createElement("div");
    cut.className = "hint";
    cut.textContent = `切分信号：${Object.entries(d.cutSignals ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join(" · ")}`;
    host.appendChild(cut);
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

  function renderDetail(task) {
    const host = $("detail");
    host.innerHTML = "";
    host.hidden = false;

    const head = document.createElement("div");
    head.className = "detail-head";
    const h3 = document.createElement("h3");
    h3.textContent = `${task.id} · ${tStage(task.stage)}`;
    const badge = document.createElement("span");
    badge.className = "pattern-badge";
    badge.textContent = tTaskType(task.fp?.taskType);
    head.append(h3, badge);
    host.appendChild(head);

    const dl = document.createElement("dl");
    dl.className = "detail-grid";
    const rows = [
      [t("lblDuration"), fmtDur(task.durationMs)],
      ["AI 占比", `${Math.round((task.metrics?.aiRatio ?? 0) * 100)}%`],
      [t("lblBehaviors"), task.metrics?.behaviorCount ?? 0],
      ["Dev / AI", `${task.metrics?.devBehaviors ?? 0} / ${task.metrics?.aiBehaviors ?? 0}`],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = String(v);
      dl.append(dt, dd);
    }
    host.appendChild(dl);

    const descTitle = document.createElement("dt");
    descTitle.textContent = t("lblDesc");
    const descVal = document.createElement("dd");
    descVal.textContent = task.desc ?? `${task.behaviorSummary} ${t("hintDescFallback")}`;
    const dl2 = document.createElement("dl");
    dl2.className = "detail-grid";
    dl2.append(descTitle, descVal);
    host.appendChild(dl2);

    if (task.spans?.length > 1) {
      const sp = document.createElement("div");
      sp.className = "hint";
      sp.textContent = `${t("lblSpans")}：${task.spans
        .map((s) => `${tStage(s.stage)} ${Math.round(s.weight * 100)}%`)
        .join(" · ")}`;
      host.appendChild(sp);
    }

    if (task.files?.length > 0) {
      const fTitle = document.createElement("div");
      fTitle.className = "hint";
      fTitle.textContent = `${t("lblFiles")}（${task.files.length}）：${task.files
        .slice(0, 6)
        .map((f) => String(f.uri).split(/[\\/]/).pop())
        .join(", ")}${task.files.length > 6 ? " …" : ""}`;
      host.appendChild(fTitle);
    }

    const bTitle = document.createElement("div");
    bTitle.className = "hint";
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
      const txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent =
        b.context?.promptText ??
        b.context?.cmd ??
        b.object?.uri ??
        b.context?.toolName ??
        b.context?.after ??
        "";
      txt.title = txt.textContent;
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
        renderDiagnostics();
        if (selectedTask) renderDetail(selectedTask);
      }
    },
  };
}
