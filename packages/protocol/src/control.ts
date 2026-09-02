/**
 * 控制通道类型（架构 §5.5 / ADR-8）。
 * credit.control.* 前端路由与文件信号兜底共用本请求/响应类型。
 */
import type { PrSession } from "./session.js";

export type ControlMethod =
  | "credit.control.start"
  | "credit.control.end"
  | "credit.control.finish"
  | "credit.control.getStatus"
  | "credit.control.reset";

export interface ControlRequest {
  method: ControlMethod;
  /** 请求载荷 */
  prId?: string;
  payload?: unknown;
  /** 请求标识（用于响应关联） */
  reqId: string;
}

export type ControlResponse =
  | { ok: true; reqId: string; session?: PrSession; status?: unknown }
  | { ok: false; reqId: string; error: string };

/** 文件信号兜底：MiniApp 写 session.json 控制字段，桥 fs.watch 监听 */
export interface FileSignal {
  method: ControlMethod;
  prId?: string;
  at: number; // 写入时间戳
}
