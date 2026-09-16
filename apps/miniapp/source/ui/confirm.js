/**
 * 界面内确认（P4）。
 *
 * **为什么不用 `window.confirm` / `prompt` / `alert`**：MiniApp 运行在 iframe 里，
 * 宿主会用 Tauri dialog 插件**代理**原生 `confirm`，而该 IPC 走 `http://ipc.localhost/...`
 * 被 iframe 的 CSP `connect-src` 拦掉（实测 console：
 * `Refused to connect because it violates the document's CSP` + `IPC custom protocol failed`），
 * 结果是确认框既不显示、也拿不到结果，破坏性操作（放弃本轮 / 推送）因此**永远走不下去**。
 *
 * 故改为纯 DOM 的确认条：无宿主依赖、两宿主（MiniApp 实机 / 原型）行为一致、可单测不了但极简。
 */
import { t } from "./i18n.js";

/**
 * 在 `host` 内渲染一条确认条，返回用户选择。
 *
 * @param {HTMLElement} host 容器（确认条会被追加到其末尾）
 * @param {{ message: string, okLabel?: string, cancelLabel?: string }} opts
 * @returns {Promise<boolean>} 确认=true，取消=false
 */
export function askConfirm(host, { message, okLabel, cancelLabel } = {}) {
  return new Promise((resolve) => {
    const bar = document.createElement("div");
    bar.className = "confirm-bar";

    const text = document.createElement("span");
    text.className = "confirm-msg";
    text.textContent = message ?? "";

    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "primary";
    ok.textContent = okLabel ?? t("btnConfirm");

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = cancelLabel ?? t("btnCancel");

    const done = (value) => {
      bar.remove();
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === "Escape") done(false);
    };

    ok.addEventListener("click", () => done(true));
    cancel.addEventListener("click", () => done(false));
    document.addEventListener("keydown", onKey);

    bar.append(text, ok, cancel);
    host.append(bar);
    ok.focus();
  });
}
