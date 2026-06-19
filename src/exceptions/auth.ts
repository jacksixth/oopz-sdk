import { OopzError } from "./base";

/** 认证 / 凭据错误。 */
export class OopzAuthError extends OopzError {
  constructor(message: string) {
    super(message);
    this.name = "OopzAuthError";
  }
}

/** 密码登录错误。 */
export class OopzPasswordLoginError extends OopzError {
  constructor(message: string) {
    super(message);
    this.name = "OopzPasswordLoginError";
  }
}
