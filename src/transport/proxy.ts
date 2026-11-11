/**
 * 代理配置构建工具（对齐 Python SDK `build_aiohttp_proxy` / `build_websocket_proxy`）。
 *
 * Node 的 `http`/`https` 原生不支持 HTTP 代理，这里实现 CONNECT 隧道：
 * 先与代理建立 TCP 连接并发送 `CONNECT host:port`，代理回应 200 后，
 * 隧道就可以承载到目标的 TLS / 明文流量。
 */

import * as http from "node:http";
import * as net from "node:net";
import * as tls from "node:tls";
import type { ProxyConfig } from "../config";

/**
 * 按目标 URL 的 scheme 选择代理地址。
 *
 * - https/wss → `proxy.https ?? proxy.http`
 * - http/ws → `proxy.http`
 * - 其它 → undefined
 */
export function buildProxyUrl(url: string, proxy?: ProxyConfig): string | undefined {
  if (!proxy) return undefined;

  const scheme = url.slice(0, url.indexOf(":")).toLowerCase();
  if (scheme === "https" || scheme === "wss") {
    return proxy.https ?? proxy.http ?? undefined;
  }
  if (scheme === "http" || scheme === "ws") {
    return proxy.http ?? undefined;
  }
  return undefined;
}

/**
 * 解析代理地址里的认证信息，返回去掉 userinfo 的 URL 和可选的 Basic 认证头。
 */
function parseProxy(proxyUrl: string): { url: URL; authHeader?: string } {
  const url = new URL(proxyUrl);
  let authHeader: string | undefined;
  if (url.username || url.password) {
    const raw = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    authHeader = `Basic ${Buffer.from(raw, "utf-8").toString("base64")}`;
    url.username = "";
    url.password = "";
  }
  return { url, authHeader };
}

/**
 * 通过 HTTP 代理建立 CONNECT 隧道，返回可直接使用的 socket。
 *
 * 代理返回 200 之后，多余的字节会被 unshift 回 socket，
 * 以免污染后续的 TLS / 协议数据。
 */
export function createTunnelSocket(
  proxyUrl: string,
  targetHost: string,
  targetPort: number
): Promise<net.Socket> {
  const { url, authHeader } = parseProxy(proxyUrl);

  return new Promise((resolve, reject) => {
    const socket = net.connect({
      host: url.hostname,
      port: url.port ? Number(url.port) : 80,
    });

    let settled = false;
    let buffer = Buffer.alloc(0);

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    socket.once("error", fail);

    socket.once("connect", () => {
      const headers: string[] = [
        `CONNECT ${targetHost}:${targetPort} HTTP/1.1`,
        `Host: ${targetHost}:${targetPort}`,
      ];
      if (authHeader) headers.push(`Proxy-Authorization: ${authHeader}`);
      headers.push("Connection: keep-alive", "", "");
      socket.write(headers.join("\r\n"));
    });

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      const endIndex = buffer.indexOf("\r\n\r\n");
      if (endIndex === -1) {
        // 响应头还没收全
        if (buffer.length > 16 * 1024) {
          fail(new Error("代理 CONNECT 响应头过大"));
        }
        return;
      }

      const headerText = buffer.subarray(0, endIndex).toString("latin1");
      const rest = buffer.subarray(endIndex + 4);

      const statusLine = headerText.split("\r\n")[0] ?? "";
      const statusMatch = /HTTP\/1\.[01]\s+(\d+)/.exec(statusLine);
      const status = statusMatch ? Number(statusMatch[1]) : 0;

      socket.removeListener("data", onData);
      socket.removeListener("error", fail);

      if (status !== 200) {
        fail(
          new Error(
            `代理 CONNECT 失败：${statusLine || "无状态行"}（代理 ${proxyUrl}）`
          )
        );
        return;
      }

      if (rest.length > 0) {
        socket.unshift(rest);
      }

      settled = true;
      resolve(socket);
    };

    socket.on("data", onData);
  });
}

/**
 * 通过代理连接到目标，返回可用于请求的 socket。
 *
 * @param secure 目标是否为 TLS（https / wss）。
 */
export async function connectThroughProxy(
  proxyUrl: string,
  targetHost: string,
  targetPort: number,
  secure: boolean
): Promise<net.Socket> {
  const tunnel = await createTunnelSocket(proxyUrl, targetHost, targetPort);
  if (!secure) return tunnel;

  const secureSocket = tls.connect({
    socket: tunnel,
    servername: targetHost,
  });

  await new Promise<void>((resolve, reject) => {
    secureSocket.once("secureConnect", () => resolve());
    secureSocket.once("error", reject);
  });

  return secureSocket;
}

/**
 * WebSocket 使用的代理 Agent。
 *
 * Node 的 `Agent.createConnection` 允许返回 `undefined` 并在稍后通过 callback
 * 交付 socket，这里用这种方式在隧道建立完成后异步交付。
 */
export class ProxyAgent extends http.Agent {
  private proxyUrl: string;
  private targetHost: string;
  private targetPort: number;
  private secure: boolean;

  constructor(
    proxyUrl: string,
    targetHost: string,
    targetPort: number,
    secure: boolean
  ) {
    super({ keepAlive: true });
    this.proxyUrl = proxyUrl;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
    this.secure = secure;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  override createConnection(options: any, callback: any): any {
    connectThroughProxy(
      this.proxyUrl,
      this.targetHost,
      this.targetPort,
      this.secure
    )
      .then((socket) => callback(null, socket))
      .catch((err: Error) => callback(err));
    // 返回 undefined：交给 callback 异步交付 socket
    return undefined;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
