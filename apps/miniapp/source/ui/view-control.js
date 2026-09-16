/**
 * Control Tab —— 会话控制 + 结果 + 证据 + 提交（P4 · 决策 D-047）。
 *
 * 四视图（`home → result → evidence → commit`）由 `control-flow.js` 的状态机判定，
 * 本模块只负责渲染与事件；**一切取数经 transport**（D-044）。
 *
 * 规范遵从：纯 CSS 几何（无 emoji）、hit ≥ 32px、文案全走 i18n、色彩只用设计 token。
 */
import { t, getLocale } from "./i18n.js";
import { renderCreditTree, renderCreditSummary } from "./credit-tree.js";
import { resolveControlView, homeActions, isSessionBusy } from "./control-flow.js";
import { askConfirm } from "./confirm.js";

/** 提交 WARNING 兜底阈值（与 config.commitWarningThreshold 对齐；取不到配置时用） */
const FALLBACK_WARN_THRESHOLD = 40;

export function createControlView(root, transport, opts = {}) {
  const $ = (id) => root.querySelector(`#${id}`);
  const call = (method, params) => transport.call(method, params ?? {});

  const VIEW_HOSTS = {
    home: $("ctl-view-home"),
    result: $("ctl-view-result"),
    evidence: $("ctl-view-evidence"),
    commit: $("ctl-view-commit"),
  };

  let sessionState = "idle";
  let prId = null;
  let credit = null; // 本轮 pr_credit 结果
  let profile = null;
  let progressOff = null;
  let changedFiles = [];
  let warnThreshold = FALLBACK_WARN_THRESHOLD;

  // ───────────────────────── 视图切换 ─────────────────────────

  function show(view) {
    const next = resolveControlView({
      sessionState,
      hasResult: !!credit,
      current: currentView,
      requested: view,
    });
    currentView = next;
    for (const [key, host] of Object.entries(VIEW_HOSTS)) {
      if (host) host.hidden = key !== next;
    }
  }
  let currentView = "home";

  // ───────────────────────── home ─────────────────────────

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
      banner.textContent = `${t(`recover${r.action[0].toUpperCase()}${r.action.slice(1)}`)}${
        r.prId ? `（prId=${r.prId}）` : ""
      }`;
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

  /** 计算进度（Worker → iframe 事件，节流由 Worker 侧保证） */
  function onProgress(p) {
    const panel = $("ctl-progress-panel");
    if (!panel || !p) return;
    panel.hidden = false;
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    $("ctl-progress-bar").style.width = `${pct}%`;
    $("ctl-progress-text").textContent = `${p.done}/${p.total}${p.nodeId ? ` · ${p.nodeId}` : ""}`;
  }

  async function renderDevOverview() {
    const host = $("ctl-devc");
    try {
      const data = await call("credit.getProfile");
      profile = data.profile;
      if (!data.initialized || !profile) {
        host.innerHTML = `<div class="empty">${t("profileEmpty")}</div>`;
        return;
      }
      const kws = [...(profile.techDomain?.keywords ?? [])]
        .sort((a, b) => (b.gitLines ?? 0) - (a.gitLines ?? 0))
        .slice(0, 6);
      const gs = profile.gitStats;
      host.innerHTML =
        `<div class="kw-meta">git ${profile.gitUser ?? "-"} · ${
          gs ? `${gs.mergedPrCount}/${gs.totalPrCount} merged` : t("prStatsNone")
        }</div>` +
        `<div>${kws
          .map(
            (k) =>
              `<span class="draft-kw">${esc(k.name)} <span class="kw-meta">${k.gitLines ?? 0}</span></span>`,
          )
          .join("")}</div>`;
    } catch (e) {
      host.innerHTML = `<div class="empty">${t("errLoadFailed")}${esc(e.message)}</div>`;
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
    // 用界面内确认条，**不要** window.confirm —— 在 MiniApp 里会被 iframe CSP 拦掉（见 confirm.js）
    if (confirmKey && !(await askConfirm(VIEW_HOSTS.home, { message: t(confirmKey) }))) return null;
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

  // ───────────────────────── result ─────────────────────────

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
      if (data.cacheMiss) notes.push(`${t("lblCreditRecomputed")}：${data.cacheMiss}`);
      const hint = $("ctl-tree-hint");
      hint.textContent = notes.join("；");
      hint.hidden = notes.length === 0;
      show("result");
    } catch (e) {
      credit = null;
      $("ctl-tree").innerHTML = `<div class="empty">${t("errLoadFailed")}${esc(e.message)}</div>`;
    }
  }

  // ───────────────────────── evidence ─────────────────────────

  /** 展平整棵结果树，收集有证据的节点 */
  function collectEvidence(node, out = []) {
    if (!node) return out;
    const ev = node.result?.evidence ?? [];
    if (ev.length > 0) out.push(node);
    for (const c of node.children ?? []) collectEvidence(c, out);
    return out;
  }

  function renderEvidenceView() {
    const host = $("ctl-view-evidence");
    if (!credit?.tree) {
      host.innerHTML = `<div class="empty">${t("lblNoCredit")}</div>`;
      return;
    }
    const nodes = collectEvidence(credit.tree);
    if (nodes.length === 0) {
      host.innerHTML = `<div class="empty">${t("lblNoEvidenceYet")}</div>`;
      return;
    }
    host.innerHTML =
      `<div class="row" style="justify-content: space-between; align-items: baseline">
         <h2>${esc(t("lblEvidence"))}</h2>
         <button id="btn-back-result-2" data-i18n="btnBack">${esc(t("btnBack"))}</button>
       </div>` +
      nodes
        .map((n) => {
          const name = n.node?.name?.[getLocale()] ?? n.node?.name?.["zh-CN"] ?? n.node?.id;
          const items = (n.result.evidence ?? [])
            .map((e) => `<li>${esc(evidenceText(e))}</li>`)
            .join("");
          return `<div class="panel"><div class="ct-name">${esc(name)}${
            n.result.score == null ? "" : ` · ${Number(n.result.score).toFixed(1)}`
          }</div><ul class="ev-list">${items}</ul></div>`;
        })
        .join("");
    $("btn-back-result-2")?.addEventListener("click", () => show("result"));
  }

  function evidenceText(e) {
    if (e.kind === "task") return `${t("evTask")}: ${(e.ids ?? []).join(", ")}${e.label ? ` — ${e.label}` : ""}`;
    if (e.kind === "file") return `${t("evFile")}: ${(e.uris ?? []).join(", ")}${e.label ? ` — ${e.label}` : ""}`;
    if (e.kind === "prompt") return `${t("evPrompt")}: ${String(e.text ?? "").slice(0, 200)}`;
    return `${t("evNote")}: ${String(e.label ?? e.text ?? e.rationale ?? "").slice(0, 200)}`;
  }

  // ───────────────────────── commit（M6） ─────────────────────────

  async function loadCommit() {
    if (!prId) return;
    show("commit");
    $("commit-msg-status").textContent = t("msgWorking");
    try {
      const [{ files }, cfg] = await Promise.all([
        call("credit.getChangedFiles"),
        call("credit.getConfig").catch(() => null),
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
    const host = $("commit-files");
    if (changedFiles.length === 0) {
      host.innerHTML = `<div class="empty">${t("lblNoChanges")}</div>`;
      return;
    }
    host.innerHTML = changedFiles
      .map(
        (f, i) => `<label class="commit-file">
          <input type="checkbox" data-idx="${i}" checked />
          <span class="cf-path">${esc(f.path)}</span>
          <span class="cf-status">${esc(f.status ?? "")}</span>
        </label>`,
      )
      .join("");
    host.querySelectorAll("input[type=checkbox]").forEach((el) =>
      el.addEventListener("change", renderCommitMsg),
    );
  }

  function selectedFiles() {
    const host = $("commit-files");
    return [...host.querySelectorAll("input[type=checkbox]")]
      .filter((el) => el.checked)
      .map((el) => changedFiles[Number(el.dataset.idx)]?.path)
      .filter(Boolean);
  }

  /** CREDIT 声明行（架构 §3.6-3）：score / grade / summary / pr */
  function creditLine() {
    const s = credit?.summary;
    if (!s) return "";
    const band = s.bandLabel?.[getLocale()] ?? s.band ?? "";
    return `CREDIT: score=${Number(s.prCredit).toFixed(1)} grade=${band} summary=${
      s.overallComment ?? ""
    } pr=${prId ?? ""}`;
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
    warn.textContent = t("warnLowScore")
      .replace("{score}", score.toFixed(1))
      .replace("{threshold}", String(warnThreshold));
  }

  // ───────────────────────── 事件绑定 ─────────────────────────

  $("btn-start").addEventListener("click", () => act("credit.start", {}, "msgStarted"));
  $("btn-finish").addEventListener("click", async () => {
    const data = await act("credit.finish", {}, "msgFinished");
    if (data) await loadResult(false);
  });
  $("btn-reset").addEventListener("click", () =>
    act("credit.reset", {}, "msgReset", "confirmReset"),
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
    $("commit-files").querySelectorAll("input[type=checkbox]").forEach((el) => (el.checked = true));
    renderCommitMsg();
  });
  $("commit-select-none").addEventListener("click", () => {
    $("commit-files").querySelectorAll("input[type=checkbox]").forEach((el) => (el.checked = false));
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
      // D-048：只 commit，绝不顺带 push
      const r = await call("credit.commitAndPush", {
        files,
        message: $("commit-msg").value,
        push: false,
      });
      $("commit-msg-status").textContent = `${t("msgCommitDone")}${r.commitHash ?? ""}`;
      await refresh();
    } catch (e) {
      $("commit-msg-status").textContent = `${t("msgFail")}${e.message}`;
    }
  });

  $("btn-push").addEventListener("click", async () => {
    if (!(await askConfirm(VIEW_HOSTS.commit, { message: t("confirmPush") }))) return;
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

  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  }

  // ───────────────────────── 生命周期 ─────────────────────────

  return {
    refresh,
    start() {
      if (!progressOff) progressOff = transport.onProgress(onProgress);
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
    show,
  };
}
