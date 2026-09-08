/**
 * C7 · RTM 映射矩阵（算法 §2.7）：需求 ↔ 测试 ↔ Task。
 *
 * 一次计算产出三张矩阵，多处指标复用：
 * - `specCoverage` → 「测试对SPEC覆盖率」与「TC-L1」（理论框架定义二者同源同值）；
 * - `specToTask`   → 「可追踪性」「生成与SPEC对齐度」；
 * - `diffToTest`   → 规则：Diff 文件 × 测试文件（同目录 / 命名关联）。
 *
 * LLM 失败时 `llmOk=false`、覆盖率为 0 —— **由调用方按 §1.5 降级**，
 * 本函数不自行决定"该给多少分"。
 */
import type { FsPort } from "../credit/types.js";
import type { SpecDoc, RtmMatrix } from "../credit/types.js";
import type { LlmPort } from "../llm/port.js";
import { llmJson, asArray } from "./llm-json.js";

export interface TestCaseRef {
  id: string;
  name: string;
  uri: string;
}

/**
 * 测试用例提取（规则）：覆盖 JS/TS、Python、Go、Rust 常见写法。
 *
 * **Rust 的关键点**：测试函数由 `#[test]` **属性**标识，函数名**不一定含 test**
 * （实测样例里是 `detects_eac3_file` / `detects_aac_file` / `missing_file_returns_unknown`，
 * 全都含 "test" 才怪）。初版按"函数名含 test"识别 → 3 个全漏，
 * 连带「测试对SPEC覆盖率」「TC-L1」「TC-L5」一串指标失真。
 * 改为**记住上一行的 `#[test]` 属性**。
 */
export function extractTestCases(content: string, uri: string): TestCaseRef[] {
  const out: TestCaseRef[] = [];
  const lines = String(content ?? "").split(/\r?\n/);
  let n = 0;
  const push = (name: string) => {
    n += 1;
    out.push({ id: `${uri}#${n}`, name: name.slice(0, 120), uri });
  };

  /** 上一行是否为测试属性（Rust `#[test]`） */
  let prevIsTestAttr = false;
  /** 是否在 `#[cfg(test)] mod tests` 块内 */
  let inTestModule = false;

  for (const raw of lines) {
    const l = raw.trim();

    if (/^#\[cfg\(test\)\]/.test(l)) {
      inTestModule = true;
      continue;
    }
    if (/^#\[test\]/.test(l) || /^#\[tokio::test\]/.test(l)) {
      prevIsTestAttr = true;
      continue;
    }

    let m = /^(?:test|it)\s*\(\s*['"`](.{1,120}?)['"`]/.exec(l);
    if (m) {
      push(m[1]!);
      prevIsTestAttr = false;
      continue;
    }
    m = /^def\s+(test_\w+)/.exec(l);
    if (m) {
      push(m[1]!);
      prevIsTestAttr = false;
      continue;
    }
    m = /^func\s+(Test\w+)/.exec(l);
    if (m) {
      push(m[1]!);
      prevIsTestAttr = false;
      continue;
    }

    // Rust：属性之后的函数，或测试模块内名字含 test 的函数
    m = /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\(/.exec(l);
    if (m) {
      if (prevIsTestAttr || (inTestModule && /test/i.test(m[1]!))) push(m[1]!);
      prevIsTestAttr = false;
      continue;
    }

    // 其它行会打断属性连续性（属性与 fn 之间通常只有空行/注释，这里保守处理）
    if (l !== "") prevIsTestAttr = false;
  }
  return out;
}

interface LlmMapping {
  mappings?: Array<{ reqId?: string; testIds?: string[]; confidence?: number }>;
  taskMap?: Array<{ reqId?: string; taskIds?: string[] }>;
}

/**
 * **字段名必须钉死并给出完整示例**：模型很"聪明"地把数组改名成 `results` / `items`，
 * 而 schema 强校验 `required:["mappings"]` 会直接判失败 ——
 * 实测表现为"LLM 不可用"，排查时极具误导性（实际 LLM 完全正常，53s 正常返回了）。
 * 故：提示给完整示例 + 校验放宽 + 解析容忍别名，三管齐下。
 */
const RTM_SYSTEM = `你是需求-测试追溯分析助手。下面给出 SPEC 条目与测试用例清单，请判断每个 SPEC 条目由哪些测试用例覆盖。

要求：
1. 依据用例名称与条目语义匹配，不要臆造不存在的用例；
2. confidence 为 0–1 的置信度，无法判断时给低值；
3. 只输出 json，**字段名必须严格如下**，不要改名、不要输出任何其他文字：

{"mappings":[{"reqId":"R1","testIds":["x.rs#1"],"confidence":0.9}],"taskMap":[{"reqId":"R1","taskIds":["T1"]}]}`;

/** 容忍模型用不同字段名承载同一语义（实测会出现 results / items / matches） */
function pickArray(data: unknown, keys: string[]): unknown[] {
  if (!data || typeof data !== "object") return [];
  const rec = data as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

export async function buildRtm(args: {
  specs: SpecDoc[];
  testUris: string[];
  fs: FsPort | null;
  llm: LlmPort;
  taskIds: string[];
  gitFiles: string[];
}): Promise<RtmMatrix> {
  const specItems = args.specs.flatMap((s) =>
    s.items.map((it) => ({ id: `${s.uri}::${it.id}`, text: it.text.slice(0, 300) })),
  );

  const testCases: TestCaseRef[] = [];
  for (const uri of args.testUris) {
    const content = args.fs ? await args.fs.readFile(uri) : null;
    if (content == null) continue;
    testCases.push(...extractTestCases(content, uri));
  }

  const matrix: RtmMatrix = {
    specItems,
    testCases,
    specToTest: {},
    specToTask: {},
    diffToTest: {},
    specCoverage: 0,
    llmOk: false,
  };

  // diffToTest：规则（同目录 / 名称关联）
  for (const f of args.gitFiles) {
    const dir = f.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    const base = (f.replace(/\\/g, "/").split("/").pop() ?? "").replace(/\.[^.]+$/, "");
    const hits = testCases
      .filter((t) => {
        const td = t.uri.replace(/\\/g, "/");
        const tdir = td.split("/").slice(0, -1).join("/");
        return tdir === dir || td.toLowerCase().includes(base.toLowerCase());
      })
      .map((t) => t.id);
    if (hits.length) matrix.diffToTest[f] = hits;
  }

  if (specItems.length === 0 || testCases.length === 0) {
    return {
      ...matrix,
      error: `跳过 LLM 匹配：SPEC 条目 ${specItems.length} 个、测试用例 ${testCases.length} 个`,
    };
  }

  /**
   * **输入必须限流**：实测一份 SPEC 能切出 31 个条目，若每个都给 600 字符，
   * 单次 prompt 接近 2 万字符 —— 推理模型处理这种长度极易超时或输出被截断，
   * 表现为 `llmOk=false`，连带「测试对SPEC覆盖率」「TC-L1」「可追踪性」一串指标失真。
   * 故：条目 ≤ 25、每条 ≤ 300 字符、用例 ≤ 60。
   */
  const user = JSON.stringify({
    specItems: specItems.slice(0, 25).map((s) => ({ id: s.id, text: s.text.slice(0, 300) })),
    testCases: testCases.slice(0, 60).map((t) => ({ id: t.id, name: t.name, uri: t.uri })),
    taskIds: args.taskIds.slice(0, 20),
  });

  const r = await llmJson<LlmMapping>(args.llm, {
    metricId: "rtm",
    templateId: "rtm-v1",
    system: RTM_SYSTEM,
    user,
    // 不强校验字段名：模型可能改名，改由 pickArray 容忍；
    // 强校验只会把"字段名不同"误报成"LLM 不可用"，排查成本极高
    schema: { type: "object" },
  });

  if (!r.ok || !r.data) {
    return { ...matrix, error: r.rationale };
  }
  matrix.llmOk = true;

  const mappings = pickArray(r.data, ["mappings", "results", "items", "matches"]);
  const taskMap = pickArray(r.data, ["taskMap", "taskToSpec", "taskMappings", "tasks"]);

  for (const m of asArray<NonNullable<LlmMapping["mappings"]>[number]>(mappings)) {
    const reqId = String(m?.reqId ?? "");
    if (!reqId) continue;
    const conf = Number(m?.confidence ?? 0);
    // confidence < 0.6 视为未覆盖（算法 §2.7）
    if (conf >= 0.6) matrix.specToTest[reqId] = (m?.testIds ?? []).map(String);
  }
  for (const t of asArray<{ reqId?: string; taskIds?: string[] }>(taskMap)) {
    const reqId = String(t?.reqId ?? "");
    if (reqId) matrix.specToTask[reqId] = (t?.taskIds ?? []).map(String);
  }

  const covered = Object.values(matrix.specToTest).filter((v) => v.length > 0).length;
  matrix.specCoverage = specItems.length > 0 ? covered / specItems.length : 0;

  return matrix;
}
