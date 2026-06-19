import { OopzError } from "./base";

/** 数据解析 / 校验错误。 */
export class OopzParseError extends OopzError {
  constructor(message: string) {
    super(message);
    this.name = "OopzParseError";
  }
}
