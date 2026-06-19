import { OopzError } from "./base";

/** 连接错误（HTTP / WebSocket）。 */
export class OopzConnectionError extends OopzError {
  constructor(message: string) {
    super(message);
    this.name = "OopzConnectionError";
  }
}

/** 传输层错误。 */
export class OopzTransportError extends OopzError {
  constructor(message: string) {
    super(message);
    this.name = "OopzTransportError";
  }
}
