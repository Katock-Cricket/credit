import { defineConfig } from "vitest/config";

/**
 * 注意：`apps/miniapp/source/worker/entry.js` **不能**直接单测 ——
 * 它 `require("@credit/analyzer")`，而工作区包在根 node_modules 只是 pnpm 软链
 * （未构建、exports 不可用），vitest 的 Node 解析器会报 `No "exports" main defined`
 * （Vite alias 也救不了 `createRequire`）。只有 esbuild（`apps/miniapp/build.mjs` 的 alias）
 * 能正确解析，故 Worker 入口的契约测试针对**构建产物** `source/worker.js`
 * （见 `apps/miniapp/source/worker/entry.test.ts`，前置 `node apps/miniapp/build.mjs`）。
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "bridges/**/*.test.ts", "apps/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["packages/**/src/**", "bridges/**/src/**", "apps/**/source/**"],
    },
  },
});
