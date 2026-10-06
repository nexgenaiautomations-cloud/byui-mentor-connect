import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The pseudonymization salt. Loaded via dynamic import in the warning tests
// because the "warn once" behaviour is module-level state.
import {
  MIN_HASH_SECRET_LENGTH,
  getHashSecret,
  isHashSecretConfigured,
} from "@/lib/hash-secret";

const STRONG = "x".repeat(MIN_HASH_SECRET_LENGTH);

describe("isHashSecretConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when the secret is unset", () => {
    vi.stubEnv("AUDIT_IP_HASH_SECRET", "");
    expect(isHashSecretConfigured()).toBe(false);
  });

  it("is false for a secret shorter than the floor", () => {
    vi.stubEnv("AUDIT_IP_HASH_SECRET", "tooshort");
    expect(isHashSecretConfigured()).toBe(false);
  });

  it("is false for whitespace", () => {
    vi.stubEnv("AUDIT_IP_HASH_SECRET", "          ");
    expect(isHashSecretConfigured()).toBe(false);
  });

  it("is true for a secret at or above the floor", () => {
    vi.stubEnv("AUDIT_IP_HASH_SECRET", STRONG);
    expect(isHashSecretConfigured()).toBe(true);
  });
});

describe("getHashSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the configured secret verbatim", () => {
    vi.stubEnv("AUDIT_IP_HASH_SECRET", STRONG);
    expect(getHashSecret()).toBe(STRONG);
  });

  // Behaviour is deliberately preserved: hashing must still happen with an
  // empty salt rather than falling back to storing a raw identifier. Changing
  // this would also invalidate every hash already written.
  it("returns an empty string when unset, so hashing still occurs", () => {
    vi.stubEnv("AUDIT_IP_HASH_SECRET", "");
    expect(getHashSecret()).toBe("");
  });
});

describe("production misconfiguration is loud", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs a critical error in production when the secret is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUDIT_IP_HASH_SECRET", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mod = await import("@/lib/hash-secret");
    mod.getHashSecret();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0].join(" ")).toMatch(/AUDIT_IP_HASH_SECRET/);
  });

  it("logs only once no matter how many times it is called", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUDIT_IP_HASH_SECRET", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mod = await import("@/lib/hash-secret");
    mod.getHashSecret();
    mod.getHashSecret();
    mod.getHashSecret();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("stays quiet in production when the secret is properly configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUDIT_IP_HASH_SECRET", STRONG);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mod = await import("@/lib/hash-secret");
    mod.getHashSecret();

    expect(spy).not.toHaveBeenCalled();
  });

  it("stays quiet in development, where an unset salt is expected", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUDIT_IP_HASH_SECRET", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mod = await import("@/lib/hash-secret");
    mod.getHashSecret();

    expect(spy).not.toHaveBeenCalled();
  });
});
