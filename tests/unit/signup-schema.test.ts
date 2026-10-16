import { describe, it, expect } from "vitest";
import { signupSchema } from "@/lib/signup-schema";
import { TERMS_VERSION } from "@/lib/disclaimers";

const valid = {
  email: "student@byui.edu",
  password: "a-long-enough-password",
  acceptTerms: true,
};

describe("signupSchema", () => {
  it("accepts a student email with terms accepted", () => {
    const r = signupSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects signup when terms are not accepted", () => {
    const r = signupSchema.safeParse({ ...valid, acceptTerms: false });
    expect(r.success).toBe(false);
  });

  it("rejects signup when the terms flag is missing", () => {
    const { acceptTerms: _omit, ...rest } = valid;
    const r = signupSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("still restricts signups to @byui.edu addresses", () => {
    const r = signupSchema.safeParse({ ...valid, email: "someone@gmail.com" });
    expect(r.success).toBe(false);
  });

  it("exposes a dated terms version for the consent audit record", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
