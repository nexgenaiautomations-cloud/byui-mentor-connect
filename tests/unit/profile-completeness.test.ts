import { describe, expect, it } from "vitest";
import { missingProfileFields, PROFILE_SNOOZE_MS, shouldNagProfile } from "@/lib/profile-completeness";

const complete = {
  firstName: "Ada",
  lastName: "Lovelace",
  major: "Accounting",
  semesterLevel: "junior",
  expectedGraduation: "Spring 2027",
  careerInterests: ["Audit"],
  preferredContactMethod: "email",
};

describe("missingProfileFields", () => {
  it("returns nothing for a complete profile", () => {
    expect(missingProfileFields(complete)).toEqual([]);
  });

  it("lists blank, whitespace-only and empty-array fields by label", () => {
    expect(
      missingProfileFields({
        ...complete,
        firstName: "  ",
        major: null,
        careerInterests: [],
        preferredContactMethod: "",
      })
    ).toEqual(["First name", "Major", "Career interests", "Preferred contact method"]);
  });
});

describe("shouldNagProfile", () => {
  const now = 1_000_000_000;
  it("does not nag on the profile and onboarding pages", () => {
    expect(shouldNagProfile("/profile", null, now)).toBe(false);
    expect(shouldNagProfile("/onboarding", null, now)).toBe(false);
    expect(shouldNagProfile("/settings", null, now)).toBe(false);
  });

  it("nags elsewhere unless snoozed recently", () => {
    expect(shouldNagProfile("/dashboard", null, now)).toBe(true);
    expect(shouldNagProfile("/dashboard", now - 1000, now)).toBe(false);
    expect(shouldNagProfile("/dashboard", now - PROFILE_SNOOZE_MS - 1, now)).toBe(true);
  });
});
