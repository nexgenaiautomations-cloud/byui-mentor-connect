import { describe, it, expect } from "vitest";
import { signupSchema } from "@/lib/signup-schema";
import { TERMS_VERSION } from "@/lib/disclaimers";

const valid = {
  email: "student@byui.edu",
  password: "a-long-enough-password",
};

describe("signupSchema", () => {
  it("accepts an email and password", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("normalizes the email to lowercase", () => {
    const r = signupSchema.safeParse({ ...valid, email: "Student@BYUI.edu" });
    expect(r.success && r.data.email).toBe("student@byui.edu");
  });

  it("rejects malformed emails", () => {
    expect(signupSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  it("rejects short passwords", () => {
    expect(signupSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("exposes a dated terms version for the consent record", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
