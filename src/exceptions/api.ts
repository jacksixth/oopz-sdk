import { OopzError } from "./base";

/** Oopz 服务端返回的 API 级别错误。 */
export class OopzApiError extends OopzError {
  public statusCode: number | null;
  public response: unknown;
  public payload: unknown;

  constructor(
    message: string,
    statusCode: number | null = null,
    response?: unknown,
    payload?: unknown
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
  public retryAfter: number;

  constructor(message: string = "HTTP 429", retryAfter: number = 0, ...rest: any[]) {
    super(message, 429, ...rest);
    this.name = "OopzRateLimitError";
    this.retryAfter = retryAfter;
  }
}
