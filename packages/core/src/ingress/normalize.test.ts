import { describe, it, expect } from "vitest";
import { toBehavior, roleOf, actorOf, DEFAULT_INGRESS_CONFIG } from "./normalize.js";
import type { CreditRawEvent } from "@credit/protocol";

describe("roleOf", () => {
  it("classifies by extension/name", () => {
    expect(roleOf("src/foo.spec.ts")).toBe("test");
    expect(roleOf("docs/spec.md")).toBe("spec");
    expect(roleOf("src/main.ts")).toBe("source");
    expect(roleOf("package.json")).toBe("config");
    expect(roleOf("README.txt")).toBe("unknown");
  });
});

describe("toBehavior", () => {
  const prId = "pr-1";
  const cfg = DEFAULT_INGRESS_CONFIG;

  it("maps textChanged -> edit, dev, source role", () => {
    const e: CreditRawEvent = { type: "textChanged", uri: "src/a.ts", afterText: "x", ts: 10 };
    const b = toBehavior(e, prId, 1, cfg);
    expect(b.actor).toBe("dev");
    expect(b.action).toBe("edit");
    expect(b.object.kind).toBe("file");
    expect(b.object.role).toBe("source");
    expect(b.context.after).toBe("x");
    expect(b.id).toBe("pr-1-1");
  });

  it("maps selectionChanged -> cursor/view with line", () => {
    const e: CreditRawEvent = { type: "selectionChanged", uri: "src/a.ts", kind: "select", line: 5, column: 2, selection: "abc", ts: 11 };
    const b = toBehavior(e, prId, 2, cfg);
    expect(b.action).toBe("view");
    expect(b.object.lineRange).toEqual([5, 5]);
    expect(b.context.dwellMs).toBeNull();
  });

  it("maps promptSubmitted -> dev, prompt.submit", () => {
    const e: CreditRawEvent = { type: "promptSubmitted", sessionId: "s1", promptText: "hi", fidelity: "frontend", ts: 12 };
    const b = toBehavior(e, prId, 3, cfg);
    expect(b.actor).toBe("dev");
    expect(b.action).toBe("prompt.submit");
    expect(b.context.promptText).toBe("hi");
  });

  it("maps agentToolUse -> ai, agent.tool with exitCode", () => {
    const e: CreditRawEvent = { type: "agentToolUse", sessionId: "s1", toolName: "search", phase: "end", exitCode: 0, durationMs: 12, fidelity: "frontend", ts: 13 };
    const b = toBehavior(e, prId, 4, cfg);
    expect(b.actor).toBe("ai");
    expect(b.action).toBe("agent.tool");
    expect(b.context.exitCode).toBe(0);
  });

  it("maps userAccept -> dev, accept with diffStats", () => {
    const e: CreditRawEvent = { type: "userAccept", kind: "file", fileUris: ["a.ts"], diffStats: [{ file: "a.ts", added: 3, deleted: 1 }], fidelity: "frontend", ts: 14 };
    const b = toBehavior(e, prId, 5, cfg);
    expect(b.actor).toBe("dev");
    expect(b.action).toBe("accept");
    expect(b.context.diffStats).toHaveLength(1);
  });

  it("actorOf: reviewEvent uses its actor field", () => {
    const e = { type: "reviewEvent", reviewId: "r", revision: 1, actor: "ai" as const, fidelity: "frontend" as const, ts: 1 };
    expect(actorOf(e)).toBe("ai");
  });
});
