/**
 * C3 · SPEC / 测试方案文件识别（算法 §2.3）。
 *
 * **仅文件形态**（算法 A4 最终版）：SPEC = 仓库中符合命名模式的文档，
 * 不采"对话中口述的规格"。
 *
 * 两个已确立的口径（P2-pre 起沿用）：
 * 1. **README 不算 SPEC** —— 它是项目说明，不是本次需求的规格；
 * 2. SPEC 的"审阅"包含**纯阅读**（用户打开 SPEC 看，不一定要编辑）。
 */
import type { Behavior } from "@credit/protocol";
import type { SpecDoc, FsPort } from "../credit/types.js";
import { matchGlob } from "./core-diff.js";

export interface SpecPatterns {
  filePatterns: string[];
  excludePatterns: string[];
  minContentChars: number;
}

export function isSpecUri(uri: string, cfg: SpecPatterns): boolean {
  if (!uri) return false;
  // README 排除（硬规则，不进 pattern 表，避免被用户配置覆盖掉）
  if (/(^|[\\/])readme/i.test(uri)) return false;
  if (cfg.excludePatterns.some((p) => matchGlob(uri, p))) return false;
  return cfg.filePatterns.some((p) => matchGlob(uri, p));
}

/** 测试文件：路径或文件名含 test/spec 语义（Rust 的 #[cfg(test)] 内联测试靠内容识别，见 rtm.ts） */
export function isTestUri(uri: string): boolean {
  if (!uri) return false;
  const lower = uri.replace(/\\/g, "/").toLowerCase();
  return (
    /(^|\/)(tests?|spec|__tests__)\//.test(lower) ||
    /\.(test|spec)\.[a-z]+$/.test(lower) ||
    /_test\.[a-z]+$/.test(lower) ||
    /(^|\/)test_[^/]*\.[a-z]+$/.test(lower)
  );
}

/**
 * SPEC 条目切分（C7 复用）：按 Markdown 标题与编号列表切；条目 < 2 时整文为 1 条目。
 */
export function splitSpecItems(content: string): Array<{ id: string; text: string }> {
  const text = String(content ?? "");
  if (!text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const marks: Array<{ idx: number; text: string }> = [];
  lines.forEach((l, i) => {
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h && h[2]!.trim()) {
      marks.push({ idx: i, text: h[2]!.trim() });
      return;
    }
    const n = /^\s*(?:\d+[.、)]|[-*+]\s*\[(?:REQ|x| )\])\s+(.*)$/.exec(l);
    if (n && n[1]!.trim()) marks.push({ idx: i, text: n[1]!.trim() });
  });

  if (marks.length < 2) return [{ id: "R1", text: text.trim() }];

  return marks.map((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1]!.idx : lines.length;
    return { id: `R${i + 1}`, text: lines.slice(m.idx, end).join("\n").trim() };
  });
}

/**
 * 剥离代码块（**防止模型"续写代码"**）。
 *
 * 实测：`spec.aiDecisionRatio` 把 SPEC 全文喂给模型，而 SPEC 里大段是 Rust 定义，
 * 模型直接续写了 `rust struct CodecProbeResult {...}` 而不是输出 JSON —— 且呈**间歇性**
 * （同一次运行里其它 LLM 指标正常，它却失败；重跑一次又可能成功）。
 * 决策点是自然语言概念，本就不需要代码细节，故一律剥离。
 */
export function stripCodeBlocks(md: string): string {
  let t = String(md ?? "");
  // 围栏代码块（``` 或 ~~~）
  t = t.replace(/```[\s\S]*?```/g, "\n[代码块已省略]\n");
  t = t.replace(/~~~[\s\S]*?~~~/g, "\n[代码块已省略]\n");
  // 行内代码保留占位，避免句子被切断
  t = t.replace(/`[^`\n]{1,120}`/g, "`…`");
  return t;
}

/** 从行为与 diff 中收集候选 SPEC uri */
export function collectSpecUris(
  behaviors: Behavior[],
  gitFiles: string[],
  cfg: SpecPatterns,
): string[] {
  const set = new Set<string>();
  for (const b of behaviors) {
    if (b.object?.kind === "file" && b.object.uri && isSpecUri(b.object.uri, cfg)) {
      set.add(b.object.uri);
    }
  }
  for (const u of gitFiles) if (isSpecUri(u, cfg)) set.add(u);
  return [...set];
}

/** 载入 SPEC 内容并切条目；内容过短（< minContentChars）的丢弃（无评估意义） */
export async function loadSpecDocs(
  uris: string[],
  fs: FsPort | null,
  cfg: SpecPatterns,
): Promise<SpecDoc[]> {
  const out: SpecDoc[] = [];
  for (const uri of uris) {
    const content = fs ? await fs.readFile(uri) : null;
    if (content == null) continue;
    if (content.trim().length < cfg.minContentChars) continue;
    out.push({ uri, content, items: splitSpecItems(content) });
  }
  return out;
}
