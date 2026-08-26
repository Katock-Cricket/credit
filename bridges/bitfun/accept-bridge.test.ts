import { describe, it, expect, vi } from "vitest";
import { createAcceptBridge } from "./accept-bridge.js";
import type { CreditRawEvent } from "@credit/protocol";

describe("accept-bridge", () => {
  it("maps user_accept_file -> userAccept (file, no diff in P0)", () => {
    const handlers: Record<string, Array<(e: any) => void>> = {};
    const bus = {
      getInstance: () => ({
        on: (evt: string, l: (e: any) => void) => {
          (handlers[evt] ??= []).push(l);
          return () => {};
        },
      }),
    };
    const published: CreditRawEvent[] = [];
    createAcceptBridge({
      snapshotBus: bus as any,
      publish: (e) => published.push(e),
      count: () => {},
      logError: vi.fn(),
    });
    // 仅触发 user_accept_file 的 handler（桥还订阅了 block/session 事件）
    (handlers["user_accept_file"] ?? []).forEach((h) =>
      h({ filePath: "src/a.ts", sessionId: "s1", timestamp: 123 }),
    );
    expect(published).toHaveLength(1);
    const e = published[0] as any;
    expect(e.type).toBe("userAccept");
    expect(e.kind).toBe("file");
    expect(e.fileUris).toEqual(["src/a.ts"]);
    expect(e.diffStats).toBeNull();
  });
});
