/**
 * 各服务返回的通用操作结果。
 */
export interface OperationResult<T = unknown> {
  ok: boolean;
  message?: string;
  data?: T;
}

export function success<T>(data?: T, message?: string): OperationResult<T> {
  return { ok: true, message, data };
}

export function failure(message: string): OperationResult<never> {
  return { ok: false, message };
}

/** 通用 JSON 对象类型。 */
export type JsonObject = Record<string, unknown>;

/** 通用 JSON 数组类型。 */
export type JsonList = unknown[];
