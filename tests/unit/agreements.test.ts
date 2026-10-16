import { describe, it, expect } from "vitest";
import { agreementSchema, needsAgreement } from "@/lib/agreements";
import { TERMS_VERSION } from "@/lib/disclaimers";

const allChecked = {
  independent: true,
  optional: true,
  ownRisk: true,
  terms: true,
};

describe("agreementSchema", () => {
  it("accepts when every acknowledgment is checked", () => {
    expect(agreementSchema.safeParse(allChecked).success).toBe(true);
  });

  it.each(Object.keys(allChecked))("rejects when %s is unchecked", (key) => {
    expect(agreementSchema.safeParse({ ...allChecked, [key]: false }).success).toBe(false);
  });

  it("rejects when an acknowledgment is missing", () => {
    const { terms: _omit, ...rest } = allChecked;
    expect(agreementSchema.safeParse(rest).success).toBe(false);
  });
});

describe("needsAgreement", () => {
  it("is true for a user who has never accepted", () => {
    expect(needsAgreement({ termsAcceptedVersion: null })).toBe(true);
  });

  it("is true for a user who accepted an older version", () => {
    expect(needsAgreement({ termsAcceptedVersion: "2000-01-01" })).toBe(true);
  });

  it("is false for a user on the current version", () => {
    expect(needsAgreement({ termsAcceptedVersion: TERMS_VERSION })).toBe(false);
  });
});
