/**
 * raw → behaviors 重放脚本（P2-pre T2，决策 D-013）。
 *
 * 用途：P1 采集时 `sessionId` / `toolName` / `toolInput` 被丢弃或错放进 `object.uri`。
 * 由于 `raw/<prId>.jsonl` 保留原始事件全量，修好归一化层后从 raw 重跑即可让三个字段
 * **原生恢复** —— 比对 `behaviors/` 打补丁只能救回前两者（`toolInput` 永远不可恢复）。
 *
 * 用法：
 *   node scripts/replay-behaviors.mjs --pr <prId> [--dry-run]
 *   node scripts/replay-behaviors.mjs --list
 *   CREDIT_HOME=<dir> node scripts/replay-behaviors.mjs --pr <prId>
 *
 * 行为：
 *   1. 读 raw/<prId>.jsonl（坏行跳过并计数）
 *   2. 经 replayRaw()（normalize + governor，与实时采集同一套逻辑）重放
 *   3. 与现有 behaviors/<prId>.jsonl 对比，产出 diff 报告
 *   4. 非 --dry-run：备份原文件（.bak-<ts>）后原子写（临时文件 + rename）
 *
 * **必须先 build**：`pnpm --filter @credit/core build`（脚本消费 dist 产物）。
 */
import fsp from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
// 直接引 dist 产物：scripts/ 不在 pnpm workspace 的依赖图内（无需额外装依赖），
// 只要 `pnpm --filter @credit/core build` 过即可运行。
import { replayRaw, toBehaviorsJsonl, parseJsonl } from "../packages/core/dist/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE_DIST = path.join(HERE, "..", "packages", "core", "dist", "index.js");

const ROOT = process.env.CREDIT_HOME ?? path.join(os.homedir(), ".bitfun", "credit");

function parseArgs(argv) {
  const out = { pr: null, dryRun: false, list: false, force: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pr") out.pr = argv[++i] ?? null;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--list") out.list = true;
    else if (a === "--force") out.force = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function usage() {
  console.log(`用法：
  node scripts/replay-behaviors.mjs --pr <prId> [--dry-run]
  node scripts/replay-behaviors.mjs --list

参数：
  --pr <prId>   要重放的 PR id（--list 可查看可选值）
  --dry-run     只产出 diff 报告，不写盘
  --list        列出数据目录下所有 raw 文件

环境变量：
  CREDIT_HOME   数据根目录（默认 <home>/.bitfun/credit）
`);
}

/** 统计 Behaviors 的 action 分布与关键字段可得性 */
function summarize(items) {
  const byAction = new Map();
  let withSessionId = 0;
  let withToolName = 0;
  let withToolInput = 0;
  let toolCount = 0;
  for (const b of items) {
    const key = `${b.action}|${b.actor}`;
    byAction.set(key, (byAction.get(key) ?? 0) + 1);
    if (b.context?.sessionId) withSessionId++;
    if (b.action === "agent.tool") {
      toolCount++;
      if (b.context?.toolName) withToolName++;
      if (b.context?.toolInput != null) withToolInput++;
    }
  }
  return { byAction, withSessionId, withToolName, withToolInput, toolCount };
}

function printSummary(title, items, stats) {
  const s = summarize(items);
  console.log(`\n── ${title} ──`);
  console.log(`  条数：${items.length}`);
  for (const [k, v] of [...s.byAction].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(v).padStart(5)}  ${k}`);
  }
  console.log(`  context.sessionId 可得：${s.withSessionId} / ${items.length}`);
  if (s.toolCount > 0) {
    console.log(`  agent.tool 的 toolName 可得：${s.withToolName} / ${s.toolCount}`);
    console.log(`  agent.tool 的 toolInput 可得：${s.withToolInput} / ${s.toolCount}`);
  }
  if (stats) {
    console.log(
      `  治理：merged=${stats.merged} baseline=${stats.baseline} droppedEmptyCmd=${stats.droppedEmptyCmd}`,
    );
  }
  return s;
}

/**
 * raw type → action 的 **1:1 映射**（用于覆盖校验）。
 * 不在此表的类型（selectionChanged 会分流 cursor/view、textChanged 会被 B-010 合成放大）
 * 只作参考输出，不参与一致性判定。
 */
const RAW_TO_ACTION = {
  textScrolled: ["file.scroll"],
  agentToolUse: ["agent.tool"],
  terminalCommand: ["terminal.exec"],
  fileOpened: ["file.open"],
  activeEditorChanged: ["view"],
  promptSubmitted: ["prompt.submit"],
  agentMessage: ["agent.message"],
};

/**
 * 覆盖校验：确认重放**没有丢事件**。
 *
 * 判据：每个 raw type 的条数 == 重放后对应 action 的 `mergedCount` 求和。
 * 单纯比"Behavior 条数"是不够的 —— 合并粒度变化会让条数增减，但只要
 * mergedCount 求和一致，就说明覆盖的原始事件一条不少。
 *
 * 例外：`terminalCommand` 预期减少（D-019 丢弃空 cmd）。
 */
function printCoverage(rawEvents, behaviors) {
  const rawByType = new Map();
  for (const e of rawEvents) {
    const t = e?.type;
    if (typeof t === "string") rawByType.set(t, (rawByType.get(t) ?? 0) + 1);
  }
  const cov = new Map();
  for (const b of behaviors) {
    const n = b.context?.mergedCount ?? 1;
    cov.set(b.action, (cov.get(b.action) ?? 0) + n);
  }

  console.log(`\n── 覆盖校验（raw 条数 → 重放后 mergedCount 求和）──`);
  let mismatch = 0;
  for (const [type, actions] of Object.entries(RAW_TO_ACTION)) {
    const rawN = rawByType.get(type) ?? 0;
    const covN = actions.reduce((s, a) => s + (cov.get(a) ?? 0), 0);
    const isExpectedDrop = type === "terminalCommand" && covN < rawN;
    if (covN !== rawN && !isExpectedDrop) mismatch++;
    const mark = covN === rawN ? "OK  " : isExpectedDrop ? "OK* " : "!!  ";
    const note = isExpectedDrop ? `（-${rawN - covN}，D-019 空 cmd 丢弃）` : "";
    console.log(`    ${mark}${type.padEnd(20)} ${String(rawN).padStart(5)} → ${String(covN).padStart(5)} ${note}`);
  }
  const sel = rawByType.get("selectionChanged") ?? 0;
  const txt = rawByType.get("textChanged") ?? 0;
  console.log(
    `    --  selectionChanged     ${String(sel).padStart(5)} → cursor+view ${(cov.get("cursor") ?? 0) + (cov.get("view") ?? 0)}（参考：view 主要来自 activeEditorChanged）`,
  );
  console.log(
    `    --  textChanged          ${String(txt).padStart(5)} → edit ${cov.get("edit") ?? 0}（参考：含 B-010 从 agentToolUse 合成）`,
  );

  if (mismatch > 0) {
    console.log(`\n    ⚠ ${mismatch} 个类型覆盖不一致 —— 请人工核对后再应用`);
  } else {
    console.log(`\n    覆盖一致（terminal.exec 的减少为 D-019 预期行为）`);
  }
  return mismatch;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  if (!fsSync.existsSync(CORE_DIST)) {
    console.error(
      `未找到 @credit/core 构建产物：${CORE_DIST}\n请先执行：pnpm --filter @credit/core build`,
    );
    process.exitCode = 1;
    return;
  }

  const rawDir = path.join(ROOT, "raw");
  const behDir = path.join(ROOT, "behaviors");

  if (args.list) {
    if (!fsSync.existsSync(rawDir)) {
      console.log(`raw 目录不存在：${rawDir}`);
      return;
    }
    const files = (await fsp.readdir(rawDir)).filter((f) => f.endsWith(".jsonl"));
    if (files.length === 0) {
      console.log("（无 raw 文件）");
      return;
    }
    for (const f of files) {
      const st = await fsp.stat(path.join(rawDir, f));
      console.log(`  ${f.replace(/\.jsonl$/, "")}  ${st.size} bytes`);
    }
    return;
  }

  if (!args.pr) {
    usage();
    process.exitCode = 1;
    return;
  }

  const prId = args.pr;
  const rawFile = path.join(rawDir, `${prId}.jsonl`);
  const behFile = path.join(behDir, `${prId}.jsonl`);

  if (!fsSync.existsSync(rawFile)) {
    console.error(`raw 文件不存在：${rawFile}`);
    process.exitCode = 1;
    return;
  }

  // 1) 读 raw
  const text = await fsp.readFile(rawFile, "utf8");
  const parsed = parseJsonl(text);
  const events = parsed.items.filter(
    (e) => e && typeof e === "object" && typeof e.type === "string",
  );
  console.log(`raw 读入：${events.length} 条（坏行 ${parsed.bad ?? 0} 条已跳过）`);
  console.log(`数据目录：${ROOT}`);

  // 2) 重放
  const result = replayRaw({ prId, events });
  const before = fsSync.existsSync(behFile)
    ? parseJsonl(await fsp.readFile(behFile, "utf8")).items
    : [];

  printSummary("重放前（现有 behaviors）", before, null);
  const after = printSummary("重放后", result.behaviors, result.stats);
  const mismatch = printCoverage(events, result.behaviors);

  // 3) diff 报告
  const beforeActions = summarize(before).byAction;
  const afterActions = after.byAction;
  const keys = new Set([...beforeActions.keys(), ...afterActions.keys()]);
  console.log(`\n── diff（按 action|actor）──`);
  let hasDiff = false;
  for (const k of [...keys].sort()) {
    const b = beforeActions.get(k) ?? 0;
    const a = afterActions.get(k) ?? 0;
    if (b !== a) {
      hasDiff = true;
      console.log(`    ${k}：${b} → ${a}  (${a - b >= 0 ? "+" : ""}${a - b})`);
    }
  }
  if (!hasDiff) console.log("    （分布无变化）");
  console.log(
    `\n  条数：${before.length} → ${result.behaviors.length}  (${result.behaviors.length - before.length >= 0 ? "+" : ""}${result.behaviors.length - before.length})`,
  );

  // 4) 写盘
  if (args.dryRun) {
    console.log(`\n[dry-run] 未写盘。去掉 --dry-run 以应用。`);
    return;
  }

  if (mismatch > 0 && !args.force) {
    console.log(`\n覆盖校验未通过，已中止写盘。确认无误后可加 --force 强制应用。`);
    process.exitCode = 1;
    return;
  }

  await fsp.mkdir(behDir, { recursive: true });
  if (fsSync.existsSync(behFile)) {
    const bak = `${behFile}.bak-${Date.now()}`;
    await fsp.copyFile(behFile, bak);
    console.log(`\n已备份：${bak}`);
  }
  const tmp = `${behFile}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, toBehaviorsJsonl(result.behaviors), "utf8");
  await fsp.rename(tmp, behFile);
  console.log(`已写入：${behFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
