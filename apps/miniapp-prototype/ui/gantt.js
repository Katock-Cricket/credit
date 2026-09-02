/**
 * 泳道甘特图渲染（P2-pre T8）。
 *
 * **泳道结构天然适配"乱序归类"**：7 条 Stage 泳道，Task **按 spans 归位** ——
 * 一个跨阶段 Task 会同时出现在多条泳道的对应时间区间上（混合 Task 唯一诚实的画法）。
 *
 * **时间轴缩放 / 平移**：`Ctrl/Cmd + 滚轮` 以鼠标位置为锚点缩放，拖拽平移，
 * 双击或按钮重置。缩放只改变可见时间窗（viewport），不改数据。
 *
 * **关键实现约束（踩过的坑）**：
 * 缩放/平移**绝不能重建 DOM**。初版每次都 `innerHTML = ""` 重渲染，导致正在拖拽的
 * 元素被销毁、pointer capture 失效 —— 表现为"拖一下只能移 1px"。
 * 现改为：初次渲染建 DOM，之后只调 `applyViewport()` 更新已有元素的位置。
 * 事件监听器绑在**不销毁的外层 host** 上且只绑一次。
 *
 * **视觉约束（MiniApp Skill）**：
 * - 禁 emoji / Unicode 符号图标 → 标记一律用纯 CSS 几何形状；
 * - 禁"左侧色条 + 圆角卡片" → Task 块靠填充色深浅表 AI 占比；
 * - 命中区 ≥ 32px → Task 块 28px + 泳道留白，实际可点区 32px；控制条按钮 ≥ 32px。
 */
import { tStage, t } from "./i18n.js";

const STAGE_ORDER = [
  "spec-engineering",
  "test-planning",
  "ai-code-generation",
  "ai-testing",
  "ai-fix",
  "manual-verification",
  "ai-review",
];

/** 缩放：最小可见跨度（1 秒），避免无限放大 */
const MIN_SPAN_MS = 1000;
/** 缩放步进 */
const ZOOM_STEP = 1.15;
/** 拖拽判定阈值（px）：超过才算平移，否则仍视为点击 */
const DRAG_THRESHOLD = 4;
/** 时间轴刻度数量 */
const TICK_COUNT = 4;

// ── 状态 ──
let vp = null; // { start, end } —— null 表示全览
let vpForPr = null; // 当前 viewport 归属的 prId（换 PR 时重置）
let bounds = null; // { min, max, vs, ve } —— 当前数据边界与可见范围
let lastArgs = null; // 供缩放/平移后更新
let lastDragMoved = false;
let drag = null;
let rafPending = false;
/** 已绑定交互的 host（避免每次渲染重复绑定） */
const boundHosts = new WeakSet();

/** 阶段 → CSS 颜色变量 */
function stageColor(stage) {
  return `var(--st-${stage}, var(--st-unknown))`;
}

/** 时长格式化 */
export function fmtDur(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function fmtClock(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 构造 Task 块上的事件标记（● prompt / ▲ 测试通过 / ● 失败 / ■ 编辑 / ○ Review） */
function buildMarks(task) {
  const marks = [];
  const c = task.counts ?? {};
  if (c["prompt.submit"]) marks.push({ cls: "prompt", title: `prompt ×${c["prompt.submit"]}` });
  if (task.metrics?.testFailed)
    marks.push({ cls: "test-fail", title: `测试失败 ${task.metrics.testFailed}` });
  else if (task.metrics?.testRunCount)
    marks.push({ cls: "test-pass", title: `测试运行 ${task.metrics.testRunCount}` });
  if (c["edit"]) marks.push({ cls: "edit", title: `编辑 ×${c["edit"]}` });
  if (task.stage === "ai-review") marks.push({ cls: "review", title: "AI Review" });
  return marks;
}

/** 取时间轴（track）区域的矩形，用于把鼠标 x 换算成时间比例 */
function trackRect(host) {
  const t = host.querySelector(".lane-track");
  return t ? t.getBoundingClientRect() : host.getBoundingClientRect();
}

function clampVp(start, end, min, max) {
  const total = Math.max(1, max - min);
  const span = Math.min(Math.max(end - start, MIN_SPAN_MS), total);
  const s = Math.max(min, Math.min(start, max - span));
  return { start: s, end: s + span };
}

/** rAF 节流：滚轮/拖拽高频触发时合并为一帧 */
function scheduleApply() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    applyViewport(lastArgs?.host ?? null);
  });
}

/** 设置可见时间窗并更新视图（**不重建 DOM**） */
function setRange(vs, ve) {
  if (!bounds) return;
  const c = clampVp(vs, ve, bounds.min, bounds.max);
  bounds.vs = c.start;
  bounds.ve = c.end;
  vp = { start: c.start, end: c.end };
  scheduleApply();
}

/**
 * 只更新已有元素的几何位置与文案 —— 缩放/平移走这里。
 * 重建 DOM 会销毁正在拖拽的元素、丢失 pointer capture，是初版 bug 的根因。
 */
function applyViewport(host) {
  if (!host || !bounds) return;
  const { vs, ve, min, max } = bounds;
  const span = Math.max(1, ve - vs);
  const pct = (ts) => ((ts - vs) / span) * 100;

  for (const el of host.querySelectorAll(".task-block")) {
    const s0 = Number(el.dataset.s0);
    const s1 = Number(el.dataset.s1);
    const visible = !(s1 < vs || s0 > ve);
    el.hidden = !visible;
    if (!visible) continue;
    el.style.left = `${pct(s0)}%`;
    el.style.width = `max(0.6%, ${Math.max(0.5, ((s1 - s0) / span) * 100)}%)`;
  }

  for (const el of host.querySelectorAll(".axis-tick")) {
    const i = Number(el.dataset.i);
    el.textContent = fmtClock(vs + (span * i) / TICK_COUNT);
  }
  const axisStart = host.querySelector(".axis-start");
  if (axisStart) axisStart.textContent = fmtClock(vs);

  const level = host.querySelector(".zoom-level");
  if (level) {
    const ratio = Math.max(1, max - min) / span;
    level.textContent = `${ratio.toFixed(1)}× · ${fmtClock(vs)}–${fmtClock(ve)}`;
  }

  // 边界处禁用按钮
  const zin = host.querySelector(".zoom-btn-in");
  const zout = host.querySelector(".zoom-btn-out");
  const zreset = host.querySelector(".zoom-reset");
  const total = Math.max(1, max - min);
  if (zout) zout.disabled = span >= total;
  if (zin) zin.disabled = span <= MIN_SPAN_MS * 1.01;
  if (zreset) zreset.disabled = vp === null;

  // 空泳道不应因"当前窗内无块"而误置灰：交由 CSS 处理，此处不改动
}

/** 绑定交互（只对未绑定过的 host 执行一次） */
function bindInteractions(host) {
  // ── Ctrl/Cmd + 滚轮缩放（不按修饰键则交回页面滚动）──
  host.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (!bounds) return;
      const rect = trackRect(host);
      if (rect.width <= 0) return;
      e.preventDefault();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const { vs, ve } = bounds;
      const span = ve - vs;
      const focus = vs + ratio * span;
      const ns = span * (e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
      setRange(focus - ratio * ns, focus - ratio * ns + ns);
    },
    { passive: false },
  );

  // ── 拖拽平移 ──
  // **关键**：不能在 pointerdown 就 setPointerCapture。
  // 一旦捕获，后续 click 会被派发到捕获元素（host）而不是按钮，
  // 导致点击 Task 块无法展开详情。改为「确认是拖拽之后」再捕获。
  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !bounds) return;
    lastDragMoved = false;
    drag = {
      x: e.clientX,
      vs: bounds.vs,
      ve: bounds.ve,
      id: e.pointerId,
      captured: false,
    };
  });

  host.addEventListener("pointermove", (e) => {
    if (!drag || !bounds) return;
    const dx = e.clientX - drag.x;
    // 超过阈值才认定为拖拽：此时才捕获指针，保证拖出容器也能继续
    if (!drag.captured && Math.abs(dx) > DRAG_THRESHOLD) {
      lastDragMoved = true;
      drag.captured = true;
      try {
        host.setPointerCapture(drag.id);
      } catch {
        /* 捕获失败不影响平移（鼠标仍在容器内时） */
      }
      host.querySelector(".gantt")?.classList.add("grabbing");
    }
    if (!lastDragMoved) return;
    const rect = trackRect(host);
    if (rect.width <= 0) return;
    const dt = (dx / rect.width) * (drag.ve - drag.vs);
    setRange(drag.vs - dt, drag.ve - dt);
  });

  const endDrag = (e) => {
    if (!drag) return;
    if (drag.captured) {
      try {
        host.releasePointerCapture(e.pointerId);
      } catch {
        /* 已释放，忽略 */
      }
    }
    drag = null;
    host.querySelector(".gantt")?.classList.remove("grabbing");
  };
  host.addEventListener("pointerup", endDrag);
  host.addEventListener("pointercancel", endDrag);

  // ── 双击重置 ──
  host.addEventListener("dblclick", () => {
    if (!bounds) return;
    vp = null;
    bounds.vs = bounds.min;
    bounds.ve = bounds.max;
    scheduleApply();
  });
}

/**
 * 渲染甘特图。
 * @param {HTMLElement} host 外层容器（事件绑定在此，渲染中不会销毁）
 * @param {object} graph TaskGraph
 * @param {{ onSelect?: (task) => void, selectedId?: string }} opts
 */
export function renderGantt(host, graph, opts = {}) {
  host.innerHTML = "";
  lastArgs = { host, graph, opts };

  if (!graph || !graph.tasks?.length) {
    bounds = null;
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "（无 Task 数据）";
    host.appendChild(empty);
    return;
  }

  // 换 PR → 重置 viewport
  if (vpForPr !== graph.prId) {
    vp = null;
    vpForPr = graph.prId;
  }

  const tasks = graph.tasks;
  const min = Math.min(...tasks.map((t) => t.startTs));
  const max = Math.max(...tasks.map((t) => t.endTs));
  const vs = vp?.start ?? min;
  const ve = vp?.end ?? max;
  bounds = { min, max, vs, ve };
  const span = Math.max(1, ve - vs);
  const pct = (ts) => ((ts - vs) / span) * 100;

  // ── 缩放控制条 ──
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
    mkZoomBtn("−", t("btnZoomOut"), "zoom-btn-out", ZOOM_STEP),
    mkZoomBtn("+", t("btnZoomIn"), "zoom-btn-in", 1 / ZOOM_STEP),
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
  host.appendChild(bar);

  const wrap = document.createElement("div");
  wrap.className = "gantt";

  // ── 时间轴刻度 ──
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
    tick.style.left = `${(i / TICK_COUNT) * 100}%`;
    scale.appendChild(tick);
  }
  axis.append(axisLabel, scale);
  wrap.appendChild(axis);

  // ── 泳道（按 span 归位）──
  const byStage = new Map(STAGE_ORDER.map((s) => [s, []]));
  for (const t of tasks) {
    const spans = t.spans?.length
      ? t.spans
      : [{ stage: t.stage, weight: 1, startTs: t.startTs, endTs: t.endTs }];
    for (const sp of spans) {
      const key = byStage.has(sp.stage) ? sp.stage : "ai-code-generation";
      byStage.get(key).push({ task: t, span: sp });
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
      const t = item.task;
      const sp = item.span;
      const s0 = sp.startTs || t.startTs;
      const s1 = sp.endTs || t.endTs;

      const block = document.createElement("button");
      block.type = "button";
      block.className = "task-block";
      // 时间存在 dataset 上：平移/缩放时据此重算位置，无需重建 DOM
      block.dataset.s0 = String(s0);
      block.dataset.s1 = String(s1);
      block.style.setProperty("--tint", stageColor(stage));
      block.style.setProperty("--tint-alpha", String(0.25 + t.metrics.aiRatio * 0.6));
      block.title = `${tStage(sp.stage)} · ${fmtDur(s1 - s0)} · AI ${Math.round(
        t.metrics.aiRatio * 100,
      )}%${(t.spans?.length ?? 0) > 1 ? " · 跨阶段子段" : ""}`;

      const fill = document.createElement("span");
      fill.className = "fill";
      const labelEl = document.createElement("span");
      labelEl.className = "label";
      labelEl.textContent = t.desc ?? "";
      block.append(fill, labelEl);

      const marks = buildMarks(t);
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

      if (opts.selectedId === t.id) block.setAttribute("aria-selected", "true");
      block.addEventListener("click", () => {
        if (lastDragMoved) return; // 拖拽结束时不要误触发选中
        opts.onSelect?.(t);
      });
      track.appendChild(block);
    }

    lane.append(label, track);
    wrap.appendChild(lane);
  }

  host.appendChild(wrap);

  // 交互只绑定一次（host 元素在渲染中不会被替换）
  if (!boundHosts.has(host)) {
    bindInteractions(host);
    boundHosts.add(host);
  }

  // 统一由 applyViewport 写入位置与文案（含可见性裁剪）
  applyViewport(host);
}

/** 供外部（切换 PR / 重算）重置缩放 */
export function resetZoom() {
  vp = null;
  vpForPr = null;
  bounds = null;
  drag = null;
  lastDragMoved = false;
}
