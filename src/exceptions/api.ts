import { OopzError } from "./base";

/**
 * 表示「凭据本身已失效」的状态码：命中后应触发续期/停机决策，
 * 而不是当成普通业务错误重试。
 *
 * 刻意排除 403：Oopz 用 403 表示对具体资源无权限（如向无权限频道发消息），
 * 属正常业务返回。
 */
export const AUTH_FAILURE_STATUS_CODES: ReadonlySet<number> = new Set([401, 428]);

/** Oopz 服务端返回的 API 级别错误。 */
export class OopzApiError extends OopzError {
  public statusCode: number | null;
  public response: unknown;
  public payload: unknown;

  constructor(
    message: string,
    statusCode: number | null = null,
    response: unknown = undefined,
    payload: unknown = undefined
  ) {
    super(message);
    this.name = "OopzApiError";
    this.statusCode = statusCode;
    this.response = response;
    this.payload = payload;
  }
}

/** 请求频率限制错误（HTTP 429）。 */
export class OopzRateLimitError extends OopzApiError {
  /** 建议的等待时间（毫秒）。 */
  public retryAfter: number;

  constructor(
    message: string = "HTTP 429",
    retryAfter: number = 0,
    response: unknown = undefined,
    payload: unknown = undefined
  ) {
    super(message, 429, response, payload);
    this.name = "OopzRateLimitError";
    this.retryAfter = retryAfter;
  }
}
