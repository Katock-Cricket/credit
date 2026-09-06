/**
 * Task 人机主导权的时间分布（P2-pre，光谱下沉到后端）。
 *
 * **用途**：甘特图色块的连续渐变光谱 —— 沿时间方向，颜色深=人工主导，浅=AI 主导，
 * 反映一个 Task **内部**主导权的动态变化（而非只有一个整体占比数字）。
 *
 * **为何在后端算**：光谱是**分析产物**，按既有分层归 analyzer（前端只负责渲染）；
 * 前端不必为画图拉全量 behaviors，首屏更轻；P2 的过程类指标可直接复用 `Task.spectrum`。
 *
 * **为何存语义值（ai 占比）而非颜色/alpha**：
 * 颜色映射是表现层职责（深浅阈值可能在 UI 层调整），指标计算需要的也是"谁在主导"。
 */
import type { Behavior } from "@credit/protocol";
import type { TaskSpectrum, TaskSpectrumPoint } from "./types.js";

export interface SpectrumOptions {
  /** 最大分段数（实际取 `min(maxSegments, behaviorCount)`） */
  maxSegments?: number;
}

const DEFAULT_MAX_SEGMENTS = 10;
/** 行为数低于此值时无分布信息可言 —— 退化为单点 */
const MIN_BEHAVIORS_FOR_DISTRIBUTION = 4;

const round = (n: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/**
 * 计算 Task 内人机主导权的时间分布。
 *
 * 采样规则：
 * 1. `behaviorCount < 4` → 单点 `[{ t: 0.5, ai: 整体 aiRatio }]`（短 Task 无分布信息）；
 * 2. 否则按**时间均分** `min(maxSegments, behaviorCount)` 段，输出 **N+1 个点**
 *    （含首尾，保证渐变端点与 Task 边界对齐）；
 * 3. 每段 `ai = 段内 ai 行为数 / 段内行为数`；**空段取整体 aiRatio**，避免断点跳变。
 *
 * @param bs Task 内的行为序列（**须按 ts 升序**）
 */
export function computeTaskSpectrum(bs: Behavior[], opts: SpectrumOptions = {}): TaskSpectrum {
  if (bs.length === 0) return [];

  const maxSegments = Math.max(1, Math.floor(opts.maxSegments ?? DEFAULT_MAX_SEGMENTS));
  const startTs = bs[0]!.ts;
  const endTs = bs[bs.length - 1]!.ts;

  const aiCount = bs.filter((b) => b.actor === "ai").length;
  const overallAi = bs.length > 0 ? round(aiCount / bs.length) : 0;

  // 短 Task / 零时长：退化为单点
  if (bs.length < MIN_BEHAVIORS_FOR_DISTRIBUTION || endTs <= startTs) {
    return [{ t: 0.5, ai: overallAi }];
  }

  const segments = Math.min(maxSegments, bs.length);
  const span = endTs - startTs;

  /** 每段累计 [总行为数, ai 行为数] */
  const buckets: Array<[number, number]> = Array.from({ length: segments }, () => [0, 0]);

  for (const b of bs) {
    const ratio = (b.ts - startTs) / span;
    // 末点独占最后一格，避免 ratio===1 时越界
    const idx = Math.min(segments - 1, Math.floor(ratio * segments));
    const bucket = buckets[idx]!;
    bucket[0] += 1;
    if (b.actor === "ai") bucket[1] += 1;
  }

  const points: TaskSpectrumPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    // 输出 N+1 个点：第 i 个点取第 i 段的值；末点复用最后一段
    const bucket = buckets[Math.min(i, segments - 1)]!;
    const [total, ai] = bucket;
    const value = total > 0 ? round(ai / total) : overallAi; // 空段兜底
    points.push({ t: round(i / segments), ai: value });
  }

  return points;
}

/**
 * 整体 AI 占比（供窄色块降级：宽度不足时渐变不可见，退化为平均色）。
 * 与 `Task.metrics.aiRatio` 同义，独立导出是为了让渲染层不必再取整个 metrics。
 */
export function overallAiRatio(bs: Behavior[]): number {
  if (bs.length === 0) return 0;
  return round(bs.filter((b) => b.actor === "ai").length / bs.length);
}
