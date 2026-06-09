import { describe, it, expect } from "vitest";
import {
  generateRawToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
} from "@/lib/password-reset";

describe("generateRawToken", () => {
  it("returns a 64-char hex token (32 bytes)", () => {
    const t = generateRawToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns a different token each call", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("returns a SHA-256 hex hash", () => {
    const h = hashToken("abc");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("RESET_TOKEN_TTL_MS", () => {
  it("is 1 hour", () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });
});
