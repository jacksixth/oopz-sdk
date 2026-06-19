/**
 * 代理配置构建工具（对齐 Python SDK `build_aiohttp_proxy`）。
 */

import type { ProxyConfig } from "../config";

/** 为给定的 URL 构建代理 URL。 */
export function buildProxyUrl(url: string, proxy?: ProxyConfig): string | undefined {
  if (!proxy) return undefined;

  if (url.startsWith("wss://") || url.startsWith("ws://")) {
    return proxy.websocket ?? undefined;
  }

  if (url.startsWith("https://")) {
    return proxy.https ?? proxy.http ?? undefined;
  }

  return proxy.http ?? undefined;
}
