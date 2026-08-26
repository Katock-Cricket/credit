import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { SessionManager } from "./session-manager.js";
import { BehaviorStore, type StoreOptions } from "../store/jsonl-store.js";
import { nodeFsPort } from "../fs-port.js";

describe("SessionManager", () => {
  let rootDir: string;
  let sm: SessionManager;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "credit-sess-"));
    const store = new BehaviorStore({ rootDir, fsPort: nodeFsPort });
    sm = new SessionManager(store);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("start -> recording, commits via end/commit", async () => {
    const s = await sm.start("pr-1");
    expect(s.state).toBe("recording");
    expect(sm.prId).toBe("pr-1");
    const ended = await sm.end("pr-1");
    expect(ended.state).toBe("computing");
    const committed = await sm.commit("pr-1", "msg");
    expect(committed.state).toBe("committed");
    expect(committed.commitMsg).toBe("msg");
  });

  it("invalid transition throws", async () => {
    await sm.start("pr-1");
    await sm.end("pr-1");
    await expect(sm.commit("pr-1")).resolves.toBeDefined();
    await expect(sm.end("pr-1")).rejects.toThrow();
  });

  it("handle credit.control.* routes", async () => {
    const started = await sm.handle("credit.control.start", "pr-x");
    expect(started?.state).toBe("recording");
    const status = await sm.handle("credit.control.getStatus");
    expect(status?.prId).toBe("pr-x");
    await sm.handle("credit.control.reset");
    expect(sm.current).toBeNull();
  });

  it("nextSeq increments and bumpCount tracks", async () => {
    await sm.start("pr-1");
    expect(sm.nextSeq()).toBe(1);
    expect(sm.nextSeq()).toBe(2);
    sm.bumpCount("foreshadow-bridge:textChanged");
    sm.bumpCount("foreshadow-bridge:textChanged");
    expect(sm.current?.counts["foreshadow-bridge:textChanged"]).toBe(2);
  });
});
