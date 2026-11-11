/**
 * 语音频道服务（对齐 Python SDK `Voice`）。
 *
 * 职责：
 * - 调用 `enter_channel` 获取 `ChannelSign`
 * - 维护当前所在的语音频道状态
 * - 退出语音频道
 *
 * 注意：Oopz 的语音播放依赖 Agora 浏览器运行时（Python SDK 用 headless 浏览器实现），
 * Node.js 环境下没有等价实现，因此播放相关方法会明确抛出「不支持」错误，
 * 而不是返回一个假的成功结果。
 */

import type { OopzConfig } from "../config";
import type { Signer } from "../auth";
import type { HttpTransport } from "../transport";
import type { CacheStore } from "../state";
import type { ChannelSign } from "../models";
import type { OopzBot } from "../client";

/** 语音播放等能力在 Node.js 下不可用时抛出的错误。 */
export class OopzVoiceUnsupportedError extends Error {
  constructor(operation: string) {
    super(
      `语音操作 "${operation}" 在 Node.js 环境下不受支持：` +
        `Oopz 的语音播放依赖 Agora 浏览器运行时（Python SDK 通过 headless 浏览器实现）。` +
        `如需播放语音，请使用 Python SDK 或自行接入 Agora SDK。`
    );
    this.name = "OopzVoiceUnsupportedError";
  }
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

  /** 当前所在的区域 ID。 */
  getCurrentArea(): string | null {
    return this.currentArea;
  }

  /** 当前所在的频道 ID。 */
  getCurrentChannel(): string | null {
    return this.currentChannel;
  }

  /** 启动语音后端（Node.js 下为无操作）。 */
  async start(): Promise<void> {
    // 浏览器后端在 Node.js 下不存在
  }

  /** 关闭语音后端。 */
  async close(): Promise<void> {
    this.currentSign = null;
    this.currentArea = null;
    this.currentChannel = null;
    this.currentUid = null;
  }

  /**
   * 加入语音频道。
   *
   * 调用服务端 `enter_channel` 换取 ChannelSign，并记录当前所在频道。
   */
  async join(options: {
    area: string;
    channel: string;
    fromArea?: string;
    fromChannel?: string;
    rtcUid?: string | number;
  }): Promise<ChannelSign> {
    const { area, channel, fromArea, fromChannel } = options;
    const uid = options.rtcUid ? String(options.rtcUid) : this.config.personUid;

    // 进入语音频道（服务端返回 ChannelSign）
    const sign = await this.bot.channels.enterChannel(
      area,
      channel,
      "VOICE",
      { fromArea, fromChannel, pid: uid }
    );

    if (!sign.rtcToken || !sign.rtcChannelName) {
      throw new Error("enter_channel returned no supplierSign/roomId");
    }

    this.currentSign = sign;
    this.currentArea = area;
    this.currentChannel = channel;
    this.currentUid = uid;

    return sign;
  }

  /**
   * 离开语音频道。
   */
  async leave(): Promise<void> {
    const area = this.currentArea;
    const channel = this.currentChannel;

    this.currentSign = null;
    this.currentArea = null;
    this.currentChannel = null;
    this.currentUid = null;

    if (area && channel) {
      await this.bot.channels.leaveVoiceChannel(area, channel, this.config.personUid);
    }
  }

  /** 播放音频 URL（Node.js 下不支持）。 */
  async playUrl(_url: string): Promise<Record<string, unknown>> {
    throw new OopzVoiceUnsupportedError("playUrl");
  }

  /** 播放本地文件（Node.js 下不支持）。 */
  async playFile(_filePath: string, _mimeType?: string): Promise<Record<string, unknown>> {
    throw new OopzVoiceUnsupportedError("playFile");
  }

  /** 播放字节数据（Node.js 下不支持）。 */
  async playBytes(_data: Buffer, _mimeType: string = "audio/mpeg"): Promise<Record<string, unknown>> {
    throw new OopzVoiceUnsupportedError("playBytes");
  }

  /** 停止音频（Node.js 下不支持）。 */
  async stop(): Promise<void> {
    throw new OopzVoiceUnsupportedError("stop");
  }

  /** 暂停（Node.js 下不支持）。 */
  async pause(): Promise<boolean> {
    throw new OopzVoiceUnsupportedError("pause");
  }

  /** 恢复（Node.js 下不支持）。 */
  async resume(): Promise<boolean> {
    throw new OopzVoiceUnsupportedError("resume");
  }

  /** 跳转（Node.js 下不支持）。 */
  async seek(_seconds: number): Promise<boolean> {
    throw new OopzVoiceUnsupportedError("seek");
  }

  /** 设置音量（Node.js 下不支持）。 */
  async setVolume(_volume: number): Promise<boolean> {
    throw new OopzVoiceUnsupportedError("setVolume");
  }

  /** 获取播放状态（Node.js 下不支持）。 */
  async getState(): Promise<string> {
    throw new OopzVoiceUnsupportedError("getState");
  }

  /** 获取当前播放时间（Node.js 下不支持）。 */
  async getCurrentTime(): Promise<number> {
    throw new OopzVoiceUnsupportedError("getCurrentTime");
  }
}
