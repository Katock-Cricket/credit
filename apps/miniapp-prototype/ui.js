/**
 * CREDIT 原型入口（P2-pre T8）。
 *
 * 双 Tab：Control（P1 三按钮控制，功能不变）/ History PRs（过程可视化）。
 *
 * 结构约定（MiniApp Skill）：index.html 只放结构，style.css 声明设计系统，
 * ui.js 负责状态/渲染/事件/i18n，过长即拆到 ui/ 模块。
 */
import { t, getLocale, setLocale } from "./ui/i18n.js";
import { createControlView } from "./ui/view-control.js";
import { createHistoryView } from "./ui/view-history.js";

const VIEWS = {
  control: null,
  history: null,
};

let active = "control";

function switchTab(name) {
  active = name;
  for (const el of document.querySelectorAll(".tab")) {
    el.setAttribute("aria-selected", String(el.dataset.tab === name));
  }
  for (const [key, view] of Object.entries(VIEWS)) {
    const el = document.getElementById(`view-${key}`);
    if (!el || !view) continue;
    el.hidden = key !== name;
  }
  VIEWS[name]?.start();
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  for (const v of Object.values(VIEWS)) v?.applyI18n?.();
}

function initLocaleToggle() {
  const btn = document.getElementById("btn-locale");
  if (!btn) return;
  btn.addEventListener("click", () => {
    setLocale(getLocale() === "zh-CN" ? "en-US" : "zh-CN");
    btn.textContent = getLocale() === "zh-CN" ? "EN" : "中";
    applyI18n();
  });
}

function initThemeToggle() {
  // 独立于宿主运行时，手动切换 data-bf-appearance-mode 以验证 light/dark 双主题
  const btn = document.getElementById("btn-theme");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-bf-appearance-mode");
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-bf-appearance-mode", next);
    btn.textContent = next === "light" ? "Light" : "Dark";
  });
  document.documentElement.setAttribute("data-bf-appearance-mode", "dark");
  btn.textContent = "Dark";
}

function init() {
  VIEWS.control = createControlView(document.getElementById("view-control"));
  VIEWS.history = createHistoryView(document.getElementById("view-history"));

  document.querySelectorAll(".tab").forEach((el) => {
    el.addEventListener("click", () => switchTab(el.dataset.tab));
  });

  initLocaleToggle();
  initThemeToggle();
  applyI18n();
  switchTab("control");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
