import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { BehaviorStore, type StoreOptions } from "./jsonl-store.js";
import { nodeFsPort } from "../fs-port.js";
import type { Behavior } from "@credit/protocol";

function makeBehavior(prId: string, seq: number, ts: number): Behavior {
  return {
    id: `${prId}-${seq}`,
    prId,
    ts,
    actor: "dev",
    action: "edit",
    object: { kind: "file", uri: "a.ts", role: "source" },
    context: {},
    source: "test",
  };
}

describe("BehaviorStore (real tmp fs)", () => {
  let rootDir: string;
  let opts: StoreOptions;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "credit-test-"));
    opts = { rootDir, fsPort: nodeFsPort };
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("append + flush writes jsonl lines with v field", async () => {
    const store = new BehaviorStore(opts);
    store.append("pr-1", makeBehavior("pr-1", 1, 100));
    store.append("pr-1", makeBehavior("pr-1", 2, 200));
    await store.flush();
    const file = path.join(rootDir, "behaviors", "pr-1.jsonl");
    const raw = fs.readFileSync(file, "utf8").trim();
    const lines = raw.split("\n");
    expect(lines).toHaveLength(2);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.v).toBe("0.2");
    expect(parsed.id).toBe("pr-1-1");
  });

  it("writeSession is atomic (tmp removed after rename)", async () => {
    const store = new BehaviorStore(opts);
    await store.writeSession({ prId: "p", state: "recording", startedAt: 1, seq: 0, counts: {} });
    const sessionFile = path.join(rootDir, "session.json");
    expect(fs.existsSync(sessionFile)).toBe(true);
    const tmpKeys = fs.readdirSync(rootDir).filter((k) => k.includes(".session.json.tmp"));
    expect(tmpKeys).toHaveLength(0);
  });

  it("readSession returns null when absent", async () => {
    const store = new BehaviorStore(opts);
    expect(await store.readSession()).toBeNull();
  });

  it("readSession returns written session", async () => {
    const store = new BehaviorStore(opts);
    await store.writeSession({ prId: "p", state: "committed", startedAt: 1, seq: 3, counts: { x: 1 } });
    const s = await store.readSession();
    expect(s?.prId).toBe("p");
    expect(s?.state).toBe("committed");
    expect(s?.seq).toBe(3);
  });
});
