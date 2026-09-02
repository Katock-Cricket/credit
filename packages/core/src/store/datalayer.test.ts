import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { BehaviorStore, parseJsonl } from "./jsonl-store.js";
import { nodeFsPort, type FsPort } from "../fs-port.js";
import type { Behavior, CreditRawEvent } from "@credit/protocol";

const behavior = (prId: string, seq: number): Behavior => ({
  id: `${prId}-${seq}`,
  prId,
  ts: 1000 + seq,
  actor: "dev",
  action: "edit",
  object: { kind: "file", uri: "a.ts", role: "source" },
  context: {},
  source: "test",
});

const rawEvt = (ts: number): CreditRawEvent =>
  ({ type: "textChanged", uri: "a.ts", beforeText: "a", afterText: "b", ts }) as CreditRawEvent;

describe("BehaviorStore — 双层落盘（P1 T2）", () => {
  let rootDir: string;
  let store: BehaviorStore;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "credit-data-"));
    store = new BehaviorStore({ rootDir, fsPort: nodeFsPort });
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("raw 与 behaviors 分别落盘到各自目录", async () => {
    store.appendRaw("p1", rawEvt(1001));
    store.append("p1", behavior("p1", 1));
    await store.flush();

    const rawFile = path.join(rootDir, "raw", "p1.jsonl");
    const bhvFile = path.join(rootDir, "behaviors", "p1.jsonl");
    expect(fs.existsSync(rawFile)).toBe(true);
    expect(fs.existsSync(bhvFile)).toBe(true);

    const rawLines = fs.readFileSync(rawFile, "utf8").trim().split("\n");
    expect(JSON.parse(rawLines[0]!).type).toBe("textChanged");
    expect(JSON.parse(rawLines[0]!).v).toBe("0.2");
    expect(JSON.parse(fs.readFileSync(bhvFile, "utf8").trim()).action).toBe("edit");
  });

  it("readBehaviors 跳过坏行并计数，且不改写原文件", async () => {
    store.append("p2", behavior("p2", 1));
    await store.flush();
    const file = path.join(rootDir, "behaviors", "p2.jsonl");
    const before = fs.readFileSync(file, "utf8");
    fs.appendFileSync(file, "{ this is not json\n");

    const r = await store.readBehaviors("p2");
    expect(r.badLines).toBe(1);
    expect(r.items).toHaveLength(1);
    expect(r.errors.length).toBe(1);
    // 单向数据流：坏行只跳过，文件不被改写
    expect(fs.readFileSync(file, "utf8")).toBe(before + "{ this is not json\n");
  });

  it("readRaw 同样具备坏行容错", async () => {
    const file = path.join(rootDir, "raw", "p3.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"v":"0.2","type":"textChanged","uri":"a.ts","ts":1}\nBROKEN\n');
    const r = await store.readRaw("p3");
    expect(r.items).toHaveLength(1);
    expect(r.badLines).toBe(1);
  });

  it("v 字段缺失时经版本迁移补全", async () => {
    const file = path.join(rootDir, "behaviors", "p4.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"id":"p4-1","prId":"p4","ts":1,"actor":"dev","action":"edit","object":{},"context":{},"source":"t"}\n');
    const r = await store.readBehaviors("p4");
    expect(r.items).toHaveLength(1);
    expect((r.items[0] as unknown as { v: string }).v).toBe("0.2");
  });

  it("文件不存在返回空结果（不抛错）", async () => {
    const r = await store.readBehaviors("nope");
    expect(r.items).toEqual([]);
    expect(r.badLines).toBe(0);
  });

  it("removeSessionData 在无 unlink 能力时降级为 failed（不抛错）", async () => {
    const files = new Map<string, string>();
    const noUnlink: FsPort = {
      homedir: () => rootDir,
      mkdir: () => {},
      appendFile: async (p: string, c: string) => void files.set(p, (files.get(p) ?? "") + c),
      appendFileSync: (p: string, c: string) => void files.set(p, (files.get(p) ?? "") + c),
      writeFile: async (p: string, c: string) => void files.set(p, c),
      readFile: async (p: string) => files.get(p) ?? "",
      rename: async (a: string, b: string) => {
        files.set(b, files.get(a) ?? "");
        files.delete(a);
      },
      // 不提供 unlink：模拟能力缺失
    };
    const s = new BehaviorStore({ rootDir, fsPort: noUnlink });
    s.append("p5", behavior("p5", 1));
    const rep = await s.removeSessionData("p5");
    expect(rep.removed).toHaveLength(0);
    expect(rep.failed.length).toBe(2);
    // 缓冲已清：后续 flush 不再落盘
    await s.flush();
    expect(files.size).toBe(0);
  });

  it("parseJsonl 忽略空行", () => {
    const r = parseJsonl<{ a: number }>('{"a":1}\n\n{"a":2}\n');
    expect(r.items).toHaveLength(2);
    expect(r.badLines).toBe(0);
  });
});
