import { OopzConfig } from "../config";
import { Signer } from "../auth";
import { HttpTransport } from "../transport";
import {
  Message,
  Media,
  AreaService,
  Channel,
  Person,
  Moderation,
} from "../services";

/**
 * Oopz API 的底层 REST 客户端。
 * 管理共享的 HTTP 传输层、签名器，并挂载所有服务。
 * 通常由 OopzBot 创建和管理；仅用于纯 REST 工作流时直接使用。
 */
export class OopzRESTClient {
  public config: OopzConfig;
  public transport: HttpTransport;
  public signer: Signer;

  // 服务实例
  public messages: Message;
  public media: Media;
  public areas: AreaService;
  public channels: Channel;
  public person: Person;
  /** person 服务的别名。 */
  public members: Person;
  public moderation: Moderation;

  constructor(config: OopzConfig, bot?: unknown) {
    this.config = config;
    this.signer = new Signer(config);
    this.transport = new HttpTransport(config, this.signer);

    const owner = (bot as OopzRESTClient) ?? this;

    this.messages = new Message(owner, config, this.transport, this.signer);
    this.media = new Media(owner, config, this.transport, this.signer);
    this.areas = new AreaService(owner, config, this.transport, this.signer);
    this.channels = new Channel(owner, config, this.transport, this.signer);
    this.person = new Person(owner, config, this.transport, this.signer);
    this.members = this.person;
    this.moderation = new Moderation(owner, config, this.transport, this.signer);
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
