import { OopzConfig } from "../config";
import { HttpTransport } from "../transport";
import { Signer } from "../auth";
import type { OopzRESTClient } from "../client/rest";

/**
 * Oopz 所有服务的基类。
 * 提供对配置、传输、签名者和所有者的共享访问。
 */
export abstract class BaseService {
  protected owner: OopzRESTClient;
  protected config: OopzConfig;
  protected transport: HttpTransport;
  protected signer: Signer;

  constructor(
    owner: OopzRESTClient,
    config: OopzConfig,
    transport: HttpTransport,
    signer: Signer
  ) {
    this.owner = owner;
    this.config = config;
    this.transport = transport;
    this.signer = signer;
  }

  /** 验证是否提供了必需参数。 */
  protected requireParam<T>(value: T | undefined | null, name: string): T {
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing required parameter: ${name}`);
    }
    return value;
  }
}
