import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";

// Mirror of the identifier hashing in src/lib/rate-limit.ts — identifiers are
// hashed before they become Upstash keys so PII never lands in Redis.
function hashId(id: string): string {
  const secret = process.env.AUDIT_IP_HASH_SECRET ?? "";
  return createHash("sha256").update(`${id}:${secret}`).digest("hex").slice(0, 32);
}

describe("limitMagicLink — no Upstash configured", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it("returns ok when KV is not configured (local dev safe)", async () => {
    const { limitMagicLink } = await import("@/lib/rate-limit");
    const result = await limitMagicLink("test@byui.edu", "1.2.3.4");
    expect(result.ok).toBe(true);
  });

  it("returns ok even with null IP", async () => {
    const { limitMagicLink } = await import("@/lib/rate-limit");
    const result = await limitMagicLink("test@byui.edu", null);
    expect(result.ok).toBe(true);
  });

  it("returns ok when only URL is set but not token", async () => {
    process.env.KV_REST_API_URL = "https://example.com";
    const { limitMagicLink } = await import("@/lib/rate-limit");
    const result = await limitMagicLink("a@byui.edu", "1.2.3.4");
    expect(result.ok).toBe(true);
  });

  it("returns ok when only token is set but not URL", async () => {
    process.env.KV_REST_API_TOKEN = "tok";
    const { limitMagicLink } = await import("@/lib/rate-limit");
    const result = await limitMagicLink("a@byui.edu", "1.2.3.4");
    expect(result.ok).toBe(true);
  });
});

describe("limitMagicLink — Upstash configured (mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "test-token";
    delete process.env.AUDIT_IP_HASH_SECRET;
  });

  it("returns 'email' reason when email limit is hit first", async () => {
    const emailKey = hashId("test@byui.edu");
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        constructor() {}
        async limit(key: string) {
          // Identifiers arrive hashed — match on the email's digest.
          if (key === emailKey) return { success: false, reset: 12345 };
          return { success: true, reset: 0 };
        }
        static slidingWindow() {
          return {};
        }
      },
    }));
    vi.doMock("@upstash/redis", () => ({ Redis: class {} }));

    const { limitMagicLink } = await import("@/lib/rate-limit");
    const result = await limitMagicLink("test@byui.edu", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("email");
    expect(result.resetAt).toBe(12345);
  });

  it("returns 'ip' reason when ip limit is hit and email is fine", async () => {
    const ipKey = hashId("1.1.1.1");
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        constructor() {}
        async limit(key: string) {
          if (key === ipKey) return { success: false, reset: 67890 };
          return { success: true, reset: 0 };
        }
        static slidingWindow() {
          return {};
        }
      },
    }));
    vi.doMock("@upstash/redis", () => ({ Redis: class {} }));

    const { limitMagicLink } = await import("@/lib/rate-limit");
    const result = await limitMagicLink("a@byui.edu", "1.1.1.1");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("ip");
    expect(result.resetAt).toBe(67890);
  });

  it("returns ok when both limits pass", async () => {
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        constructor() {}
        async limit() {
          return { success: true, reset: 0 };
        }
        static slidingWindow() {
          return {};
        }
      },
    }));
    vi.doMock("@upstash/redis", () => ({ Redis: class {} }));

    const { limitMagicLink } = await import("@/lib/rate-limit");
    const result = await limitMagicLink("ok@byui.edu", "2.2.2.2");
    expect(result.ok).toBe(true);
  });

  it("falls back to (hashed) 'unknown' when IP is null", async () => {
    const emailKey = hashId("ok@byui.edu");
    let observedIpKey = "";
    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        constructor() {}
        async limit(key: string) {
          if (key !== emailKey) observedIpKey = key;
          return { success: true, reset: 0 };
        }
        static slidingWindow() {
          return {};
        }
      },
    }));
    vi.doMock("@upstash/redis", () => ({ Redis: class {} }));

    const { limitMagicLink } = await import("@/lib/rate-limit");
    await limitMagicLink("ok@byui.edu", null);
    expect(observedIpKey).toBe(hashId("unknown"));
  });
});
