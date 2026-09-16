/**
 * 分析图层渲染（P2-pre T7/T8）。
 *
 * **插件驱动**：只按 `renderAs` 分派渲染，不硬编码任何具体分析 —— 新增一种分析
 * 只需在 analyzer 侧加一个 `AnalyticLayer`，此处无需改动（决策 D-017：可视化层
 * 预留扩展位）。
 */
import { tPattern } from "./i18n.js";

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

/** AI 参与度光谱：每 Task 一根柱，高度 = aiRatio */
function renderSpectrum(view) {
  const d = view.data;
  const el = card("AI 参与度光谱", view.summary);
  if (!d?.points?.length) return el;

  const box = document.createElement("div");
  box.className = "spectrum";
  for (const p of d.points) {
    const bar = document.createElement("div");
    bar.className = `spectrum-bar${p.aiRatio < 0.5 ? " low" : ""}`;
    bar.style.height = `${Math.max(4, Math.round(p.aiRatio * 100))}%`;
    bar.title = `${p.taskId} · AI ${Math.round(p.aiRatio * 100)}% · ${p.desc ?? ""}`;
    box.appendChild(bar);
  }
  el.appendChild(box);
  return el;
}

/** 协作模式画像：徽章 + 关键信号 */
function renderPattern(view) {
  const d = view.data;
  const el = card("协作模式画像", view.summary);
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
    ["行为总数", s.total],
    ["AI 占比", s.aiRatio != null ? `${Math.round(s.aiRatio * 100)}%` : "-"],
    ["Dev 编辑行占比", s.devEditRatio != null ? `${Math.round(s.devEditRatio * 100)}%` : "-"],
    ["阅读行为占比", s.readRatio != null ? `${Math.round(s.readRatio * 100)}%` : "-"],
    ["每 Task prompt 数", s.promptPerTask],
    ["AI 工具调用", s.toolCalls],
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

/** 兜底：未识别的分析图层 → 展示 summary + 折叠的原始数据 */
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

/**
 * 渲染全部分析图层。
 * @param {HTMLElement} host
 * @param {Array} analytics registry.runAll() 的结果
 * @param {Record<string, {name:{}}>} layerNames id → 图层名（i18n）
 */
export function renderAnalytics(host, analytics, layerNames = {}) {
  host.innerHTML = "";
  if (!analytics?.length) return;

  for (const v of analytics) {
    let el;
    if (v.data == null) {
      // 插件不可用（异常隔离结果）
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
    host.appendChild(el);
  }
}
