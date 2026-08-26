import { describe, it, expect, vi } from "vitest";
import { createAgentBridge } from "./agent-bridge.js";
import type { CreditRawEvent } from "@credit/protocol";

describe("agent-bridge", () => {
  it("maps dialog-turn-started -> promptSubmitted and tool-event -> agentToolUse", () => {
    let onTurn: ((e: any) => void) | null = null;
    let onTool: ((e: any) => void) | null = null;
    const agentAPI = {
      onDialogTurnStarted: (cb: (e: any) => void) => {
        onTurn = cb;
        return () => {};
      },
      onToolEvent: (cb: (e: any) => void) => {
        onTool = cb;
        return () => {};
      },
      onTextChunk: () => () => {},
      onDialogTurnCompleted: () => () => {},
    };
    const published: CreditRawEvent[] = [];
    createAgentBridge({
      agentAPI: agentAPI as any,
      publish: (e) => published.push(e),
      count: () => {},
      logError: vi.fn(),
    });
    onTurn!({ sessionId: "s1", prompt: "hello", ts: 1 });
    // tool 聚合：start（无 result，仅缓存）→ complete（result 存在）才 publish
    onTool!({ sessionId: "s1", toolEvent: { toolName: "search", tool_id: "t1", params: { q: "x" } }, ts: 2 });
    onTool!({ sessionId: "s1", toolEvent: { toolName: "search", tool_id: "t1", result: "done", exitCode: 0 }, ts: 3 });
    expect(published).toHaveLength(2);
    expect(published[0]!.type).toBe("promptSubmitted");
    expect(published[1]!.type).toBe("agentToolUse");
    expect((published[1] as any).toolName).toBe("search");
    expect((published[1] as any).toolInput).toEqual({ q: "x" });
    expect((published[1] as any).outputSummary).toBe("done");
  });
});
