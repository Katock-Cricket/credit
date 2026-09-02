/**
 * CREDIT 可调配置（AGENTS §9：可调参数一律进 config，禁止硬编码阈值/规则）。
 *
 * 设计：
 * - 包内提供 `DEFAULT_CREDIT_CONFIG`（代码默认值，离线单测直接可用）；
 * - 运行时可用 `loadConfig(fs, rootDir)` 从 `<rootDir>/config.json` 覆盖；
 * - 合并为浅合并，`identify.rules` 若提供则整体替换。
 */
import type { ObjectRole } from "@credit/protocol";
import type { FsPort } from "./fs-port.js";
import { joinPath } from "./fs-port.js";

export interface IdentifyRule {
  /** 正则字符串（对 lower-case 后的 uri 匹配） */
  pattern: string;
  /** 命中后标注的文件角色 */
  role: ObjectRole;
  /** 可选说明（文档/调试用，不影响匹配） */
  note?: string;
}

export interface CreditConfig {
  /** 采集桥一级编辑 debounce（ms）；由桥实际使用，core 侧仅记录以便文档与实测对齐 */
  bridgeEditMergeMs: number;
  /**
   * 编辑合并的**失焦行跳跃阈值**（行）：同一文件内连续编辑，若新编辑位置与上一次编辑
   * 位置的行号差超过该值，视为注意力转移（失焦）→ 结算此前暂存的编辑。
   * 对齐 foreshadow：`artifactLostFocusThr = 2 * editDiffPadding`。
   */
  editLostFocusLineThr: number;
  /** 编辑暂存的最长保留时间（ms）：兜底，避免长时间不失焦时数据滞留内存 */
  editMaxHoldMs: number;
  /** 合并后重算 diff 时每个 hunk 上下保留的上下文行数 */
  editDiffPadding: number;
  /**
   * 是否从 `agentToolUse`（Edit/Write）为**未打开的文件**合成 AI 编辑行为。
   *
   * 背景：编辑事件源自编辑器 model 变更，**未打开的文件不会产生 textChanged** ——
   * Agent 改了没打开的文件时，这条 AI 编辑行为就完全丢失（只有工具调用记录）。
   * Edit 工具参数含 `old_string`/`new_string`、Write 含 `content`，足以合成一条
   * `actor=ai` 的 edit（粒度为改动片段，非全文）。
   *
   * 已打开的文件仍走 textChanged（由 agent 回溯标 ai），不合成，避免重复。
   */
  synthesizeAgentEdit: boolean;
  /** core 二级编辑合并窗口（ms）：同 uri 同 actor 相邻 edit 合并 */
  editMergeWindowMs: number;
  /** 光标/阅读停留判定阈值（ms） */
  readDwellMs: number;
  /**
   * **已弃用**：滚动一度用"静默时间窗口"判定滚动结束，P1 改为**行号区间相交**判定（见 `scrollMaxHoldMs` 说明）。
   * 仅保留以兼容既有 config.json，不参与任何合并判定。
   */
  scrollMergeWindowMs: number;
  /**
   * 滚动暂存的**兜底滞留时间**（ms，默认 10 分钟）。
   *
   * 滚动合并**不看时间**：只有注意力转移（黑名单事件）才结算，区间相交则递归合并，
   * 因此不存在"停顿多久算一次滚动结束"的问题。本参数仅为极端兜底
   * （长时间既无注意力转移也无 flush 时避免数据永不落盘；正常由失焦/会话结束触发结算）。
   */
  scrollMaxHoldMs: number;
  /**
   * 光标合并的**行容忍度**（行）：同一文件内，新光标位置与上一次相差不超过该值
   * 视为同一次停留，合并并累加 dwellMs；超过则结算上一段。
   */
  cursorMergeLineThr: number;
  /**
   * 光标暂存的**兜底滞留时间**（ms，默认 10 分钟）。
   * 光标同样不看时间：行跳跃超 `cursorMergeLineThr` 或注意力转移才结算。
   */
  cursorMaxHoldMs: number;
  /** 是否保留完整 viewport 序列（P2 RTM 阅读判定可能需要，P1 默认 false） */
  scrollKeepSequence: boolean;
  /** before=null 的基线事件是否产出 Behavior（决策 D-007：false） */
  baselineEmitBehavior: boolean;
  /** agent 编辑回溯关联窗口（ms）：agentToolUse(Edit) 后该文件的 textChanged 标 ai */
  agentEditLookupMs: number;
  /** 存储缓冲 flush 阈值：条数 */
  flushMaxItems: number;
  /** 存储缓冲 flush 阈值：毫秒 */
  flushIntervalMs: number;
  /** 文件身份识别规则表（有序，命中即返回） */
  identify: { rules: IdentifyRule[] };
  /** 触发源标识（冒烟 log 比对用） */
  source: string;
}

/**
 * 默认识别规则表 —— 由 P0 `ingress/normalize.ts#roleOf` 的硬编码逻辑迁移而来（顺序保持不变，
 * 避免行为漂移）；P1 起改为配置驱动，可在 config.json 覆盖。
 */
export const DEFAULT_IDENTIFY_RULES: IdentifyRule[] = [
  { pattern: "\\.(test|spec)\\.[jt]sx?$", role: "test", note: "*.test.* / *.spec.* 测试文件" },
  { pattern: "__tests__|/tests?/", role: "test", note: "__tests__ / tests 目录" },
  { pattern: "spec|规格|需求", role: "spec", note: "规格/需求文档" },
  { pattern: "test.?plan|测试方案", role: "test-plan", note: "测试方案文档" },
  { pattern: "\\.(json|ya?ml|toml|config|env)$", role: "config", note: "配置文件" },
  {
    pattern: "\\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|css|html|vue)$",
    role: "source",
    note: "源码文件",
  },
];

export const DEFAULT_CREDIT_CONFIG: CreditConfig = {
  bridgeEditMergeMs: 400,
  editLostFocusLineThr: 10,
  editMaxHoldMs: 60_000,
  editDiffPadding: 3,
  synthesizeAgentEdit: true,
  editMergeWindowMs: 800,
  readDwellMs: 500,
  scrollMergeWindowMs: 600, // 已弃用
  scrollMaxHoldMs: 600_000,
  cursorMergeLineThr: 20,
  cursorMaxHoldMs: 600_000,
  scrollKeepSequence: false,
  baselineEmitBehavior: false,
  agentEditLookupMs: 30_000,
  flushMaxItems: 200,
  flushIntervalMs: 500,
  identify: { rules: DEFAULT_IDENTIFY_RULES },
  source: "core-ingress",
};

/** 浅合并配置（identify.rules 若提供则整体替换） */
export function mergeConfig(base: CreditConfig, override?: Partial<CreditConfig> | null): CreditConfig {
  if (!override) return { ...base };
  const merged: CreditConfig = { ...base, ...override };
  const rules = override.identify?.rules;
  merged.identify = { rules: Array.isArray(rules) && rules.length > 0 ? rules : base.identify.rules };
  return merged;
}

/**
 * 从 `<rootDir>/config.json` 加载配置并覆盖默认值。
 * 任何失败（文件缺失/JSON 坏/字段非法）一律安全降级为默认配置，不抛错（§5 桥旁路纪律）。
 */
export async function loadConfig(fs: FsPort, rootDir: string): Promise<CreditConfig> {
  try {
    const raw = await fs.readFile(joinPath(rootDir, "config.json"));
    const parsed = JSON.parse(raw) as Partial<CreditConfig>;
    return mergeConfig(DEFAULT_CREDIT_CONFIG, parsed);
  } catch {
    return { ...DEFAULT_CREDIT_CONFIG };
  }
}
