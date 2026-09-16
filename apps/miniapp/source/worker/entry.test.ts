import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Worker **入口契约**测试。
 *
 * 刻意针对**构建产物** `source/worker.js` 而非 `entry.js` 源码：
 * `entry.js` 里是 `require("@credit/analyzer")`，而工作区包在根 `node_modules` 只是
 * pnpm 软链（未构建、无可用 exports），vitest 走 Node 解析器会直接报
 * `No "exports" main defined` —— 只有 esbuild（`apps/miniapp/build.mjs` 的 alias）
 * 能正确解析。故这里注入**运行时的真实产物**，同时校验构建是否已执行、方法表是否完整。
 *
 * 前置：`node apps/miniapp/build.mjs`
 */
const require = createRequire(import.meta.url);
const BUNDLE = fileURLToPath(new URL("../worker.js", import.meta.url));
const built = existsSync(BUNDLE);

type Handler = (params: any) => Promise<any> | any;

let worker: Record<string, Handler> = {};
let METHODS: string[] = [];

beforeAll(() => {
  if (!built) return;
  worker = require(BUNDLE) as Record<string, Handler>;
  METHODS = Object.keys(worker);
});

describe("Worker 产物与宿主约定", () => {
  it("已构建 source/worker.js（前置：node apps/miniapp/build.mjs）", () => {
    expect(built, `缺少 ${BUNDLE} —— 请先运行 node apps/miniapp/build.mjs`).toBe(true);
  });

  it("导出的是方法字典：CJS module.exports，键含点号（宿主 worker_host.js 用 require() 取键名）", () => {
    expect(METHODS.length).toBeGreaterThan(15);
    expect(METHODS.every((m) => m.startsWith("credit."))).toBe(true);
    expect(METHODS.every((m) => typeof worker[m] === "function")).toBe(true);
  });

  it("四域齐备：计算 / 画像 / 提交 / 中继", () => {
    for (const m of [
      "credit.compute",
      "credit.getTaskStageView",
      "credit.getBehaviors",
      "credit.listPrs",
      "credit.getRules",
      "credit.getConfig",
      "credit.getProfile",
      "credit.importProfileFromGit",
      "credit.confirmProfileDraft",
      "credit.discardProfileDraft",
      "credit.syncProfileFromGit",
      "credit.updateProfileFromPr",
      "credit.editProfile",
      "credit.saveProfile",
      "credit.getChangedFiles",
      "credit.commitAndPush",
      "credit.push",
      "credit.__llmResult",
    ]) {
      expect(METHODS, `缺少 ${m}`).toContain(m);
    }
  });

  it("**不包含控制域**（credit.start/finish/reset/getStatus 属常驻采集桥，由 Bitfun 改动 ③ 转交）", () => {
    for (const m of [
      "credit.start",
      "credit.finish",
      "credit.end",
      "credit.reset",
      "credit.getStatus",
    ]) {
      expect(METHODS).not.toContain(m);
    }
  });
});

describe("Worker 纯方法与参数校验", () => {
  it("credit.getRules 返回 rules v2 树", () => {
    const r = worker["credit.getRules"]!({});
    expect(r.ok).toBe(true);
    expect(r.ruleSet.v).toBeTruthy();
    expect(r.ruleSet.tree).toBeTruthy();
  });

  it("credit.getConfig 返回提交阈值与聚合权重（算法 §6.2）", () => {
    const r = worker["credit.getConfig"]!({});
    expect(r.thresholds.commitWarning).toBe(40);
    expect(r.weights).toEqual({ procWeight: 0.8, devWeight: 0.2 });
  });

  it("credit.__llmResult 未知 id → ok:false（不抛）", async () => {
    const r = await worker["credit.__llmResult"]!({ id: "nope" });
    expect(r.ok).toBe(false);
    expect(String(r.error)).toContain("nope");
  });

  it("credit.getBehaviors 对不存在的 prId → 空列表（坏数据不抛）", async () => {
    const r = await worker["credit.getBehaviors"]!({ prId: "__no_such_pr__" });
    expect(r.ok).toBe(true);
    expect(r.items).toEqual([]);
  });

  it("credit.getProfile 返回结构化响应（无画像时 initialized=false）", async () => {
    const r = await worker["credit.getProfile"]!({});
    expect(r.ok).toBe(true);
    expect(typeof r.initialized).toBe("boolean");
    expect(typeof r.hasGithubToken).toBe("boolean");
  });

  it("缺参在 IO 之前被拦下并给出可读原因", async () => {
    expect((await worker["credit.compute"]!({})).error).toMatch(/prId/);
    expect((await worker["credit.getChangedFiles"]!({})).error).toMatch(/workspaceDir/);
    expect((await worker["credit.importProfileFromGit"]!({})).error).toMatch(/homeUrl/);
    expect((await worker["credit.editProfile"]!({})).error).toMatch(/无编辑内容/);
    expect(
      (await worker["credit.commitAndPush"]!({ workspaceDir: "x", files: [], message: "m" })).error,
    ).toMatch(/文件/);
    expect(
      (await worker["credit.commitAndPush"]!({ workspaceDir: "x", files: ["a"], message: "  " }))
        .error,
    ).toMatch(/说明/);
  });
});
