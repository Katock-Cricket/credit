/**
 * Control Tab —— P1 三按钮原型（决策 D-005）原样保留，仅从 index.html 内联脚本
 * 迁到独立模块（MiniApp Skill：不要把大量逻辑塞进 HTML；ui.js 过长即拆模块）。
 */
import { t } from "./i18n.js";

const RECOVER_LABEL = {
  resume: () => t("recoverResume"),
  rewind: () => t("recoverRewind"),
  degraded: () => t("recoverDegraded"),
  none: () => t("recoverNone"),
};

async function call(action) {
  const res = await fetch(`/api/credit/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "request failed");
  return data;
}

export function createControlView(root) {
  const $ = (id) => root.querySelector(`#${id}`);

  function render(data) {
    const s = data.session;
    const stateEl = $("state");
    stateEl.textContent = s ? s.state : "idle";
    stateEl.className = `state ${s ? s.state : "idle"}`;
    $("prid").textContent = s?.prId || "-";
    $("seq").textContent = s?.seq ?? 0;
    $("counts").textContent = s ? JSON.stringify(s.counts || {}) : "-";
    const st = data.stats || {};
    $("stats").textContent = `输出 ${st.emitted ?? 0} · 基线 ${st.baseline ?? 0} · 折叠 ${st.merged ?? 0}`;
    $("dirs").textContent = data.dirs?.rootDir || "-";

    const banner = $("banner");
    const r = data.recover;
    if (r && (r.action === "resume" || r.action === "rewind" || r.action === "degraded")) {
      banner.className = "banner warn";
      banner.textContent = `${RECOVER_LABEL[r.action]?.() ?? r.action}${r.prId ? `（prId=${r.prId}）` : ""}`;
    } else {
      banner.className = "banner";
      banner.textContent = "";
    }

    const has = !!s && s.state === "recording";
    $("btn-finish").disabled = !has;
    $("btn-reset").disabled = !s || s.state === "idle";
    $("btn-start").disabled = has;
  }

  async function refresh() {
    const res = await fetch("/api/credit/status");
    render(await res.json());
  }

  async function act(action, okMsg, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    $("msg").textContent = "处理中…";
    try {
      const data = await call(action);
      $("msg").textContent = okMsg + (data.session?.prId ? `（${data.session.prId}）` : "");
      await refresh();
    } catch (e) {
      $("msg").textContent = `失败：${e.message}`;
      await refresh();
    }
  }

  $("btn-start").addEventListener("click", () => act("start", t("msgStarted")));
  $("btn-finish").addEventListener("click", () => act("finish", t("msgFinished")));
  $("btn-reset").addEventListener("click", () =>
    act("reset", t("msgReset"), t("confirmReset")),
  );
  $("btn-recover").addEventListener("click", () => act("recover", t("msgRecovered")));
  $("btn-refresh").addEventListener("click", () => refresh());

  return {
    refresh,
    start() {
      refresh();
    },
    stop() {
      /* 无定时器 */
    },
    /** 静态文案随语言重渲染 */
    applyI18n() {
      $("btn-start").textContent = t("btnStart");
      $("btn-finish").textContent = t("btnFinish");
      $("btn-reset").textContent = t("btnReset");
      $("btn-recover").textContent = t("btnRecover");
      $("btn-refresh").textContent = t("btnRefresh");
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
      });
    },
  };
}
