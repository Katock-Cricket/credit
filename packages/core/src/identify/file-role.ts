/**
 * 文件身份识别器（架构 §5.2 / 算法 §2.3，P1 任务 T5）。
 *
 * 范围界定：
 * - P1 只做 **ingress 侧路径/文件名规则标注**（纯规则、零 LLM，AGENTS §5-3）；
 * - 算法 §2.3 的"计算时内容复核"第二时机属 P2 Worker 侧，P1 不实现。
 *
 * 规则表来自 config（AGENTS §9 禁止硬编码），默认规则见 `DEFAULT_IDENTIFY_RULES`。
 */
import type { ObjectRole } from "@credit/protocol";
import { DEFAULT_CREDIT_CONFIG, type IdentifyRule } from "../config.js";

/** 按规则表解析文件角色；命中即返回，全不命中返回 unknown */
export function resolveRole(
  uri: string,
  rules: IdentifyRule[] = DEFAULT_CREDIT_CONFIG.identify.rules,
): ObjectRole {
  const lower = String(uri ?? "").toLowerCase();
  if (!lower) return "unknown";
  for (const rule of rules) {
    if (!rule?.pattern || !rule?.role) continue; // 坏规则跳过，不抛错
    try {
      if (new RegExp(rule.pattern, "i").test(lower)) return rule.role;
    } catch {
      // 非法正则：跳过该规则（不中断整体识别）
      continue;
    }
  }
  return "unknown";
}

/** 规则表自检：返回非法正则的规则下标（供测试与启动日志使用） */
export function validateRules(rules: IdentifyRule[]): number[] {
  const bad: number[] = [];
  rules.forEach((r, i) => {
    try {
      new RegExp(r.pattern);
    } catch {
      bad.push(i);
    }
  });
  return bad;
}
