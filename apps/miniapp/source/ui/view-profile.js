/**
 * Developer Profile Tab（P3 T6，SPEC P3 §6）。
 *
 * 展示：画像状态 / 双轨关键词（本地行数 + git commits 水平条）/ 本地历史 PR / 草稿确认。
 * 操作：git 初始化（草稿确认流，D-036）/ 增量同步（D-037）/ 本地 PR 增量更新（D-305）/ 编辑。
 *
 * 规范遵从（P2-pre §9.5）：纯 CSS 几何标记（无 emoji / Unicode 图标）、hit ≥ 32px、
 * 文案全部走 i18n、色彩只用设计 token。
 */
import { t } from "./i18n.js";

/** 与 config.profile.proficiency 对齐的展示口径（D-043 单轨行数 + 对数标定） */
const FULL_MARK_LINES = 500_000;

/** 单轨归一分（与服务端 scoreOfLines 同公式，仅用于画进度条） */
function scoreOfLines(lines, scale = "log") {
  const L = Math.max(0, lines || 0);
  return scale === "linear" ? Math.min(100, (L / FULL_MARK_LINES) * 100) : Math.min(100, (Math.log10(1 + L) / Math.log10(1 + FULL_MARK_LINES)) * 100);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

export function createProfileView(root, transport) {
  const $ = (id) => root.querySelector(`#${id}`);
  /** P4：一律经 transport（D-044），不再直接 fetch */
  const call = (method, params) => transport.call(method, params ?? {});
  let lastDraft = null;
  let lastProfile = null;

  function renderStatus(data) {
    const initialized = data.initialized && data.profile;
    const st = $("pf-state");
    st.textContent = initialized ? t("profileReady") : t("profileEmpty");
    st.className = `state ${initialized ? "committed" : "idle"}`;
    $("pf-gituser").textContent = initialized ? data.profile.gitUser || "-" : "-";
    const gs = data.profile?.gitStats;
    $("pf-prstats").textContent = gs
      ? `${gs.mergedPrCount}/${gs.totalPrCount} merged`
      : t("prStatsNone");
    $("pf-updated").textContent = data.profile?.updatedAt?.slice(0, 19).replace("T", " ") || "-";
    lastProfile = data.profile;
    renderKeywords(initialized ? data.profile : null);
    renderTasks(initialized ? data.profile : null);
    renderDraft(data.draft);
    $("pf-init").disabled = !!initialized;
    $("pf-sync").disabled = !initialized;
    $("pf-update-pr").disabled = !initialized;
  }

  /** 本地轨行数由 historyTasks 派生（与服务端 localLinesOf 同口径：任务去重） */
  function localLinesOf(profile, name) {
    const key = String(name).trim().toLowerCase();
    const seen = new Set();
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
    const host = $("pf-keywords");
    if (!profile || profile.techDomain.keywords.length === 0) {
      host.innerHTML = `<div class="empty">${esc(t("noKeywords"))}</div>`;
      return;
    }
    const useGit = profile.techDomain.keywords.some((k) => k.gitLines > 0);
    const kws = [...profile.techDomain.keywords]
      .map((k) => ({
        ...k,
        _local: localLinesOf(profile, k.name),
        // 单轨（D-043）：同步过 git 用 gitLines，否则退到本地 AI 协作行数
        _lines: useGit ? k.gitLines : localLinesOf(profile, k.name),
      }))
      .sort((a, b) => b._lines - a._lines);
    host.innerHTML = kws
      .map((k) => {
        const w = scoreOfLines(k._lines);
        return `
        <div class="kw-item">
          <div class="kw-head">
            <span class="kw-name">${esc(k.name)}</span>
            <span class="kw-meta">${esc(k.lastSeen)} · ${esc(k.source)}</span>
          </div>
          <div class="kw-bars">
            <div class="kw-bar-row">
              <span class="kw-bar-label">${esc(t("barLines"))}</span>
              <span class="kw-bar-track"><span class="kw-bar-fill total" style="width:${w}%"></span></span>
              <span class="kw-bar-val">${k._lines}${esc(t("unitLines"))} · ${w.toFixed(1)}${esc(t("lblCreditShort"))}</span>
            </div>
            <div class="kw-meta">git ${k.gitLines}${esc(t("unitLines"))} · ${esc(t("barLocal"))} ${k._local}${esc(t("unitLines"))}${useGit ? "" : `（${esc(t("hintLocalFallback"))}）`}</div>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderTasks(profile) {
    const host = $("pf-tasks");
    const tasks = profile?.historyTasks ?? [];
    if (tasks.length === 0) {
      host.innerHTML = `<div class="empty">${esc(t("noHistoryTasks"))}</div>`;
      return;
    }
    host.innerHTML = [...tasks]
      .sort((a, b) => b.ts - a.ts)
      .map(
        (task) => `
      <div class="pf-task">
        <span class="t-id">${esc(task.prId)}</span>
        <span class="t-meta">${esc(new Date(task.ts).toISOString().slice(0, 10))} · ${esc(t("lblCreditShort"))} ${task.prCredit} · AI ${task.aiCollabLines}${esc(t("unitLines"))}</span>
      </div>`,
      )
      .join("");
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
    $("pf-draft-body").innerHTML =
      `<div class="hint">${esc(t("draftMeta").replace("{n}", kws.length).replace("{chars}", lastDraft.digestChars ?? "?").replace("{req}", lastDraft.requests ?? "?"))}</div>` +
      `<div>${kws
        .map((k) => `<span class="draft-kw${existing.has(k.name.toLowerCase()) ? "" : " new"}">${esc(k.name)} (${k.gitLines}${esc(t("unitLines"))})</span>`)
        .join("")}</div>`;
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
      $("pf-msg").textContent = `${okMsg}${data.changes ? `（${data.changes}）` : ""}${data.digestChars ? ` · LLM 输入 ${data.digestChars} chars / ${data.requests} req` : ""}`;
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
    // **不要** window.prompt：MiniApp 里会被 iframe CSP 拦掉（见 ui/confirm.js），改用就地输入框
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
    stop() {},
    applyI18n() {
      root.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
      });
      $("pf-home-url").placeholder = "https://github.com/<user>";
      refresh();
    },
  };
}
