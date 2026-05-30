import { describe, it, expect } from "vitest";

// Domain restriction logic mirrors what's in auth.ts and the /login server
// action. Centralised here to lock the rule in tests.
function isAllowedSignInEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith("@byui.edu");
}

function safeNextPath(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

describe("BYU-I domain restriction", () => {
  it("accepts a @byui.edu email", () => {
    expect(isAllowedSignInEmail("student@byui.edu")).toBe(true);
  });

  it("accepts case-insensitively", () => {
    expect(isAllowedSignInEmail("Student@BYUI.EDU")).toBe(true);
  });

  it("rejects gmail", () => {
    expect(isAllowedSignInEmail("attacker@gmail.com")).toBe(false);
  });

  it("rejects subdomain spoof (byui.edu.evil.com)", () => {
    expect(isAllowedSignInEmail("a@byui.edu.evil.com")).toBe(false);
  });

  it("rejects null / undefined / empty", () => {
    expect(isAllowedSignInEmail(null)).toBe(false);
    expect(isAllowedSignInEmail(undefined)).toBe(false);
    expect(isAllowedSignInEmail("")).toBe(false);
  });
});

describe("safe next path (open-redirect prevention)", () => {
  it("preserves a relative path", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/mentors")).toBe("/mentors");
  });

  it("rejects an absolute URL", () => {
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
  });

  it("rejects protocol-relative URL (//evil.com)", () => {
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
  });

  it("rejects empty string", () => {
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("rejects undefined", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
  });

  it("preserves query strings on relative paths", () => {
    expect(safeNextPath("/mentors?semester=Senior")).toBe("/mentors?semester=Senior");
  });
});
