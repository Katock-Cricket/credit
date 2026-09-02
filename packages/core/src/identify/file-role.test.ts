import { describe, it, expect } from "vitest";
import { resolveRole, validateRules } from "./file-role.js";
import { DEFAULT_IDENTIFY_RULES, type IdentifyRule } from "../config.js";

describe("resolveRole（P1 T5，config-driven）", () => {
  it("按默认规则表分类（与 P0 roleOf 行为一致）", () => {
    expect(resolveRole("src/foo.spec.ts")).toBe("test");
    expect(resolveRole("docs/spec.md")).toBe("spec");
    expect(resolveRole("src/main.ts")).toBe("source");
    expect(resolveRole("package.json")).toBe("config");
    expect(resolveRole("README.txt")).toBe("unknown");
  });

  it("规则表可替换（改配置即改行为，无需改代码）", () => {
    const rules: IdentifyRule[] = [{ pattern: "\\.md$", role: "spec" }];
    expect(resolveRole("docs/a.md", rules)).toBe("spec");
    expect(resolveRole("src/a.ts", rules)).toBe("unknown");
  });

  it("大小写不敏感", () => {
    expect(resolveRole("SRC/Foo.SPEC.TS")).toBe("test");
    expect(resolveRole("Docs/SPEC.MD")).toBe("spec");
  });

  it("空 uri 与空规则表兜底 unknown", () => {
    expect(resolveRole("")).toBe("unknown");
    expect(resolveRole("src/a.ts", [])).toBe("unknown");
  });

  it("非法正则被跳过而非抛错", () => {
    const rules: IdentifyRule[] = [
      { pattern: "[unclosed", role: "test" },
      { pattern: "\\.ts$", role: "source" },
    ];
    expect(resolveRole("a.ts", rules)).toBe("source");
    expect(validateRules(rules)).toEqual([0]);
  });

  it("默认规则表自身合法", () => {
    expect(validateRules(DEFAULT_IDENTIFY_RULES)).toEqual([]);
  });
});
