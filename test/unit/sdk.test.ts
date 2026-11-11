import { describe, it, expect } from "vitest";
import { OopzConfig } from "../../src/config";
import { Signer } from "../../src/auth/signer";
import { EventParser } from "../../src/events/parser";
import { EventDispatcher } from "../../src/events/dispatcher";
import { TTLCache } from "../../src/state/cache";
import {
  buildSegments,
  normalizeMessageParts,
  text,
  mention,
  mentionAll,
} from "../../src/models/segment";
import { coerceBool } from "../../src/utils/payload";
import { OopzApiError, OopzRateLimitError } from "../../src/exceptions";
import { TextMuteInterval, VoiceMuteInterval } from "../../src/models/moderation";
import {
  EVENT_CHAT_MESSAGE,
  EVENT_USER_ENTER_VOICE_CHANNEL,
} from "../../src/config/constants";

function makeConfig(overrides = {}) {
  return new OopzConfig({
    deviceId: "device-1",
    personUid: "person-1",
    jwtToken: "token-1",
    ...overrides,
  });
}

describe("Signer", () => {
  it("timestampUs returns Unix epoch microseconds, not a monotonic clock", () => {
    const signer = new Signer(makeConfig());
    const before = Date.now() * 1000;
    const value = Number(signer.timestampUs());
    const after = Date.now() * 1000;

    // epoch magnitude (~1.7e15), not the process-uptime magnitude (~1e11)
    expect(value).toBeGreaterThan(1_000_000_000_000_000);
    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });

  it("timestampMs returns epoch milliseconds", () => {
    const signer = new Signer(makeConfig());
    expect(Number(signer.timestampMs())).toBeCloseTo(Date.now(), -2);
  });

  it("clientMessageId has the right shape and is unique", () => {
    const signer = new Signer(makeConfig());
    const id = signer.clientMessageId();
    expect(id).toMatch(/^\d{15,16}$/);
    expect(signer.clientMessageId()).not.toBe(id);
  });

  it("bodyMd5 digests path+body", () => {
    const signer = new Signer(makeConfig());
    expect(signer.bodyMd5("/a", "b")).toHaveLength(32);
    expect(signer.bodyMd5("/a", "b")).not.toBe(signer.bodyMd5("/a", "c"));
    expect(signer.bodyMd5("/a", "b")).not.toBe(signer.bodyMd5("/c", "b"));
  });
});

describe("coerceBool", () => {
  it("treats the strings 'false' and '0' as false", () => {
    expect(coerceBool("false", false)).toBe(false);
    expect(coerceBool("0", false)).toBe(false);
    expect(coerceBool("FALSE", false)).toBe(false);
    expect(coerceBool("true", false)).toBe(true);
    expect(coerceBool("1", false)).toBe(true);
  });

  it("falls back to default for unknown literals", () => {
    expect(coerceBool("maybe", false)).toBe(false);
    expect(coerceBool("maybe", true)).toBe(true);
  });

  it("uses default for null/undefined", () => {
    expect(coerceBool(null, true)).toBe(true);
    expect(coerceBool(undefined, false)).toBe(false);
  });
});

describe("EventParser", () => {
  const parser = new EventParser(makeConfig());

  it("parses a channel message event", () => {
    const event = parser.parse({
      event: EVENT_CHAT_MESSAGE,
      time: "1700000000000",
      body: JSON.stringify({
        type: "TEXT",
        data: JSON.stringify({
          messageId: "m1",
          area: "area-1",
          channel: "ch-1",
          person: "u1",
          senderNickname: "nick",
          content: "hello",
        }),
      }),
    });

    expect(event).not.toBeNull();
    expect(event!.eventName).toBe("message");
    const messageEvent = event as any;
    expect(messageEvent.message.messageId).toBe("m1");
    expect(messageEvent.message.content).toBe("hello");
    expect(messageEvent.message.senderUid).toBe("u1");
    expect(messageEvent.message.areaId).toBe("area-1");
  });

  it("parses a voice presence event", () => {
    const event = parser.parse({
      event: EVENT_USER_ENTER_VOICE_CHANNEL,
      body: JSON.stringify({
        area: "area-1",
        channel: "ch-1",
        persons: ["u1", "u2"],
        activeNum: 2,
      }),
    });

    expect(event).not.toBeNull();
    expect(event!.eventName).toBe("voice.enter");
    const voiceEvent = event as any;
    expect(voiceEvent.persons).toEqual(["u1", "u2"]);
    expect(voiceEvent.activeNum).toBe(2);
  });

  it("returns null for an unparsable body instead of throwing", () => {
    expect(parser.parse({ event: EVENT_CHAT_MESSAGE, body: "not json" })).toBeNull();
  });
});

describe("EventDispatcher", () => {
  it("routes events by name", async () => {
    const dispatcher = new EventDispatcher(makeConfig());
    const received: string[] = [];

    dispatcher.on("message", (event) => {
      received.push((event as any).message.content);
    });

    await dispatcher.dispatch({
      event: EVENT_CHAT_MESSAGE,
      body: JSON.stringify({
        data: JSON.stringify({ messageId: "m1", content: "hi", person: "u2" }),
      }),
    });

    expect(received).toEqual(["hi"]);
  });

  it("ignores self-sent messages when ignoreSelfMessages is on", async () => {
    const dispatcher = new EventDispatcher(
      makeConfig({ ignoreSelfMessages: true })
    );
    const received: string[] = [];

    dispatcher.on("message", (event) => {
      received.push((event as any).message.content);
    });

    await dispatcher.dispatch({
      event: EVENT_CHAT_MESSAGE,
      body: JSON.stringify({
        data: JSON.stringify({
          messageId: "m1",
          content: "self",
          person: "person-1",
        }),
      }),
    });

    expect(received).toEqual([]);
  });

  it("still delivers self-sent messages when ignoreSelfMessages is off", async () => {
    const dispatcher = new EventDispatcher(
      makeConfig({ ignoreSelfMessages: false })
    );
    const received: string[] = [];

    dispatcher.on("message", (event) => {
      received.push((event as any).message.content);
    });

    await dispatcher.dispatch({
      event: EVENT_CHAT_MESSAGE,
      body: JSON.stringify({
        data: JSON.stringify({
          messageId: "m1",
          content: "self",
          person: "person-1",
        }),
      }),
    });

    expect(received).toEqual(["self"]);
  });
});

describe("segments", () => {
  it("concatenates text segments", () => {
    const built = buildSegments(normalizeMessageParts(["a", text("b")]));
    expect(built.text).toBe("ab");
    expect(built.attachments).toHaveLength(0);
  });

  it("renders mentions using the protocol (met) format", () => {
    const built = buildSegments([mention("u1")]);
    expect(built.text).toContain("(met)u1(met)");
  });

  it("renders mention-all using the All marker", () => {
    const built = buildSegments([mentionAll()]);
    expect(built.text).toContain("(met)All(met)");
  });
});

describe("TTLCache", () => {
  it("deleteWhere keeps the LRU order of untouched entries", () => {
    const cache = new TTLCache<string>(3, 60);
    cache.set("a", "A");
    cache.set("b", "B");
    cache.set("c", "C");
    // touch "a" so it becomes the most recently used
    cache.get("a");

    cache.deleteWhere((key) => key === "b");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("A");
    expect(cache.get("c")).toBe("C");
  });

  it("evicts the least recently used entry when over capacity", () => {
    const cache = new TTLCache<string>(2, 60);
    cache.set("a", "A");
    cache.set("b", "B");
    cache.get("a");
    cache.set("c", "C");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("A");
  });
});

describe("exceptions", () => {
  it("OopzApiError keeps response and payload in the right slots", () => {
    const err = new OopzApiError(
      "boom",
      500,
      { http: "resp" },
      { json: "payload" }
    );
    expect(err.statusCode).toBe(500);
    expect(err.response).toEqual({ http: "resp" });
    expect(err.payload).toEqual({ json: "payload" });
  });

  it("OopzRateLimitError extends OopzApiError and carries the retry delay", () => {
    const err = new OopzRateLimitError("rate", 1500);
    expect(err).toBeInstanceOf(OopzApiError);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(1500);
  });
});

describe("mute interval enums", () => {
  it("TextMuteInterval.pick selects a bucket by seconds", () => {
    // bucket bounds in minutes: 1 / 5 / 60 / 1440 / 4320 / 10080
    expect(TextMuteInterval.pick(30)).toBe(TextMuteInterval.S60);
    expect(TextMuteInterval.pick(120)).toBe(TextMuteInterval.M5);
    expect(TextMuteInterval.pick(3600)).toBe(TextMuteInterval.H1);
    expect(TextMuteInterval.pick(86400)).toBe(TextMuteInterval.D1);
    expect(TextMuteInterval.pick(259200)).toBe(TextMuteInterval.D3);
    expect(TextMuteInterval.pick(604800)).toBe(TextMuteInterval.D7);
    // beyond the largest bucket falls back to the last one
    expect(TextMuteInterval.pick(999999999)).toBe(TextMuteInterval.D7);
  });

  it("VoiceMuteInterval.pick does not collide with the text buckets", () => {
    expect(VoiceMuteInterval.pick(120)).toBe(VoiceMuteInterval.M5);
    expect(VoiceMuteInterval.pick(120)).not.toBe(TextMuteInterval.M5);
  });
});

describe("OopzConfig", () => {
  it("requestTimeout and request.timeout are the same value", () => {
    const config = makeConfig({ requestTimeout: [1000, 2000] });
    expect(config.request.timeout).toEqual([1000, 2000]);
    expect(config.requestTimeout).toEqual([1000, 2000]);
  });

  it("rateLimitInterval and rateLimit.interval are the same value", () => {
    const config = makeConfig({ rateLimitInterval: 0.5 });
    expect(config.rateLimit.interval).toBe(0.5);
    expect(config.rateLimitInterval).toBe(0.5);
  });

  it("ensureCredentials throws when credentials are missing", () => {
    expect(() => new OopzConfig().ensureCredentials()).toThrow();
  });
});
