/**
 * CREDIT MiniApp 入口（P4）。
 *
 * 结构约定（MiniApp Skill）：`index.html` 只放结构，`style.css` 声明设计系统，
 * `ui.js` 负责状态/路由/事件/i18n，视图逻辑拆到 `ui/` 模块。
 *
 * 顶层三 Tab（D-047）：Control（内含 home/result/evidence/commit 四视图）/
 * History PRs / Developer Profile。**一切取数经 `ui/transport.js`**（D-044）。
 */
import { t, getLocale, setLocale } from "./i18n.js";
import { createTransport } from "./transport.js";
import { createControlView } from "./view-control.js";
import { createHistoryView } from "./view-history.js";
import { createProfileView } from "./view-profile.js";

const transport = createTransport({ fetchBase: "" });
const host = typeof window !== "undefined" ? window.app : undefined;
const hosted = transport.kind === "app";

/** 复制到剪贴板：宿主代理优先（绕过 iframe sandbox 限制） */
async function copyText(text) {
  if (hosted && typeof host?.clipboard?.writeText === "function") {
    return host.clipboard.writeText(text);
  }
  return navigator.clipboard.writeText(text);
}

const VIEWS = { control: null, history: null, profile: null };
let active = "control";

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

/** 主题：宿主驱动（`--bitfun-*` 由宿主注入，此处只切换标记供 CSS 取色） */
function setAppearance(mode) {
  if (mode !== "light" && mode !== "dark") return;
  document.documentElement.setAttribute("data-bf-appearance-mode", mode);
  const btn = document.getElementById("btn-theme");
  if (btn) btn.textContent = mode === "light" ? "Light" : "Dark";
}

/** 原型宿主下的手动切换（MiniApp 实机下由宿主按钮承担，故隐藏） */
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
      // 必须重渲染：甘特图色块的渐变字符串在建 DOM 时算好缓存，切主题不重渲染则不更新
      applyI18n();
    });
  }
  if (localeBtn) {
    localeBtn.addEventListener("click", () => {
      const next = getLocale() === "zh-CN" ? "en-US" : "zh-CN";
      setLocale(next);
      localeBtn.textContent = next === "zh-CN" ? "EN" : "中";
      applyI18n();
    });
  }
  setAppearance("dark");
}

/**
 * LLM 中继（D-051）：Worker 进程拿不到 `app.ai.*`，故由本处（iframe，持有宿主 API）
 * 代其发起调用并回填。
 *
 * 往返：Worker `rpcEmit('credit:llm', {id, system, user, model})`
 *      → 本处 `app.ai.complete(user, { systemPrompt: system, model })`
 *      → `app.call('credit.__llmResult', {id, text})`（Worker 侧 promise 落地）。
 * Worker 端 `createRelayAi()` 的等待上限为 180s（D-027 教训）。
 */
function initLlmRelay() {
  if (!hosted || typeof host?.ai?.complete !== "function") return;
  transport.on("worker:credit:llm", async (payload) => {
    const { id, system, user, model } = payload ?? {};
    if (!id) return;
    try {
      const res = await host.ai.complete(user ?? "", { systemPrompt: system, model });
      const text = typeof res === "string" ? res : (res?.text ?? "");
      await transport.call("credit.__llmResult", { id, text });
    } catch (e) {
      await transport
        .call("credit.__llmResult", { id, error: e?.message ?? String(e) })
        .catch(() => {});
    }
  });
}

/** 宿主事件：语言/主题由 Bitfun 驱动 */
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
    copyText,
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
