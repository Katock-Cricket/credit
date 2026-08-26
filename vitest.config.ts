import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "bridges/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["packages/**/src/**", "bridges/**/src/**"],
    },
  },
});
