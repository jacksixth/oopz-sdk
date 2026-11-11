import { describe, it, expect, afterAll } from "vitest";
import * as http from "node:http";
import { OopzConfig } from "../../src/config";
import { Signer } from "../../src/auth/signer";
import { HttpTransport } from "../../src/transport/http";
import { OopzApiError, OopzAuthError, OopzRateLimitError } from "../../src/exceptions";

/** 启动一个本地假服务器，用来验证传输层行为。 */
function startServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

function makeTransport(baseUrl: string, overrides = {}) {
  const config = new OopzConfig({
    deviceId: "d",
    personUid: "p",
    jwtToken: "t",
    baseUrl,
    retry: { maxAttempts: 1 },
    ...overrides,
  });
  const signer = new Signer(config);
  return new HttpTransport(config, signer);
}

describe("HttpTransport", () => {
  const servers: (() => Promise<void>)[] = [];

  afterAll(async () => {
    for (const close of servers) await close();
  });

  async function serve(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ) {
    const s = await startServer(handler);
    servers.push(s.close);
    return s;
  }

  it("sends signed headers", async () => {
    let receivedHeaders: http.IncomingHttpHeaders = {};
    const server = await serve((req, res) => {
      receivedHeaders = req.headers;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: true, data: { ok: 1 } }));
    });

    const transport = makeTransport(server.url);
    const data = await transport.requestData("GET", "/api/x");
    expect(data).toEqual({ ok: 1 });
    expect(receivedHeaders["oopz-sign"]).toBeDefined();
    expect(receivedHeaders["oopz-time"]).toBeDefined();
    expect(receivedHeaders["oopz-device-id"]).toBe("d");
    expect(receivedHeaders["oopz-person"]).toBe("p");
  });

  it("throws OopzApiError when status is false", async () => {
    const server = await serve((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: false, message: "biz failed" }));
    });

    const transport = makeTransport(server.url);
    await expect(transport.requestJson("GET", "/api/x")).rejects.toThrow(
      "biz failed"
    );
  });

  it("treats the string 'false' as a failure", async () => {
    const server = await serve((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "false" }));
    });

    const transport = makeTransport(server.url);
    await expect(transport.requestJson("GET", "/api/x")).rejects.toThrow(
      OopzApiError
    );
  });

  it("raises OopzAuthError on 401 instead of swallowing it", async () => {
    const server = await serve((req, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "bad creds" }));
    });

    const transport = makeTransport(server.url);
    await expect(transport.requestJson("GET", "/api/x")).rejects.toThrow(
      OopzAuthError
    );
  });

  it("raises OopzRateLimitError on 429 and preserves the type", async () => {
    const server = await serve((req, res) => {
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": "2",
      });
      res.end(JSON.stringify({ message: "too many" }));
    });

    const transport = makeTransport(server.url);
    const err = await transport
      .requestJson("GET", "/api/x")
      .then(() => null)
      .catch((e) => e);

    expect(err).toBeInstanceOf(OopzRateLimitError);
    expect(err.retryAfter).toBe(2000);
  });

  it("requestDataWithRetry retries when retryOn429 is enabled", async () => {
    let hits = 0;
    const server = await serve((req, res) => {
      hits++;
      if (hits < 3) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": "0",
        });
        res.end(JSON.stringify({ message: "slow down" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: true, data: { ok: true } }));
    });

    const transport = makeTransport(server.url);
    const data = await transport.requestDataWithRetry("GET", "/api/x", {
      retryOn429: true,
      maxAttempts: 5,
    });

    expect(data).toEqual({ ok: true });
    expect(hits).toBe(3);
  });

  it("requestDataWithRetry does not retry when retryOn429 is off", async () => {
    let hits = 0;
    const server = await serve((req, res) => {
      hits++;
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": "0",
      });
      res.end(JSON.stringify({ message: "slow down" }));
    });

    const transport = makeTransport(server.url);
    await expect(
      transport.requestDataWithRetry("GET", "/api/x", { maxAttempts: 5 })
    ).rejects.toThrow(OopzRateLimitError);
    expect(hits).toBe(1);
  });

  it("raises OopzApiError for non-2xx responses", async () => {
    const server = await serve((req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "server error" }));
    });

    const transport = makeTransport(server.url);
    await expect(transport.requestJson("GET", "/api/x")).rejects.toThrow(
      OopzApiError
    );
  });

  it("decompresses gzip responses", async () => {
    const zlib = await import("node:zlib");
    const payload = JSON.stringify({ status: true, data: { ok: "gz" } });
    const server = await serve((req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      });
      res.end(zlib.gzipSync(payload));
    });

    const transport = makeTransport(server.url);
    const data = await transport.requestData("GET", "/api/x");
    expect(data).toEqual({ ok: "gz" });
  });
});
