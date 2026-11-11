import { describe, it, expect, afterEach } from "vitest";
import * as http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { OopzConfig } from "../../src/config";
import { OopzWSClient } from "../../src/client/ws";
import { EVENT_AUTH, EVENT_AUTH_RESULT } from "../../src/config/constants";

interface Harness {
  url: string;
  sent: unknown[];
  close: () => Promise<void>;
  push: (payload: unknown) => void;
}

/** 启动一个本地 WebSocket 服务端，用于验证客户端行为。 */
async function startWsServer(
  onConnection: (ws: WebSocket, sent: unknown[]) => void
): Promise<Harness> {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const sent: unknown[] = [];
  let client: WebSocket | null = null;

  wss.on("connection", (ws) => {
    client = ws;
    ws.on("message", (data) => {
      try {
        sent.push(JSON.parse(data.toString()));
      } catch {
        sent.push(data.toString());
      }
    });
    onConnection(ws, sent);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    url: `ws://127.0.0.1:${port}`,
    sent,
    push: (payload) => {
      if (client && client.readyState === 1) client.send(JSON.stringify(payload));
    },
    close: () =>
      new Promise<void>((resolve) => {
        wss.clients.forEach((c) => c.terminate());
        wss.close(() => server.close(() => resolve()));
      }),
  };
}

function makeConfig(wsUrl: string) {
  return new OopzConfig({
    deviceId: "d",
    personUid: "p",
    jwtToken: "t",
    wsUrl,
    heartbeat: { interval: 3600, reconnectInterval: 1, maxReconnectInterval: 1 },
  });
}

describe("OopzWSClient", () => {
  const harnesses: Harness[] = [];

  afterEach(async () => {
    while (harnesses.length) {
      await harnesses.pop()!.close();
    }
  });

  it("sends the auth frame on connect", async () => {
    const harness = await startWsServer(() => undefined);
    harnesses.push(harness);

    const client = new OopzWSClient(makeConfig(harness.url));
    const started = client.start();
    await new Promise((r) => setTimeout(r, 200));

    const authFrame = harness.sent.find(
      (m: any) => m && m.event === EVENT_AUTH
    ) as any;
    expect(authFrame).toBeDefined();
    expect(JSON.parse(authFrame.body).person).toBe("p");

    await client.stop();
    await started.catch(() => undefined);
  });

  it("surfaces a failed auth check as OopzAuthError", async () => {
    const harness = await startWsServer((ws) => {
      // 服务端回应鉴权失败
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            event: EVENT_AUTH_RESULT,
            time: String(Date.now()),
            body: JSON.stringify({ checkRes: false }),
          })
        );
      }, 50);
    });
    harnesses.push(harness);

    const client = new OopzWSClient(makeConfig(harness.url));
    let caught: any = null;
    try {
      await client.start();
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeNull();
    expect(caught.name).toBe("OopzAuthError");
  });

  it("dispatches message events to handlers", async () => {
    const harness = await startWsServer(() => undefined);
    harnesses.push(harness);

    const client = new OopzWSClient(makeConfig(harness.url));
    const received: string[] = [];
    client.on("message", (event) => {
      received.push((event as any).message.content);
    });

    const started = client.start();
    await new Promise((r) => setTimeout(r, 200));

    harness.push({
      event: 9,
      time: String(Date.now()),
      body: JSON.stringify({
        data: JSON.stringify({ messageId: "m1", content: "hello", person: "u2" }),
      }),
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(received).toEqual(["hello"]);

    await client.stop();
    await started.catch(() => undefined);
  });
});
