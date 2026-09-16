import { describe, it, expect } from "vitest";
import {
  CONTROL_VIEWS,
  allowedControlViews,
  homeActions,
  isSessionBusy,
  resolveControlView,
} from "./control-flow.js";

describe("allowedControlViews（结果决定可达视图）", () => {
  it("无结果 → 只有 home", () => {
    expect(allowedControlViews({ hasResult: false })).toEqual(["home"]);
  });

  it("有结果 → 四视图全可达", () => {
    expect(allowedControlViews({ hasResult: true })).toEqual(CONTROL_VIEWS);
  });
});

describe("isSessionBusy", () => {
  it("recording / computing 视为进行中", () => {
    expect(isSessionBusy("recording")).toBe(true);
    expect(isSessionBusy("computing")).toBe(true);
  });

  it("idle / committed 不视为进行中", () => {
    expect(isSessionBusy("idle")).toBe(false);
    expect(isSessionBusy("committed")).toBe(false);
    expect(isSessionBusy(undefined)).toBe(false);
  });
});

describe("resolveControlView（D-047 状态机）", () => {
  it("显式 requested 且允许 → 采用", () => {
    expect(
      resolveControlView({ sessionState: "committed", hasResult: true, requested: "commit" }),
    ).toBe("commit");
  });

  it("requested 不被允许（无结果却请求 commit）→ 回落", () => {
    expect(resolveControlView({ hasResult: false, requested: "commit" })).toBe("home");
  });

  it("recording 优先回 home（即使有结果）", () => {
    expect(
      resolveControlView({ sessionState: "recording", hasResult: true, current: "commit" }),
    ).toBe("home");
  });

  it("无结果 → home（无论 current 是什么）", () => {
    expect(resolveControlView({ sessionState: "idle", hasResult: false, current: "result" })).toBe(
      "home",
    );
  });

  it("有结果且 current 合法 → 停留（避免视图跳动）", () => {
    expect(
      resolveControlView({ sessionState: "committed", hasResult: true, current: "commit" }),
    ).toBe("commit");
  });

  it("有结果但无 current（首次进入）→ 兜底 result", () => {
    expect(resolveControlView({ sessionState: "committed", hasResult: true })).toBe("result");
  });

  it("current 为 home 时停留在 home（home 恒合法）", () => {
    expect(
      resolveControlView({ sessionState: "committed", hasResult: true, current: "home" }),
    ).toBe("home");
  });
});

describe("homeActions（主操作可用性）", () => {
  it("idle：仅 start 可用", () => {
    expect(homeActions({ sessionState: "idle" })).toEqual({
      canStart: true,
      canFinish: false,
      canReset: false,
      canViewResult: false,
    });
  });

  it("recording：可 finish/reset，不可 start", () => {
    const a = homeActions({ sessionState: "recording" });
    expect(a.canStart).toBe(false);
    expect(a.canFinish).toBe(true);
    expect(a.canReset).toBe(true);
  });

  it("committed：仅可 reset / 查看结果", () => {
    const a = homeActions({ sessionState: "committed" });
    expect(a.canStart).toBe(false);
    expect(a.canFinish).toBe(false);
    expect(a.canReset).toBe(true);
    expect(a.canViewResult).toBe(true);
  });
});
