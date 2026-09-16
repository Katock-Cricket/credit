/**
 * CREDIT MiniApp 部署装配（P4 · T4）。
 *
 * Bitfun 的 MiniApp **源模型只有 6 个文件**（`meta.json` + `source/{index.html,
 * style.css, ui.js, worker.js, esm_dependencies.json}`，见
 * `Bitfun/.../miniapp/storage.rs` 的 `REQUIRED_SOURCE_FILES`），且**宿主无打包器** ——
 * 故本脚本负责把仓库里的构建输入装配成可投放的载荷：
 *
 *   1. 调用 `build.mjs`（esbuild）生成 `source/ui.js`（ESM）与 `source/worker.js`（CJS）；
 *   2. 装配到 `deploy/credit/`（= 应用目录布局）；
 *   3. 可选 `--install [root]`：整目录复制到 MiniApp 根目录（默认读环境变量
 *      `CREDIT_MINIAPP_ROOT`，未提供则仅提示，不猜路径）。
 *
 * 用法：
 *   node apps/miniapp/deploy.mjs                      # 仅装配到 deploy/credit
 *   node apps/miniapp/deploy.mjs --install            # 装配 + 复制到 $CREDIT_MINIAPP_ROOT/credit
 *   node apps/miniapp/deploy.mjs --install "D:/.../miniapps"
 *
 * 注意：`compiled.html` **不生成** —— 它必须由宿主按运行环境（app_id / 数据目录 /
 * workspace / CSP / bridge 脚本）现场编译，手写无效。投放后需在 Bitfun 桌面端
 * 触发一次导入或 `FinalizeMiniApp` 完成注册与编译。
 */
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(here, "source");
const deployDir = path.join(here, "deploy");
const appDir = path.join(deployDir, "credit");

/** 宿主 `REQUIRED_SOURCE_FILES`（少一个都导入失败） */
const REQUIRED = ["index.html", "style.css", "ui.js", "worker.js"];

function log(msg) {
  console.log(`[deploy] ${msg}`);
}

async function assertExists(p, why) {
  try {
    await stat(p);
  } catch {
    throw new Error(`缺少 ${p}（${why}）`);
  }
}

async function build() {
  log("构建 ui.js / worker.js …");
  const r = spawnSync(process.execPath, [path.join(here, "build.mjs")], {
    stdio: "inherit",
    cwd: here,
  });
  if (r.status !== 0) throw new Error("build.mjs 失败");
}

async function assemble() {
  await rm(appDir, { recursive: true, force: true });
  await mkdir(path.join(appDir, "source"), { recursive: true });

  for (const f of [...REQUIRED, "meta.json"]) {
    await assertExists(path.join(sourceDir, f), "请先成功执行 build.mjs");
    await cp(path.join(sourceDir, f), path.join(appDir, f === "meta.json" ? "meta.json" : path.join("source", f)));
  }
  // 无外部 ESM 依赖（UI 已打成单文件）
  await writeFile(path.join(appDir, "source", "esm_dependencies.json"), "[]", "utf8");
  // 与应用创建时的落盘结构保持一致（storage.rs 的 EMPTY_* 常量）
  await writeFile(path.join(appDir, "storage.json"), "{}", "utf8");
  // compiled.html 只能由宿主编译 —— 先落宿主同款占位串（PLACEHOLDER_COMPILED_HTML），
  // 使应用目录结构完整、可被目录扫描发现；真实内容由桌面端 recompile/Finalize 覆盖。
  await writeFile(
    path.join(appDir, "compiled.html"),
    '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>Loading...</body></html>',
    "utf8",
  );

  const meta = JSON.parse(await readFile(path.join(appDir, "meta.json"), "utf8"));
  const nodeEnabled = meta?.permissions?.node?.enabled;
  if (nodeEnabled !== true) {
    throw new Error("meta.json 的 permissions.node.enabled 必须为 true（Worker 承载计算与 git）");
  }
  const scopes = meta?.permissions?.fs?.write ?? [];
  if (!scopes.some((s) => String(s).includes(".bitfun/credit"))) {
    throw new Error("meta.json 的 fs.write 必须包含 {home}/.bitfun/credit（数据面契约）");
  }
  log(`装配完成：meta.json（${meta.name}）+ source/{${REQUIRED.join(", ")}, esm_dependencies.json}`);
}

async function install(rootArg) {
  const root = rootArg || process.env.CREDIT_MINIAPP_ROOT;
  if (!root) {
    log("未提供 --install 目标或 CREDIT_MINIAPP_ROOT —— 仅装配，不投放。");
    log(`投放方式：把 ${appDir} 整个目录复制到 MiniApp 根目录下的 credit/，`);
    log("或在 Bitfun 桌面端用「导入 MiniApp」选择该目录。");
    return;
  }
  const target = path.join(root, "credit");
  await mkdir(path.join(target, "source"), { recursive: true });
  /**
   * **不要 `rm -r` 目标目录**：本机有 safe-delete 包装，删除工作区外目录会走回收站并失败
   * （`Error during a trash operation: Some operations were aborted`），且目标可能正被宿主占用。
   * 改为逐文件覆盖，幂等且不依赖删除权限。
   */
  const files = [
    ["meta.json", "meta.json"],
    ["storage.json", "storage.json"],
    ["compiled.html", "compiled.html"],
    ...REQUIRED.map((f) => [`source/${f}`, `source/${f}`]),
    ["source/esm_dependencies.json", "source/esm_dependencies.json"],
  ];
  for (const [src, rel] of files) {
    await cp(path.join(appDir, src), path.join(target, rel), { force: true });
  }
  log(`已投放：${target}（${files.length} 文件，逐文件覆盖）`);
  log("下一步（需在 Bitfun 桌面端）：触发导入/FinalizeMiniApp 以生成 compiled.html 并注册；");
  log("随后 MiniApp 若在运行中，需重新打开以加载新版 UI。");
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--install");
  const root = i >= 0 ? args[i + 1] : undefined;

  await build();
  await assemble();
  await install(root && !root.startsWith("--") ? root : undefined);
}

main().catch((e) => {
  console.error(`[deploy] 失败：${e?.message ?? e}`);
  process.exit(1);
});
