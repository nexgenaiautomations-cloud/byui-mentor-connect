import { describe, expect, it } from "vitest";
import { PLEDGE_ITEMS, needsPledge, pledgeNameMatches } from "@/lib/pledge";

describe("PLEDGE_ITEMS", () => {
  it("is the 3-2-1 standard", () => {
    expect(PLEDGE_ITEMS.map((i) => i.count)).toEqual([3, 2, 1]);
  });
});

describe("pledgeNameMatches", () => {
  const who = { firstName: "Ada", lastName: "Lovelace", name: "Ada Lovelace" };

  it("accepts the full name, ignoring case and extra spaces", () => {
    expect(pledgeNameMatches("ada  lovelace ", who)).toBe(true);
    expect(pledgeNameMatches("ADA LOVELACE", who)).toBe(true);
  });

  it("accepts a middle name or initial between first and last", () => {
    expect(pledgeNameMatches("Ada K. Lovelace", who)).toBe(true);
  });

  it("rejects partial or different names", () => {
    expect(pledgeNameMatches("Ada", who)).toBe(false);
    expect(pledgeNameMatches("Grace Hopper", who)).toBe(false);
    expect(pledgeNameMatches("", who)).toBe(false);
  });

  it("falls back to the display name when first/last are missing", () => {
    expect(pledgeNameMatches("Ada Lovelace", { firstName: null, lastName: null, name: "Ada Lovelace" })).toBe(true);
  });

  it("accepts any 2+ word name when the account has no name at all", () => {
    const anon = { firstName: null, lastName: null, name: null };
    expect(pledgeNameMatches("Ada Lovelace", anon)).toBe(true);
    expect(pledgeNameMatches("Ada", anon)).toBe(false);
  });
});

describe("needsPledge", () => {
  it("is required once onboarded and until signed", () => {
    expect(needsPledge({ onboardedAt: null, pledgeSignedAt: null, isAdmin: false })).toBe(false);
    expect(needsPledge({ onboardedAt: new Date(), pledgeSignedAt: null, isAdmin: false })).toBe(true);
    expect(needsPledge({ onboardedAt: new Date(), pledgeSignedAt: new Date(), isAdmin: false })).toBe(false);
  });

  it("does not gate admins", () => {
    expect(needsPledge({ onboardedAt: new Date(), pledgeSignedAt: null, isAdmin: true })).toBe(false);
  });
});
