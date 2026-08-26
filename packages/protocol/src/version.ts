/**
 * 协议版本与迁移映射（架构 §5.1）。
 * jsonl 每行携带 `v` 字段；新增联合类型成员即向后兼容；
 * 删除/改名字段一律升 major 并在此登记映射。
 */

/** 当前协议版本 */
export const PROTOCOL_VERSION = "0.2" as const;

/** 采集层次：frontend 现网；rust 下沉后自动升级 */
export type Fidelity = "frontend" | "rust";

/**
 * 版本迁移映射表：major 变更时登记 old→new 字段重命名/缺省补全规则。
 * P0 当前无 major 变更，表为空占位，禁止静默改删字段。
 */
export interface VersionMigration {
  from: string;
  to: string;
  /** 字段重命名：旧字段名 → 新字段名 */
  rename?: Record<string, string>;
  /** 缺省补全：新字段名 → 默认值 */
  fill?: Record<string, unknown>;
}

export const MIGRATIONS: VersionMigration[] = [];

/** 按 `v` 字段将旧事件归一化到当前版本（P0 直通，无迁移） */
export function normalizeToCurrent<T>(raw: T & { v?: string }): T & { v: string } {
  const v = raw.v ?? PROTOCOL_VERSION;
  // 未来 major 变更在此分支处理 MIGRATIONS
  return { ...raw, v };
}
