import { OopzConfig } from "../config";
import { Signer } from "../auth";
import { HttpTransport } from "../transport";
import { CacheStore } from "../state";
import {
  Message,
  Media,
  AreaService,
  Channel,
  Person,
  Moderation,
  Voice,
} from "../services";
import type { OopzBot } from "./bot";

/**
 * Oopz API 的底层 REST 客户端。
 * 管理共享的 HTTP 传输层、签名器、缓存，并挂载所有服务。
 * 通常由 OopzBot 创建和管理；仅用于纯 REST 工作流时直接使用。
 */
export class OopzRESTClient {
  public config: OopzConfig;
  public transport: HttpTransport;
  public signer: Signer;
  public cache: CacheStore;

  // 服务实例
  public messages: Message;
  public media: Media;
  public areas: AreaService;
  public channels: Channel;
  public person: Person;
  /** person 服务的别名。 */
  public members: Person;
  public moderation: Moderation;

  constructor(config: OopzConfig, bot?: OopzBot) {
    this.config = config;
    this.signer = new Signer(config);
    this.transport = new HttpTransport(config, this.signer);
    this.cache = new CacheStore(config);

    // 服务之间通过 owner 互相访问（例如 channel 服务读 area 服务的频道列表），
    // 因此 owner 统一传 REST 客户端本身。
    const owner = this;

    this.messages = new Message(owner, config, this.transport, this.signer, this.cache);
    this.media = new Media(owner, config, this.transport, this.signer, this.cache);
    this.areas = new AreaService(owner, config, this.transport, this.signer, this.cache);
    this.channels = new Channel(owner, config, this.transport, this.signer, this.cache);
    this.person = new Person(owner, config, this.transport, this.signer, this.cache);
    this.members = this.person;
    this.moderation = new Moderation(owner, config, this.transport, this.signer, this.cache);
  }

  /** 启动传输层。 */
  async start(): Promise<void> {
    await this.transport.start();
  }

  /** 关闭传输层。 */
  async close(): Promise<void> {
    await this.transport.close();
  }
}
