import { OopzError } from "./base";

/** 认证 / 凭据错误。 */
export class OopzAuthError extends OopzError {
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
    this.name = "OopzAuthError";
    this.statusCode = statusCode;
    this.response = response;
    this.payload = payload;
  }
}

/** 密码登录错误。 */
export class OopzPasswordLoginError extends OopzAuthError {
  public code?: string | number;

  constructor(
    message: string,
    code: string | number | undefined = undefined,
    response: unknown = undefined,
    payload: unknown = undefined
  ) {
    super(message, typeof code === "number" ? code : null, response, payload);
    this.name = "OopzPasswordLoginError";
    this.code = code;
  }
}
