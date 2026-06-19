/** Oopz SDK 所有错误的基类。 */
export class OopzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OopzError";
  }
}
