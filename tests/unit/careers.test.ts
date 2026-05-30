import { describe, it, expect } from "vitest";
import { CAREER_OPTIONS, SEMESTER_LEVELS } from "@/lib/careers";

describe("CAREER_OPTIONS", () => {
  it("has the 27 documented options", () => {
    expect(CAREER_OPTIONS).toHaveLength(27);
  });

  it("includes 'Other' as the catch-all", () => {
    expect(CAREER_OPTIONS).toContain("Other");
  });

  it("has no duplicates", () => {
    const set = new Set(CAREER_OPTIONS);
    expect(set.size).toBe(CAREER_OPTIONS.length);
  });

  it("includes the headline finance / accounting / marketing options", () => {
    expect(CAREER_OPTIONS).toContain("Public Accounting");
    expect(CAREER_OPTIONS).toContain("Corporate Finance");
    expect(CAREER_OPTIONS).toContain("Brand Management — Consumer Marketing");
    expect(CAREER_OPTIONS).toContain("Business Analytics");
  });
});

describe("SEMESTER_LEVELS", () => {
  it("has 5 levels in academic order", () => {
    expect(SEMESTER_LEVELS).toEqual([
      "Freshman",
      "Sophomore",
      "Junior",
      "Senior",
      "Graduate",
    ]);
  });
});
