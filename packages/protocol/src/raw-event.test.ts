import { describe, it, expect } from "vitest";
import { isCreditRawEvent } from "./raw-event.js";

describe("isCreditRawEvent", () => {
  it("recognizes reused events", () => {
    expect(isCreditRawEvent({ type: "textChanged", uri: "a", ts: 1 })).toBe(true);
    expect(isCreditRawEvent({ type: "selectionChanged", uri: "a", kind: "cursor", line: 1, column: 1, ts: 1 })).toBe(true);
    expect(isCreditRawEvent({ type: "terminalCommand", processId: "p", cmd: "ls", phase: "start", ts: 1 })).toBe(true);
  });

  it("recognizes credit events", () => {
    expect(isCreditRawEvent({ type: "promptSubmitted", sessionId: "s", promptText: "x", fidelity: "frontend", ts: 1 })).toBe(true);
    expect(isCreditRawEvent({ type: "agentToolUse", sessionId: "s", toolName: "t", phase: "start", fidelity: "frontend", ts: 1 })).toBe(true);
    expect(isCreditRawEvent({ type: "userAccept", kind: "file", fileUris: ["a"], fidelity: "frontend", ts: 1 })).toBe(true);
  });

  it("rejects non-events", () => {
    expect(isCreditRawEvent(null)).toBe(false);
    expect(isCreditRawEvent(42)).toBe(false);
    expect(isCreditRawEvent({ foo: "bar" })).toBe(false);
    expect(isCreditRawEvent({ type: 123 })).toBe(false);
  });
});
