import { describe, it, expect } from "vitest";
import { parseNumstat, nullGitPort, nodeGitPort, type GitPort } from "./git-port.js";

describe("parseNumstat（P1 T6）", () => {
  it("解析 added/deleted/file 三列", () => {
    const out = parseNumstat("3\t1\tsrc/a.ts\n10\t0\tsrc/b.ts\n");
    expect(out).toEqual([
      { file: "src/a.ts", added: 3, deleted: 1 },
      { file: "src/b.ts", added: 10, deleted: 0 },
    ]);
  });

  it("二进制文件（-\t-）被跳过", () => {
    expect(parseNumstat("-\t-\timg.png\n2\t2\ta.ts\n")).toEqual([
      { file: "a.ts", added: 2, deleted: 2 },
    ]);
  });

  it("空输入返回空数组", () => {
    expect(parseNumstat("")).toEqual([]);
  });
});

describe("GitPort 兜底语义", () => {
  it("nullGitPort 永远返回 null（补齐失败 → 保持 degraded）", () => {
    expect(nullGitPort.diffNumstat(["a.ts"])).toBeNull();
  });

  it("fileUris 为空时不调用 git", () => {
    expect(nodeGitPort.diffNumstat([])).toBeNull();
  });

  it("mock GitPort 可在 core 中被注入使用", () => {
    const mock: GitPort = {
      diffNumstat: (files: string[]) => files.map((f) => ({ file: f, added: 5, deleted: 2 })),
    };
    expect(mock.diffNumstat(["a.ts"])).toEqual([{ file: "a.ts", added: 5, deleted: 2 }]);
  });
});
