import { describe, it, expect } from "vitest";
import { toSafeMe } from "@/lib/safe-user";
import type { User } from "@/db/schema";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: "u_1",
    email: "user@byui.edu",
    name: "Test User",
    firstName: "Test",
    lastName: "User",
    image: "https://example.com/x.png",
    emailVerified: new Date(),
    major: "Computer Science",
    minor: null,
    semesterLevel: "Senior",
    expectedGraduation: "Spring 2026",
    phone: "(208) 555-0100",
    preferredContactMethod: "email",
    bio: "bio",
    careerInterests: ["Public Accounting"],
    isMentor: false,
    mentorCapacity: 5,
    mentorTopics: null,
    mentorAvailable: true,
    isAdmin: false,
    onboardedAt: new Date(),
    createdAt: new Date(),
    ...over,
  } as User;
}

describe("toSafeMe", () => {
  it("strips the phone number — PII should not leak via /api/me", () => {
    const u = makeUser({ phone: "(208) 555-9999" });
    const safe = toSafeMe(u);
    expect((safe as unknown as Record<string, unknown>).phone).toBeUndefined();
  });

  it("strips emailVerified — internal DB timestamp", () => {
    const safe = toSafeMe(makeUser());
    expect((safe as unknown as Record<string, unknown>).emailVerified).toBeUndefined();
  });

  it("strips createdAt — internal DB timestamp", () => {
    const safe = toSafeMe(makeUser());
    expect((safe as unknown as Record<string, unknown>).createdAt).toBeUndefined();
  });

  it("preserves identity fields the UI needs", () => {
    const u = makeUser({
      firstName: "Avery",
      lastName: "Admin",
      email: "avery@byui.edu",
      isAdmin: true,
    });
    const safe = toSafeMe(u);
    expect(safe.firstName).toBe("Avery");
    expect(safe.lastName).toBe("Admin");
    expect(safe.email).toBe("avery@byui.edu");
    expect(safe.isAdmin).toBe(true);
  });

  it("preserves career interests array", () => {
    const u = makeUser({ careerInterests: ["Public Accounting", "Tax Planning"] });
    const safe = toSafeMe(u);
    expect(safe.careerInterests).toEqual(["Public Accounting", "Tax Planning"]);
  });

  it("preserves mentor fields when user is a mentor", () => {
    const u = makeUser({
      isMentor: true,
      mentorCapacity: 4,
      mentorTopics: ["Resume reviews"],
      mentorAvailable: true,
    });
    const safe = toSafeMe(u);
    expect(safe.isMentor).toBe(true);
    expect(safe.mentorCapacity).toBe(4);
    expect(safe.mentorTopics).toEqual(["Resume reviews"]);
    expect(safe.mentorAvailable).toBe(true);
  });

  it("returns onboardedAt so client knows if user finished onboarding", () => {
    const date = new Date("2026-01-01");
    const safe = toSafeMe(makeUser({ onboardedAt: date }));
    expect(safe.onboardedAt).toEqual(date);
  });

  it("handles null fields gracefully", () => {
    const u = makeUser({
      name: null,
      firstName: null,
      lastName: null,
      bio: null,
      image: null,
      onboardedAt: null,
    });
    const safe = toSafeMe(u);
    expect(safe.name).toBeNull();
    expect(safe.onboardedAt).toBeNull();
  });
});
