/**
 * normalize 字段归位测试（P2-pre T1，架构 §5.2.1）。
 *
 * 背景：P1 实测发现 `object.uri` 语义随 action 漂移（文件 uri / sessionId /
 * processId / toolName 混用），且 `toolInput` 在归一化时被整个丢弃 —— 而算法
 * §2.6（AI 触发测试识别）与 B-010（未打开文件的 AI 编辑合成）均依赖它。
 *
 * 本文件断言归位后的不变量：
 * 1. `sessionId` / `toolName` / `toolInput` 落到 `context`；
 * 2. `object.uri` 语义由 `object.kind` 唯一决定，禁止跨 kind 混用；
 * 3. 空 cmd 的 terminalCommand 被丢弃（D-019）。
 */
import { describe, it, expect } from "vitest";
import {
  toBehavior,
  extractToolTargetFile,
  actorOf,
  roleOf,
} from "./normalize.js";
import type { CreditRawEvent, Fidelity } from "@credit/protocol";

const TS = 1_700_000_000_000;
const base = { fidelity: "frontend" as Fidelity, ts: TS };
const ev = (e: Record<string, unknown>): CreditRawEvent => e as CreditRawEvent;

describe("normalize · 协议字段归位（架构 §5.2.1）", () => {
  it("promptSubmitted：sessionId 落 context.sessionId，dialog.uri 保持 sessionId", () => {
    const b = toBehavior(
      ev({
        type: "promptSubmitted",
        sessionId: "sess-1",
        promptText: "帮我加个功能",
        ...base,
      }),
      "pr-1",
      1,
    );
    expect(b).not.toBeNull();
    expect(b!.context.sessionId).toBe("sess-1");
    expect(b!.context.promptText).toBe("帮我加个功能");
    expect(b!.object).toEqual({ kind: "dialog", uri: "sess-1" });
  });

  it("agentToolUse：toolName / toolInput / sessionId 落 context", () => {
    const input = {
      file_path: "D:/repo/src/a.ts",
      old_string: "a",
      new_string: "b",
    };
    const b = toBehavior(
      ev({
        type: "agentToolUse",
        sessionId: "sess-1",
        toolName: "Edit",
        toolInput: input,
        outputSummary: "ok",
        phase: "end",
        ...base,
      }),
      "pr-1",
      2,
    );
    expect(b!.context.toolName).toBe("Edit");
    expect(b!.context.toolInput).toEqual(input); // 原样透传，不裁剪
    expect(b!.context.sessionId).toBe("sess-1");
  });

  it("agentToolUse：panel.uri = 工具目标文件，不再塞 toolName", () => {
    const b = toBehavior(
      ev({
        type: "agentToolUse",
        sessionId: "sess-1",
        toolName: "Edit",
        toolInput: { file_path: "D:/repo/src/a.ts" },
        phase: "end",
        ...base,
      }),
      "pr-1",
      3,
    );
    expect(b!.object.kind).toBe("panel");
    expect(b!.object.uri).toBe("D:/repo/src/a.ts");
  });

  it("agentToolUse：toolInput 无文件路径时 panel.uri 不填（禁止回落 toolName）", () => {
    for (const [toolName, toolInput] of [
      ["TodoWrite", { todos: [] }],
      ["Glob", { pattern: "src/**/*" }],
      ["ExecCommand", { cmd: "cargo test --lib" }],
      ["Read", undefined],
    ] as const) {
      const b = toBehavior(
        ev({
          type: "agentToolUse",
          sessionId: "sess-1",
          toolName,
          toolInput,
          phase: "end",
          ...base,
        }),
        "pr-1",
        4,
      );
      expect(b!.object.uri, `${toolName} 的 uri 应为空`).toBeUndefined();
      expect(b!.context.toolName).toBe(toolName);
    }
  });

  it("agentMessage：sessionId 落 context.sessionId", () => {
    const b = toBehavior(
      ev({
        type: "agentMessage",
        sessionId: "sess-1",
        role: "assistant",
        text: "好的",
        ...base,
      }),
      "pr-1",
      5,
    );
    expect(b!.context.sessionId).toBe("sess-1");
    expect(b!.context.after).toBe("好的");
  });

  it("userAccept：sessionId 落 context.sessionId", () => {
    const b = toBehavior(
      ev({
        type: "userAccept",
        kind: "file",
        fileUris: ["D:/repo/src/a.ts"],
        sessionId: "sess-1",
        ...base,
      }),
      "pr-1",
      6,
    );
    expect(b!.context.sessionId).toBe("sess-1");
  });

  it("object.uri 语义由 object.kind 唯一决定（跨全部 action）", () => {
    const cases: Array<[CreditRawEvent, string]> = [
      [
        ev({ type: "fileOpened", uri: "D:/repo/src/a.ts", ...base }),
        "file",
      ],
      [
        ev({
          type: "terminalCommand",
          processId: "proc-1",
          cmd: "cargo test",
          phase: "end",
          ...base,
        }),
        "terminal",
      ],
      [
        ev({
          type: "promptSubmitted",
          sessionId: "sess-1",
          promptText: "x",
          ...base,
        }),
        "dialog",
      ],
      [
        ev({
          type: "agentToolUse",
          sessionId: "sess-1",
          toolName: "Edit",
          toolInput: { file_path: "D:/repo/src/a.ts" },
          phase: "end",
          ...base,
        }),
        "panel",
      ],
    ];
    for (const [evt, kind] of cases) {
      const b = toBehavior(evt, "pr-1", 7);
      expect(b!.object.kind).toBe(kind);
    }
  });
});

describe("normalize · 空 cmd 丢弃（D-019）", () => {
  const mk = (cmd: string): CreditRawEvent =>
    ev({
      type: "terminalCommand",
      processId: "proc-1",
      cmd,
      phase: "end",
      ...base,
    });

  it("空串 / 纯空白 / 换行 → 返回 null（不产出 Behavior）", () => {
    expect(toBehavior(mk(""), "pr-1", 1)).toBeNull();
    expect(toBehavior(mk("   "), "pr-1", 1)).toBeNull();
    expect(toBehavior(mk("\n"), "pr-1", 1)).toBeNull();
    expect(toBehavior(mk("\t  \n"), "pr-1", 1)).toBeNull();
  });

  it("非空白 cmd 正常产出", () => {
    const b = toBehavior(mk("cargo test --lib"), "pr-1", 1);
    expect(b).not.toBeNull();
    expect(b!.action).toBe("terminal.exec");
    expect(b!.context.cmd).toBe("cargo test --lib");
  });

  it("cmd 缺失（undefined）同样丢弃", () => {
    const b = toBehavior(
      ev({
        type: "terminalCommand",
        processId: "proc-1",
        phase: "end",
        ...base,
      }),
      "pr-1",
      1,
    );
    expect(b).toBeNull();
  });
});

describe("extractToolTargetFile", () => {
  it("识别常见文件路径键", () => {
    const cases: Array<[unknown, string | null]> = [
      [{ file_path: "D:/repo/src/a.ts" }, "D:/repo/src/a.ts"],
      [{ filePath: "D:/repo/src/a.ts" }, "D:/repo/src/a.ts"],
      [{ target_file: "src/b.rs" }, "src/b.rs"],
      [{ path: "src/lib" }, "src/lib"],
      [{ notebook_path: "nb.ipynb" }, null], // 无分隔符 → 不算路径
      [{ pattern: "src/**/*" }, null], // 不在候选键
      [{ cmd: "cargo test" }, null], // 命令串不是路径
      [{ file_path: "rm -rf / | x" }, null], // 含 shell 元字符 → 排除
      [undefined, null],
      [null, null],
      ["string", null],
      [[], null],
    ];
    for (const [input, expected] of cases) {
      expect(extractToolTargetFile(input), JSON.stringify(input)).toBe(expected);
    }
  });
});

describe("normalize · 回归（既有映射不因归位而改变）", () => {
  it("roleOf 按扩展名 / 文件名分类（config-driven 规则表）", () => {
    expect(roleOf("src/foo.spec.ts")).toBe("test");
    expect(roleOf("docs/spec.md")).toBe("spec");
    expect(roleOf("src/main.ts")).toBe("source");
    expect(roleOf("package.json")).toBe("config");
    expect(roleOf("README.txt")).toBe("unknown");
  });

  it("selectionChanged → view / cursor，带 lineRange 与 dwellMs", () => {
    const sel = toBehavior(
      ev({
        type: "selectionChanged",
        uri: "src/a.ts",
        kind: "select",
        line: 5,
        column: 2,
        selection: "abc",
        ...base,
      }),
      "pr-1",
      8,
    );
    expect(sel!.action).toBe("view");
    expect(sel!.object.lineRange).toEqual([5, 5]);
    expect(sel!.context.dwellMs).toBeNull();

    const cur = toBehavior(
      ev({
        type: "selectionChanged",
        uri: "src/a.ts",
        kind: "cursor",
        line: 9,
        column: 1,
        ...base,
      }),
      "pr-1",
      9,
    );
    expect(cur!.action).toBe("cursor");
    expect(cur!.object.lineRange).toEqual([9, 9]);
  });

  it("actor / action 映射保持 P1 语义", () => {
    const cases: Array<[CreditRawEvent, "dev" | "ai", string]> = [
      [
        ev({ type: "promptSubmitted", sessionId: "s", promptText: "x", ...base }),
        "dev",
        "prompt.submit",
      ],
      [
        ev({
          type: "agentToolUse",
          sessionId: "s",
          toolName: "Read",
          phase: "end",
          ...base,
        }),
        "ai",
        "agent.tool",
      ],
      [
        ev({
          type: "agentMessage",
          sessionId: "s",
          role: "assistant",
          text: "x",
          ...base,
        }),
        "ai",
        "agent.message",
      ],
      [
        ev({ type: "fileOpened", uri: "D:/repo/a.ts", ...base }),
        "dev",
        "file.open",
      ],
    ];
    for (const [evt, actor, action] of cases) {
      expect(actorOf(evt)).toBe(actor);
      expect(toBehavior(evt, "pr-1", 1)!.action).toBe(action);
    }
  });

  it("textChanged 仍带 before / after / diff", () => {
    const b = toBehavior(
      ev({
        type: "textChanged",
        uri: "D:/repo/src/a.ts",
        changes: [{ op: "insert", startLine: 1, endLine: 1, lines: ["x"] }],
        beforeText: "a",
        afterText: "b",
        ...base,
      }),
      "pr-1",
      1,
    );
    expect(b!.action).toBe("edit");
    expect(b!.context.before).toBe("a");
    expect(b!.context.after).toBe("b");
    expect(b!.context.diff).toHaveLength(1);
  });
});
