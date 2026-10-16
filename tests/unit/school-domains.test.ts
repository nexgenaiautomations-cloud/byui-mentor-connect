import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCHOOL_DOMAINS,
  emailDomain,
  isAllowedDomain,
  normalizeDomain,
} from "@/lib/school-domains";

describe("emailDomain", () => {
  it("returns the lowercased domain after the @", () => {
    expect(emailDomain("Jane.Doe@BYUI.edu")).toBe("byui.edu");
  });

  it("returns null for strings that are not emails", () => {
    expect(emailDomain("no-at-sign")).toBeNull();
    expect(emailDomain("trailing@")).toBeNull();
  });
});

describe("isAllowedDomain", () => {
  it("matches an exact domain in the list", () => {
    expect(isAllowedDomain("student@byui.edu", ["byui.edu"])).toBe(true);
  });

  it("rejects other domains", () => {
    expect(isAllowedDomain("someone@gmail.com", ["byui.edu"])).toBe(false);
  });

  it("does not accept look-alike suffixes", () => {
    expect(isAllowedDomain("x@evilbyui.edu", ["byui.edu"])).toBe(false);
    expect(isAllowedDomain("x@byui.edu.attacker.com", ["byui.edu"])).toBe(false);
  });

  it("does not accept subdomains unless they are listed", () => {
    expect(isAllowedDomain("x@mail.byui.edu", ["byui.edu"])).toBe(false);
  });
});

describe("normalizeDomain", () => {
  it("lowercases and strips a leading @ and whitespace", () => {
    expect(normalizeDomain("  @Example.EDU ")).toBe("example.edu");
  });

  it("rejects values that are not domains", () => {
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("a@b.edu")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
  });
});

describe("DEFAULT_SCHOOL_DOMAINS", () => {
  it("keeps byui.edu as the launch school", () => {
    expect(DEFAULT_SCHOOL_DOMAINS).toContain("byui.edu");
  });
});
