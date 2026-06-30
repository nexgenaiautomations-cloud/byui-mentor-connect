import { describe, it, expect, beforeEach, vi } from "vitest";

// We mock the db module so the audit helper's insert path can be observed
// without touching Postgres. The mock has to be installed before importing
// the module under test; vi.mock is hoisted to the top of the file so this
// works even though it sits below the describe block.
vi.mock("@/db/client", () => {
  const insertValues = vi.fn();
  const insert = vi.fn(() => ({ values: insertValues }));
  return {
    db: { insert },
    // Surface the spies for the tests below.
    __spies: { insert, insertValues },
  };
});

import { auditEvent, hashIp, sanitizeMetadata, extractIp } from "@/lib/audit";
import * as dbModule from "@/db/client";

// Tighten the type for the test helpers we attached above.
type SpyBag = {
  __spies: { insert: ReturnType<typeof vi.fn>; insertValues: ReturnType<typeof vi.fn> };
};
const spies = (dbModule as unknown as SpyBag).__spies;

describe("hashIp", () => {
  beforeEach(() => {
    delete process.env.AUDIT_IP_HASH_SECRET;
  });

  it("returns null for null/empty input", () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp(undefined)).toBeNull();
    expect(hashIp("")).toBeNull();
  });

  it("returns a hex digest for any non-empty ip", () => {
    const out = hashIp("1.2.3.4");
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes when the salt changes", () => {
    const noSalt = hashIp("1.2.3.4");
    process.env.AUDIT_IP_HASH_SECRET = "secret-1";
    const salted = hashIp("1.2.3.4");
    expect(salted).not.toEqual(noSalt);
  });

  it("never stores the raw ip (output bears no resemblance)", () => {
    const out = hashIp("203.0.113.42");
    expect(out).not.toContain("203");
    expect(out).not.toContain("113");
  });
});

describe("extractIp", () => {
  it("returns null when no request is provided", () => {
    expect(extractIp(undefined)).toBeNull();
  });

  it("reads x-forwarded-for and picks the first hop", () => {
    const h = new Headers({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
    expect(extractIp({ headers: h })).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "10.0.0.9" });
    expect(extractIp({ headers: h })).toBe("10.0.0.9");
  });

  it("returns null when neither header is set", () => {
    expect(extractIp({ headers: new Headers() })).toBeNull();
  });
});

describe("sanitizeMetadata", () => {
  it("redacts keys that look like secrets", () => {
    const out = sanitizeMetadata({
      userId: "u1",
      password: "hunter2",
      passwordHash: "scrypt$...",
      resetToken: "abc",
      session_jwt: "ey...",
      cookieValue: "x",
      authorization: "Bearer ...",
    });
    expect(out.userId).toBe("u1");
    expect(out.password).toBe("[redacted]");
    expect(out.passwordHash).toBe("[redacted]");
    expect(out.resetToken).toBe("[redacted]");
    expect(out.session_jwt).toBe("[redacted]");
    expect(out.cookieValue).toBe("[redacted]");
    expect(out.authorization).toBe("[redacted]");
  });

  it("preserves arrays as-is (arrays of ids are common and safe)", () => {
    const ids = ["a", "b", "c"];
    const out = sanitizeMetadata({ userIds: ids });
    expect(out.userIds).toEqual(ids);
  });

  it("recurses into nested objects", () => {
    const out = sanitizeMetadata({
      nested: { password: "p", id: "ok" },
    });
    expect((out.nested as Record<string, unknown>).password).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).id).toBe("ok");
  });

  it("returns {} for undefined input", () => {
    expect(sanitizeMetadata(undefined)).toEqual({});
  });

  it("does not mutate the original object", () => {
    const orig = { password: "hunter2" };
    sanitizeMetadata(orig);
    expect(orig.password).toBe("hunter2");
  });
});

describe("auditEvent", () => {
  beforeEach(() => {
    spies.insert.mockReset();
    spies.insertValues.mockReset();
    spies.insert.mockReturnValue({ values: spies.insertValues });
    spies.insertValues.mockResolvedValue(undefined);
    delete process.env.AUDIT_IP_HASH_SECRET;
  });

  it("inserts an event with hashed IP and UA from the request", async () => {
    const req = {
      headers: new Headers({
        "x-forwarded-for": "9.9.9.9",
        "user-agent": "Mozilla/5.0",
      }),
    };
    const ok = await auditEvent({
      actorUserId: "actor-1",
      eventType: "LOGIN_SUCCEEDED",
      severity: "info",
      request: req,
      metadata: { email: "a@byui.edu" },
    });
    expect(ok).toBe(true);
    expect(spies.insertValues).toHaveBeenCalledOnce();
    const payload = spies.insertValues.mock.calls[0][0];
    expect(payload.actorUserId).toBe("actor-1");
    expect(payload.eventType).toBe("LOGIN_SUCCEEDED");
    expect(payload.severity).toBe("info");
    expect(payload.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.userAgent).toBe("Mozilla/5.0");
    // Raw IP never surfaces in the stored row.
    expect(JSON.stringify(payload)).not.toContain("9.9.9.9");
  });

  it("never stores the raw IP under any column", async () => {
    await auditEvent({
      eventType: "LOGIN_FAILED",
      request: { headers: new Headers({ "x-forwarded-for": "203.0.113.7" }) },
    });
    const payload = spies.insertValues.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toContain("203.0.113.7");
  });

  it("returns false (does not throw) when the DB insert fails", async () => {
    spies.insertValues.mockRejectedValueOnce(new Error("connection refused"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ok = await auditEvent({ eventType: "USER_SIGNUP_CREATED" });
    expect(ok).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("defaults severity to 'info' when omitted", async () => {
    await auditEvent({ eventType: "USER_SIGNUP_CREATED" });
    expect(spies.insertValues.mock.calls[0][0].severity).toBe("info");
  });

  it("stores metadata as JSON with secrets redacted", async () => {
    await auditEvent({
      eventType: "PASSWORD_RESET_COMPLETED",
      metadata: { userId: "u1", token: "this-should-be-redacted" },
    });
    const payload = spies.insertValues.mock.calls[0][0];
    const meta = JSON.parse(payload.metadataJson);
    expect(meta.userId).toBe("u1");
    expect(meta.token).toBe("[redacted]");
  });

  it("works without a request (server-internal events)", async () => {
    await auditEvent({
      eventType: "ADMIN_CLEANED_USER_DATA",
      actorUserId: "script",
    });
    const payload = spies.insertValues.mock.calls[0][0];
    expect(payload.ipHash).toBeNull();
    expect(payload.userAgent).toBeNull();
  });

  it("truncates oversized metadata", async () => {
    const huge = "x".repeat(20_000);
    await auditEvent({
      eventType: "CSP_VIOLATION_REPORTED",
      metadata: { blob: huge },
    });
    const payload = spies.insertValues.mock.calls[0][0];
    expect(payload.metadataJson.length).toBeLessThan(9_000);
  });

  it("truncation envelope is still valid JSON (re-parseable)", async () => {
    const huge = "x".repeat(20_000);
    await auditEvent({
      eventType: "CSP_VIOLATION_REPORTED",
      metadata: { blob: huge, marker: "before" },
    });
    const payload = spies.insertValues.mock.calls[0][0];
    // The whole point of the new envelope: don't poison downstream consumers
    // with malformed JSON when payloads are truncated.
    const parsed = JSON.parse(payload.metadataJson);
    expect(parsed._truncated).toBe(true);
    expect(typeof parsed._original_length).toBe("number");
    expect(typeof parsed._head).toBe("string");
  });
});
