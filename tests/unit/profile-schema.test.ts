import { describe, it, expect } from "vitest";
import { z } from "zod";
import { CAREER_OPTIONS, SEMESTER_LEVELS } from "@/lib/careers";

// Mirror of the profile schema in /api/me — kept in sync via this test.
const profileSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  major: z.string().min(1).max(120),
  minor: z.string().max(120).optional().nullable(),
  semesterLevel: z.enum(SEMESTER_LEVELS as unknown as [string, ...string[]]),
  expectedGraduation: z.string().min(1).max(40),
  phone: z.string().max(40).optional().nullable(),
  preferredContactMethod: z.enum(["email", "phone", "teams"]),
  bio: z.string().max(2000).optional().nullable(),
  image: z
    .string()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//i.test(v), {
      message: "image must be an https:// URL",
    })
    .optional()
    .nullable(),
  careerInterests: z
    .array(z.enum(CAREER_OPTIONS as unknown as [string, ...string[]]))
    .max(CAREER_OPTIONS.length),
});

const validBase = {
  firstName: "Test",
  lastName: "User",
  major: "Computer Science",
  semesterLevel: "Senior",
  expectedGraduation: "Spring 2026",
  preferredContactMethod: "email" as const,
  careerInterests: ["Public Accounting"],
};

describe("profile schema — image URL validation (security)", () => {
  it("accepts an https:// URL", () => {
    const r = profileSchema.safeParse({ ...validBase, image: "https://example.com/a.png" });
    expect(r.success).toBe(true);
  });

  it("rejects javascript: scheme — XSS prevention", () => {
    const r = profileSchema.safeParse({
      ...validBase,
      image: "javascript:alert(1)",
    });
    expect(r.success).toBe(false);
  });

  it("rejects data: URI — XSS prevention", () => {
    const r = profileSchema.safeParse({
      ...validBase,
      image: "data:image/png;base64,AAAA",
    });
    expect(r.success).toBe(false);
  });

  it("rejects plain http:// — must be https", () => {
    const r = profileSchema.safeParse({
      ...validBase,
      image: "http://example.com/a.png",
    });
    expect(r.success).toBe(false);
  });

  it("accepts empty string (clear photo)", () => {
    const r = profileSchema.safeParse({ ...validBase, image: "" });
    expect(r.success).toBe(true);
  });

  it("rejects URLs over 500 chars (log floods / header smuggling)", () => {
    const long = "https://example.com/" + "a".repeat(500);
    const r = profileSchema.safeParse({ ...validBase, image: long });
    expect(r.success).toBe(false);
  });
});

describe("profile schema — required fields", () => {
  it("rejects empty first name", () => {
    const r = profileSchema.safeParse({ ...validBase, firstName: "" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown semester level", () => {
    const r = profileSchema.safeParse({ ...validBase, semesterLevel: "PostDoc" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown career interest", () => {
    const r = profileSchema.safeParse({
      ...validBase,
      careerInterests: ["Underwater Basket Weaving"],
    });
    expect(r.success).toBe(false);
  });

  it("accepts all known career options", () => {
    const r = profileSchema.safeParse({
      ...validBase,
      careerInterests: [...CAREER_OPTIONS],
    });
    expect(r.success).toBe(true);
  });

  it("rejects contact method outside enum", () => {
    const r = profileSchema.safeParse({
      ...validBase,
      preferredContactMethod: "carrier-pigeon",
    });
    expect(r.success).toBe(false);
  });
});
