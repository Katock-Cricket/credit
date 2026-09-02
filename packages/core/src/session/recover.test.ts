import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { SessionManager } from "./session-manager.js";
import { BehaviorStore } from "../store/jsonl-store.js";
import { nodeFsPort } from "../fs-port.js";
import type { Behavior, CreditRawEvent, PrSession } from "@credit/protocol";

const sess = (over: Partial<PrSession>): PrSession => ({
  prId: "pr-x",
  state: "recording",
  startedAt: 1,
  seq: 0,
  counts: {},
  ...over,
});

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

describe("SessionManager — 断点恢复与生命周期（P1 T3）", () => {
  let rootDir: string;
  let store: BehaviorStore;
  let sm: SessionManager;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "credit-recover-"));
    store = new BehaviorStore({ rootDir, fsPort: nodeFsPort });
    sm = new SessionManager(store);
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("recording → 自动续采（沿用 prId 与 seq）", async () => {
    await store.writeSession(sess({ prId: "pr-1", state: "recording", seq: 42 }));
    const r = await sm.recover();
    expect(r.action).toBe("resume");
    expect(sm.prId).toBe("pr-1");
    expect(sm.current?.seq).toBe(42);
  });

  it("recording 续采：session.json 的 seq 被其它进程重置时，以数据文件校正（id 不重复）", async () => {
    // 桥已采集 7 条（id 至 pr-1-7）
    await store.writeSession(sess({ prId: "pr-1", state: "recording", seq: 7 }));
    for (let i = 1; i <= 7; i++) store.append("pr-1", behavior("pr-1", i));
    await store.flush();
    // 只做控制面的进程（MiniApp 原型，不采集事件、seq 恒为 0）覆盖了 session.json
    await store.writeSession(sess({ prId: "pr-1", state: "recording", seq: 0 }));

    const r = await sm.recover();
    expect(r.action).toBe("resume");
    // 关键：seq 必须从数据文件恢复为 7，否则续采的 id 会与已有行重复
    expect(sm.current?.seq).toBe(7);
    expect(sm.nextSeq()).toBe(8);
  });

  it("外部进程写入 idle（放弃记录）时，本地 recording 会话被清空", async () => {
    // 本进程正在记录
    await store.writeSession(sess({ prId: "pr-1", state: "recording", seq: 5 }));
    await sm.recover();
    expect(sm.current?.state).toBe("recording");

    // 原型（另一进程）点了"放弃本轮记录"：写 idle 会话（prId 为空字符串）
    await store.writeSession({
      ...sess({ prId: "", state: "idle" }),
    });

    const changed = await sm.syncFromDisk();
    expect(changed).toBe(true);
    // 关键：本地会话必须被清空，否则会继续往已放弃的 prId 写数据
    expect(sm.current).toBeNull();
  });

  it("外部 idle 且本地本就无会话时，不产生变更", async () => {
    await store.writeSession({ ...sess({ prId: "", state: "idle" }) });
    const changed = await sm.syncFromDisk();
    expect(changed).toBe(false);
    expect(sm.current).toBeNull();
  });

  it("computing 回退 recording 时同样以数据文件校正 seq", async () => {
    await store.writeSession(sess({ prId: "pr-2", state: "computing", seq: 0 }));
    for (let i = 1; i <= 3; i++) store.append("pr-2", behavior("pr-2", i));
    await store.flush();

    const r = await sm.recover();
    expect(r.action).toBe("rewind");
    expect(sm.current?.state).toBe("recording");
    expect(sm.current?.seq).toBe(3);
  });

  it("computing → 回退 recording（P1 无计算）且落盘同步", async () => {
    await store.writeSession(sess({ prId: "pr-2", state: "computing" }));
    const r = await sm.recover();
    expect(r.action).toBe("rewind");
    expect(sm.current?.state).toBe("recording");
    expect((await store.readSession())?.state).toBe("recording");
  });

  it("committed / idle → 等待新会话", async () => {
    await store.writeSession(sess({ prId: "pr-3", state: "committed" }));
    expect((await sm.recover()).action).toBe("wait");
    await store.writeSession(sess({ prId: "pr-4", state: "idle" }));
    expect((await sm.recover()).action).toBe("wait");
  });

  it("session.json 损坏 → 安全降级，不删除任何数据文件", async () => {
    fs.writeFileSync(path.join(rootDir, "session.json"), "{ broken json");
    const r = await sm.recover();
    expect(r.action).toBe("none");
    expect(sm.current).toBeNull();
    expect(fs.existsSync(path.join(rootDir, "session.json"))).toBe(true);
  });

  it("无 session 文件 → none", async () => {
    expect((await sm.recover()).action).toBe("none");
  });

  it("finish = end + commit，直达 committed", async () => {
    await sm.start("pr-5");
    const s = await sm.finish("pr-5");
    expect(s.state).toBe("committed");
    expect((await store.readSession())?.state).toBe("committed");
  });

  it("start 时上轮未结束会先 finish 保存（不停在 computing）", async () => {
    await sm.start("pr-6");
    await sm.end("pr-6"); // 停在 computing
    await sm.start("pr-7");
    expect(sm.prId).toBe("pr-7");
    expect(sm.current?.state).toBe("recording");
  });

  it("reset 放弃本轮：删数据文件 + 置 idle", async () => {
    await sm.start("pr-8");
    store.append("pr-8", behavior("pr-8", 1));
    store.appendRaw("pr-8", rawEvt(1001));
    await store.flush();
    const bf = path.join(rootDir, "behaviors", "pr-8.jsonl");
    const rf = path.join(rootDir, "raw", "pr-8.jsonl");
    expect(fs.existsSync(bf)).toBe(true);
    expect(fs.existsSync(rf)).toBe(true);

    const rep = await sm.reset();
    expect(rep.removed.length).toBe(2);
    expect(rep.failed).toHaveLength(0);
    expect(fs.existsSync(bf)).toBe(false);
    expect(fs.existsSync(rf)).toBe(false);
    expect(sm.current).toBeNull();
    expect((await store.readSession())?.state).toBe("idle");
  });

  it("reset 后未 flush 的缓冲不再落盘", async () => {
    await sm.start("pr-9");
    store.append("pr-9", behavior("pr-9", 1)); // 未 flush
    await sm.reset();
    await store.flush();
    expect(fs.existsSync(path.join(rootDir, "behaviors", "pr-9.jsonl"))).toBe(false);
  });

  it("handle 路由 credit.control.finish", async () => {
    await sm.handle("credit.control.start", "pr-10");
    const s = await sm.handle("credit.control.finish", "pr-10");
    expect(s?.state).toBe("committed");
  });
});
