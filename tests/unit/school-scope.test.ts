import { describe, it, expect } from "vitest";
import { sameSchool, schoolOf } from "@/lib/school-scope";

describe("schoolOf", () => {
  it("is the lowercased email domain", () => {
    expect(schoolOf("Jane@BYUI.edu")).toBe("byui.edu");
  });
});

describe("sameSchool", () => {
  it("pairs students at the same school", () => {
    expect(sameSchool("a@byui.edu", "B@byui.edu")).toBe(true);
  });

  it("refuses to pair students from different schools", () => {
    expect(sameSchool("a@byui.edu", "b@state.edu")).toBe(false);
  });

  it("treats subdomains as a different school", () => {
    expect(sameSchool("a@byui.edu", "b@mail.byui.edu")).toBe(false);
  });

  it("refuses malformed emails", () => {
    expect(sameSchool("nope", "nope")).toBe(false);
  });
});
