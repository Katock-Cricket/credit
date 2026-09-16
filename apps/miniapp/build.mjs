/**
 * CREDIT MiniApp 构建（P4）。
 *
 * 为什么需要构建：Bitfun MiniApp 的**源模型只有 6 个文件**
 * （`meta.json` + `source/{index.html, style.css, ui.js, worker.js, esm_dependencies.json}`），
 * 宿主**没有打包器**——
 * - `source/ui.js` 被原样内联进 `compiled.html` 的 `<script type="module">`，**不做转译**；
 * - `source/worker.js` 由 `worker_host.js` 用 **CJS `require()`** 加载（必须是单文件、CommonJS）。
 *
 * 因此本脚本把内部模块打成两个单文件产物：
 *   `source/ui/main.js` + `source/ui/*.js`      → `source/ui.js`      （ESM 单文件）
 *   `source/worker/entry.js` + `@credit/*` 包   → `source/worker.js`  （CJS 单文件）
 *
 * 运行：`node apps/miniapp/build.mjs`（或 `pnpm -C apps/miniapp build`）
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(here, "source");
const repoRoot = path.resolve(here, "..", "..");

/**
 * 工作区包不在 node_modules 里（pnpm workspace，且根未链接 @credit/*），
 * 故显式 alias 到各包的 dist 产物。
 */
const WORKSPACE_ALIAS = {
  "@credit/analyzer": path.join(repoRoot, "packages/analyzer/dist/index.js"),
  "@credit/rules": path.join(repoRoot, "packages/rules/dist/index.js"),
  "@credit/protocol": path.join(repoRoot, "packages/protocol/dist/index.js"),
  "@credit/core": path.join(repoRoot, "packages/core/dist/index.js"),
};

const BANNER = (from) =>
  `/* 自动生成（apps/miniapp/build.mjs）—— 源：${from}；请勿直接编辑本文件 */`;

/**
 * 生成 `source/meta.json` —— 必须是**完整** `MiniAppMeta`
 * （`product-domains/src/miniapp/types.rs`）。
 *
 * **踩坑记录（B-023）**：`id/name/description/icon/category/version/created_at/updated_at`
 * 在该结构体里**没有** `#[serde(default)]`，缺任何一个都会让 `meta.json` 反序列化失败，
 * 于是 `MiniAppStorage::list_app_ids() → load_meta()` 报错、**画廊里根本看不到这个应用**
 * （现象："desktop:dev 里没有 CREDIT 界面"，且控制台无显式报错）。
 * 故这里由 `meta.src.json`（作者维护静态字段）+ 生成字段组合出完整结构，并做自检。
 */
const META_REQUIRED = [
  "id",
  "name",
  "description",
  "icon",
  "category",
  "version",
  "created_at",
  "updated_at",
];
const RUNTIME_PROFILES = new Set(["compatibility", "marketStrict", "market_strict"]);

function buildMeta() {
  const srcPath = path.join(here, "meta.src.json");
  const src = JSON.parse(readFileSync(srcPath, "utf8"));
  const outPath = path.join(sourceDir, "meta.json");
  const prev = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : null;

  const now = Date.now();
  const meta = {
    ...src,
    // created_at 只在首次生成时落定（避免每次构建都"新建"）
    created_at: prev?.created_at ?? now,
    updated_at: now,
    // 运行时状态：交给宿主在 recompile / sync_from_fs 时重算
    runtime: {
      source_revision: "",
      content_hash: "",
      deps_revision: "",
      deps_dirty: false,
      worker_restart_required: true,
      ui_recompile_required: true,
    },
  };

  const missing = META_REQUIRED.filter((k) => meta[k] === undefined || meta[k] === "");
  if (missing.length > 0) throw new Error(`meta 缺少必填字段：${missing.join(", ")}`);
  if (!RUNTIME_PROFILES.has(String(meta.runtime_profile))) {
    throw new Error(`runtime_profile 非法：${meta.runtime_profile}`);
  }
  if (meta.permissions?.node?.enabled !== true) {
    throw new Error("permissions.node.enabled 必须为 true（Worker 承载计算与 git）");
  }
  if (!(meta.permissions?.fs?.write ?? []).some((s) => String(s).includes(".bitfun/credit"))) {
    throw new Error("permissions.fs.write 必须包含 {home}/.bitfun/credit（数据面契约）");
  }
  if (!meta.i18n?.locales?.["zh-CN"] || !meta.i18n?.locales?.["en-US"]) {
    throw new Error("i18n.locales 必须同时提供 zh-CN 与 en-US（宿主画廊按语言挑选）");
  }

  writeFileSync(outPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(`[build] source/meta.json 已生成（id=${meta.id} icon=${meta.icon} category=${meta.category}）`);
}

async function run() {
  const common = { bundle: true, logLevel: "warning", sourcemap: false, minify: false };

  buildMeta();

  await build({
    ...common,
    entryPoints: [path.join(sourceDir, "ui/main.js")],
    outfile: path.join(sourceDir, "ui.js"),
    format: "esm",
    target: "es2022",
    banner: { js: BANNER("source/ui/main.js + source/ui/*.js") },
  });

  const workerEntry = path.join(sourceDir, "worker/entry.js");
  if (existsSync(workerEntry)) {
    await build({
      ...common,
      entryPoints: [workerEntry],
      outfile: path.join(sourceDir, "worker.js"),
      format: "cjs",
      platform: "node",
      target: "es2022",
      alias: WORKSPACE_ALIAS,
      banner: { js: BANNER("source/worker/entry.js + @credit/*") },
    });
    console.log("[build] source/ui.js（ESM）+ source/worker.js（CJS）已生成");
  } else {
    console.warn("[build] source/ui.js（ESM）已生成；未找到 source/worker/entry.js，跳过 worker 打包");
  }
}

run().catch((e) => {
  console.error("[build] 失败：", e?.message ?? e);
  process.exit(1);
});
