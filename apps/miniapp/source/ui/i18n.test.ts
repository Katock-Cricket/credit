import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  MESSAGES,
  PATTERN_I18N,
  STAGE_I18N,
  TASK_TYPE_I18N,
  getLocale,
  setLocale,
  t,
  tMap,
  tPattern,
  tStage,
  tTaskType,
} from "./i18n.js";

const dicts: Array<[string, Record<string, Record<string, string>>]> = [
  ["MESSAGES", MESSAGES as never],
  ["STAGE_I18N", STAGE_I18N as never],
  ["TASK_TYPE_I18N", TASK_TYPE_I18N as never],
  ["PATTERN_I18N", PATTERN_I18N as never],
];

describe("i18n 字典完整性", () => {
  it.each(dicts)("%s 每个条目都有 zh-CN 与 en-US", (_name, dict) => {
    const missing: string[] = [];
    for (const [key, entry] of Object.entries(dict)) {
      if (!entry["zh-CN"]) missing.push(`${key}.zh-CN`);
      if (!entry["en-US"]) missing.push(`${key}.en-US`);
    }
    expect(missing).toEqual([]);
  });

  it("MESSAGES 无空串（空文案等同漏翻）", () => {
    const empty = Object.entries(MESSAGES).filter(
      ([, v]: [string, any]) => !v["zh-CN"]?.trim() || !v["en-US"]?.trim(),
    );
    expect(empty.map(([k]) => k)).toEqual([]);
  });
});

describe("i18n 取值与回退", () => {
  it("setLocale 只接受受支持语言", () => {
    setLocale("en-US");
    expect(getLocale()).toBe("en-US");
    setLocale("fr-FR" as never);
    expect(getLocale()).toBe("en-US");
    setLocale("zh-CN");
  });

  it("t() 未注册键 → 原样返回键名（便于发现漏配）", () => {
    expect(t("__not_exist__")).toBe("__not_exist__");
  });

  it("tMap / tStage / tTaskType / tPattern 未命中 → 返回原键", () => {
    expect(tMap(STAGE_I18N as never, "__x__")).toBe("__x__");
    expect(tStage("__x__")).toBe("__x__");
    expect(tTaskType("__x__")).toBe("__x__");
    expect(tPattern("__x__")).toBe("__x__");
    expect(tMap(null as never, "spec")).toBe("spec");
  });

  it("已注册键在两种语言下都有实际文本", () => {
    setLocale("zh-CN");
    const zh = t("btnStartPr");
    setLocale("en-US");
    const en = t("btnStartPr");
    expect(zh).not.toBe("btnStartPr");
    expect(en).not.toBe("btnStartPr");
    expect(zh).not.toBe(en);
    setLocale("zh-CN");
  });
});

/** 静态文案的 key 必须真实存在 —— 否则界面上会直接显示 key 名 */
describe("静态文案键与源码对齐", () => {
  it("index.html 的 data-i18n / data-i18n-ph 全部已注册", () => {
    const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
    const keys = [...html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(20);
    const missing = keys.filter((k) => !MESSAGES[k]);
    expect(missing).toEqual([]);
  });

  it("ui/ 下的 t(\"key\") 字面量全部已注册", () => {
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
    const missing: string[] = [];
    for (const f of files) {
      const src = readFileSync(`${dir}${f}`, "utf8");
      for (const m of src.matchAll(/\bt\("([A-Za-z][A-Za-z0-9_]*)"\)/g)) {
        const key = m[1]!;
        if (!MESSAGES[key]) missing.push(`${f}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
