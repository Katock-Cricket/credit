import { describe, it, expect } from "vitest";
import { createBridge } from "./index.js";
import type { CreditRawEvent } from "@credit/protocol";
import type { FsPort } from "./fs-port.js";

/**
 * 覆盖 P0 冒烟修复的关键逻辑：agent 编辑回溯关联。
 * 背景：agent 写盘 → CodeEditor 异步 reload → textChanged 往往早于 agentToolUse 事件，
 * 导致实时 actor 判定失效。createBridge 在 ingress 层维护"agent 编辑过的文件 + 时间"，
 * textChanged 到达时回溯窗口匹配，命中则强制 source="agent"（actor=ai）。
 * 见《架构设计文档》§5 / 《CREDIT框架算法落地方案》§R-actor。
 *
 * P1 适配：编辑事件经治理层合并后才输出（SPEC §3），故 drain 前需 flushPending；
 * 且 textChanged 必须带 beforeText —— 无 before 的事件按决策 D-007 视为"基线事件"，
 * 只建内容基线、不进入数据层输出。
 */

/** 纯内存 FsPort，避免测试触碰真实磁盘 */
function memFs(): FsPort {
  const files = new Map<string, string>();
  return {
    homedir: () => "/tmp",
    mkdir: () => {},
    appendFile: async (p: string, c: string) => {
      files.set(p, (files.get(p) ?? "") + c);
    },
    appendFileSync: (p: string, c: string) => {
      files.set(p, (files.get(p) ?? "") + c);
    },
    writeFile: async (p: string, c: string) => {
      files.set(p, c);
    },
    readFile: async (p: string) => files.get(p) ?? "null",
    rename: async (a: string, b: string) => {
      files.set(b, files.get(a) ?? "");
      files.delete(a);
    },
  } as unknown as FsPort;
}

/** 捕获 store 内存缓冲中的 behavior 行（先冲刷治理层 pending） */
function drainBehaviors(bridge: ReturnType<typeof createBridge>): any[] {
  bridge.flushPending();
  const s = bridge.store as any;
  const out: any[] = [];
  for (const lines of s.buffer.values()) {
    for (const l of lines) out.push(JSON.parse(l));
  }
  return out;
}

const baseOpts = () => ({ store: { fsPort: memFs() }, logger: { level: "silent" as const } });

/**
 * 已开始记录的 bridge。
 * 启停语义（架构 §5.1-4）：只有 state=recording 时事件才落盘，故测试需显式 start。
 */
async function startedBridge(prId = "pr-test") {
  const b = createBridge(baseOpts());
  await b.session.start(prId);
  return b;
}

describe("createBridge — agent 编辑回溯关联", () => {
  it("textChanged 晚于 agentToolUse（窗口内）被回溯判定为 actor=ai", async () => {
    const b = await startedBridge();
    // 先发 agentToolUse 登记文件（真实场景可能晚到，但这里验证"晚到的 textChanged"被修正）
    b.publish({ type: "agentToolUse", toolName: "Edit", toolInput: { file_path: "D:/proj/src/a.ts" }, ts: 1010 } as any);
    // 该文件的 textChanged 在窗口内到达
    b.publish({ type: "textChanged", uri: "D:/proj/src/a.ts", beforeText: "v1", afterText: "v2", ts: 1020 } as CreditRawEvent);

    const edits = drainBehaviors(b).filter((l) => l.action === "edit" && (l.object?.uri ?? "").includes("a.ts"));
    expect(edits.length).toBe(1);
    expect(edits[0].actor).toBe("ai");
  });

  it("agentToolUse 先到、文件级 textChanged 后到（含跨文件顺序编辑）被正确关联", async () => {
    // 真实时序：agent Edit 工具 complete（文件落盘）→ 桥登记 markAgentEditingFile →
    // CodeEditor 异步 reload model → textChanged 后到。故 agentToolUse 必先于 textChanged。
    const b = await startedBridge();
    // 先登记 agent 编辑 A、B 两个文件（模拟两次 Edit 工具 complete）
    b.publish({ type: "agentToolUse", toolName: "Edit", toolInput: { file_path: "D:/proj/src/a.ts" }, ts: 1017 } as any);
    b.publish({ type: "agentToolUse", toolName: "Edit", toolInput: { file_path: "D:/proj/src/b.ts" }, ts: 1020 } as any);
    // A 的 textChanged 在 30s 窗口内后到
    b.publish({ type: "textChanged", uri: "D:/proj/src/a.ts", beforeText: "v1", afterText: "v2", ts: 1030 } as CreditRawEvent);

    const edits = drainBehaviors(b).filter((l) => l.action === "edit" && (l.object?.uri ?? "").includes("a.ts"));
    expect(edits.length).toBe(1);
    expect(edits[0].actor).toBe("ai");
  });

  it("非 agent 编辑文件不误判为 ai", async () => {
    const b = await startedBridge();
    b.publish({ type: "textChanged", uri: "D:/proj/src/hand.ts", beforeText: "v0", afterText: "x", ts: 2000 } as CreditRawEvent);
    const edits = drainBehaviors(b).filter((l) => l.action === "edit" && (l.object?.uri ?? "").includes("hand.ts"));
    expect(edits.length).toBe(1);
    expect(edits.every((e) => e.actor === "dev")).toBe(true);
  });

  it("路径大小写/分隔符归一化后仍能关联", async () => {
    const b = await startedBridge();
    b.publish({ type: "agentToolUse", toolName: "Edit", toolInput: { file_path: "d:/proj/src/B.ts" }, ts: 3000 } as any);
    b.publish({ type: "textChanged", uri: "D:\\proj\\src\\b.ts", beforeText: "v1", afterText: "y", ts: 3010 } as CreditRawEvent);
    const edits = drainBehaviors(b).filter((l) => l.action === "edit" && (l.object?.uri ?? "").toLowerCase().includes("b.ts"));
    expect(edits.some((e) => e.actor === "ai")).toBe(true);
  });

  it("超过 30s 窗口的 textChanged 不被误判", async () => {
    const b = await startedBridge();
    b.publish({ type: "agentToolUse", toolName: "Edit", toolInput: { file_path: "D:/proj/src/a.ts" }, ts: 1000 } as any);
    b.publish({ type: "textChanged", uri: "D:/proj/src/a.ts", beforeText: "v1", afterText: "old", ts: 1000 + 60_000 } as CreditRawEvent);
    const edits = drainBehaviors(b).filter((l) => l.action === "edit");
    expect(edits.every((e) => e.actor === "dev")).toBe(true);
  });
});

describe("createBridge — 启停语义（架构 §5.1-4：非 recording 丢弃）", () => {
  const evt = (ts = 1000): CreditRawEvent =>
    ({ type: "textChanged", uri: "D:/proj/src/a.ts", beforeText: "v1", afterText: "v2", ts }) as CreditRawEvent;

  it("未开始记录时事件被丢弃：不落盘、不建会话、raw 层也不写", () => {
    const b = createBridge(baseOpts());
    b.publish(evt());
    drainBehaviors(b);
    expect((b.store as any).buffer.size).toBe(0);
    expect((b.store as any).rawBuffer.size).toBe(0);
    expect(b.session.current).toBeNull();
  });

  it("放弃本轮记录（reset）后的事件被丢弃，不自动新建会话", async () => {
    const b = createBridge(baseOpts());
    await b.session.start("pr-a");
    b.publish(evt(1000));
    expect(drainBehaviors(b).length).toBeGreaterThan(0);

    await b.session.reset();
    (b.store as any).buffer.clear(); // 只观察 reset 之后的行为
    b.publish(evt(2000));
    expect(drainBehaviors(b)).toHaveLength(0);
    expect(b.session.current).toBeNull();
  });

  it("结束并保存（finish）后的事件被丢弃", async () => {
    const b = createBridge(baseOpts());
    await b.session.start("pr-b");
    b.publish(evt(1000));
    await b.session.finish("pr-b");
    (b.store as any).buffer.clear();
    b.publish(evt(2000));
    expect(drainBehaviors(b)).toHaveLength(0);
    expect(b.session.current?.state).toBe("committed");
  });

  it("重新 start 后恢复正常记录，且用新 prId", async () => {
    const b = createBridge(baseOpts());
    await b.session.start("pr-c");
    await b.session.reset();
    await b.session.start("pr-d");
    b.publish(evt(3000));
    const rows = drainBehaviors(b);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].prId).toBe("pr-d");
  });
});
