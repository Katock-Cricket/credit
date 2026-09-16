/**
 * P2 · PR_Credit 指标树渲染。
 *
 * 设计规范（承 D-022）：
 * - 颜色全走 `var(--bitfun-*, fallback)`，状态徽标复用 warning/muted/error，**不新增色相**；
 * - **禁止 emoji / Unicode 符号充当图标**：展开箭头用 CSS 三角，证据按钮用 inline SVG；
 * - 分数右对齐 + 等宽字体，便于纵向对比；
 * - 指标名来自 rules v2 的 `name`（zh-CN / en-US），**状态与证据类型名同样 i18n**。
 */
import { t, getLocale } from "./i18n.js";

const STATUS_KEYS = {
  ok: null, // 不显示徽标
  pending: "stPending",
  excluded: "stExcluded",
  excluded_no_evidence: "stNoEvidence",
  degraded: "stDegraded",
  error: "stError",
};

const EV_KEYS = {
  behavior: "evBehavior",
  task: "evTask",
  file: "evFile",
  prompt: "evPrompt",
  testrun: "evTestRun",
  llm: "evLlm",
  note: "evNote",
};

/**
 * 默认展开到 L3 —— 即"L3 组本身是展开的"，使其 L4 子指标可见。
 * 注意是 `<=`：写成 `<` 会把 L3 折叠起来，导致页面上只看得到 L1/L2 两个空壳层，
 * 所有叶子指标都被藏起来（初版就犯了这个错）。
 */
const DEFAULT_EXPAND_LEVEL = 3;

/**
 * **注意 falsy 陷阱**：`Number("0")` 是 0，而 `0 || 4` 会得 4 ——
 * 初版正是这样把根节点 L0 当成 L4，导致**整棵树被折叠、页面一片空白**。
 * 故此处用正则显式匹配，不用 `||` 兜底。
 */
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
      body.textContent = `${(e.uris ?? []).join(", ")}${e.lines?.length ? ` (${e.lines.length} 行)` : ""}${e.label ? ` — ${e.label}` : ""}`;
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
  score.textContent = result.score == null ? "—" : Number(result.score).toFixed(1);
  row.append(score);

  const info = document.createElement("button");
  info.className = "ct-info";
  info.setAttribute("aria-label", t("lblEvidence"));
  info.append(svgInfo());
  row.append(info);

  wrap.append(row);

  // 详情（计算说明）
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

  // 默认展开策略（<= 才对：L3 展开后 L4 指标才可见）
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

/**
 * 四档边界 —— **必须与 `aggregate.bandOf`（算法 §6.2）保持一致**，改任一侧都要同步另一侧。
 *
 * 段宽按**真实边界**（40 / 20 / 20 / 20），**不是等宽四分**：
 * 早期 demo（`credit-demo/styles.css` 的 `.gauge-segments`）用 `25% 25% 25% 25%`，
 * 刻度落在 25/50/75，与真实档位边界 40/60/80 **不符**，会把分数量表读错。
 */
const BANDS = [
  { band: "blind", max: 40 },
  { band: "selective", max: 60 },
  { band: "verified", max: 80 },
  { band: "mastered", max: 100 },
];

/** 总分卡 */
export function renderCreditSummary(host, result) {
  host.hidden = false;
  host.replaceChildren();

  const s = result.summary;
  const score = Number(s.prCredit);
  const card = document.createElement("div");
  card.className = "ct-summary-card";

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
  card.append(top);

  // 量表：直观标出本次 PR_Credit 落在哪一档的什么位置
  card.append(renderGauge(score, s.band));
  host.append(card);
}

/** 0–100 量表：色段按档位实际宽度，指针标出本次得分位置，当前档位高亮 */
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

  // 刻度 = 真实档位边界（不是 25/50/75）
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

/** 整棵树 */
export function renderCreditTree(host, result, opts = {}) {
  host.replaceChildren();
  if (!result?.tree) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = t("lblNoCredit");
    host.append(empty);
    return;
  }
  host.append(renderNode(result.tree, 0, opts));
}
