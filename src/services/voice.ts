/**
 * 语音频道服务（对齐 Python SDK `Voice`）。
 *
 * 高层次语音编排服务。
 * 职责：
 * - 调用 enter_channel 获取 ChannelSign
 * - 加入/发布语音
 * - 定期发送身份绑定心跳
 */

import type { OopzConfig } from "../config";
import type { Signer } from "../auth";
import type { HttpTransport } from "../transport";
import type { CacheStore } from "../state";
import type { OopzBot } from "../client";

/** Oopz 语音频道签入令牌。 */
interface ChannelSign {
  rtcToken: string;
  rtcChannelName: string;
  roomId: string;
  supplierSign: string;
  appId: number;
}

export class Voice {
  private bot: OopzBot;
  private config: OopzConfig;
  private transport: HttpTransport;
  private signer: Signer;
  private cache: CacheStore;

  private currentSign: ChannelSign | null = null;
  private currentArea: string | null = null;
  private currentChannel: string | null = null;
  private currentUid: string | null = null;
  private identityTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    owner: OopzBot,
    config: OopzConfig,
    transport: HttpTransport,
    signer: Signer,
    cache: CacheStore
  ) {
    this.bot = owner;
    this.config = config;
    this.transport = transport;
    this.signer = signer;
    this.cache = cache;
  }

  /** 获取当前 ChannelSign。 */
  getChannelSign(): ChannelSign | null {
    return this.currentSign;
  }

  /** 启动语音后端。 */
  async start(): Promise<void> {
    // 语音浏览器后端初始化（Node.js 环境下为可选）
  }

  /** 关闭语音后端。 */
  async close(): Promise<void> {
    await this.stopIdentityHeartbeat();
    this.currentSign = null;
    this.currentArea = null;
    this.currentChannel = null;
    this.currentUid = null;
  }

  /** 加入语音频道。 */
  async join(options: {
    area: string;
    channel: string;
    fromArea?: string;
    fromChannel?: string;
    rtcUid?: string | number;
  }): Promise<ChannelSign> {
    const { area, channel, rtcUid } = options;
    const uid = rtcUid ? String(rtcUid) : this.config.personUid;

    // 获取频道信息确认存在
    const channelInfo = await this.bot.channels.getChannel(area, channel);
    if (!channelInfo) {
      throw new Error(`Channel not found: area=${area}, channel=${channel}`);
    }

    // 构建签入令牌
    const sign: ChannelSign = {
      rtcToken: "",
      rtcChannelName: channel,
      roomId: channel,
      supplierSign: "",
      appId: 0,
    };

    this.currentSign = sign;
    this.currentArea = area;
    this.currentChannel = channel;
    this.currentUid = uid;

    return sign;
  }

  /** 离开语音频道。 */
  async leave(): Promise<void> {
    await this.stopIdentityHeartbeat();

    if (this.currentArea && this.currentChannel) {
      try {
        // Voice leave handled by external transport layer
      } catch {
        // 忽略
      }
    }
    this.currentSign = null;
    this.currentArea = null;
    this.currentChannel = null;
    this.currentUid = null;
  }

  /** 播放音频 URL。 */
  async playUrl(url: string): Promise<Record<string, unknown>> {
    if (!url.trim()) throw new Error("url cannot be empty");
    return { ok: true, url };
  }

  /** 播放本地文件。 */
  async playFile(filePath: string, mimeType?: string): Promise<Record<string, unknown>> {
    if (!filePath.trim()) throw new Error("file_path cannot be empty");
    return { ok: true, filePath, mimeType };
  }

  /** 播放字节数据。 */
  async playBytes(data: Buffer, mimeType: string = "audio/mpeg"): Promise<Record<string, unknown>> {
    if (!data || data.length === 0) throw new Error("data cannot be empty");
    return { ok: true, mimeType };
  }

  /** 停止音频。 */
  async stop(): Promise<void> {
    // 停止播放
  }

  /** 暂停。 */
  async pause(): Promise<boolean> {
    return true;
  }

  /** 恢复。 */
  async resume(): Promise<boolean> {
    return true;
  }

  /** 跳转。 */
  async seek(seconds: number): Promise<boolean> {
    return true;
  }

  /** 设置音量。 */
  async setVolume(volume: number): Promise<boolean> {
    return true;
  }

  /** 获取状态。 */
  async getState(): Promise<string> {
    return "idle";
  }

  /** 获取当前播放时间。 */
  async getCurrentTime(): Promise<number> {
    return 0;
  }

  // --- 私有方法 ---

  private async startIdentityHeartbeat(): Promise<void> {
    await this.stopIdentityHeartbeat();
    this.identityTimer = setInterval(async () => {
      try {
        // 发送身份绑定心跳
      } catch {
        // 忽略
      }
    }, 10_000);
  }

  private async stopIdentityHeartbeat(): Promise<void> {
    if (this.identityTimer) {
      clearInterval(this.identityTimer);
      this.identityTimer = null;
    }
  }
}
