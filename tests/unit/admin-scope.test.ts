import { describe, it, expect } from "vitest";
import { adminScopeFor, schoolInScope } from "@/lib/admin-scope";

describe("adminScopeFor", () => {
  it("non-admins get no scope at all", () => {
    expect(adminScopeFor({ email: "a@byui.edu", isAdmin: false }, null, true)).toBeNull();
  });
  it("program admins are pinned to their own school, ignoring requests", () => {
    expect(adminScopeFor({ email: "A@BYUI.edu", isAdmin: true }, "state.edu", false)).toEqual({
      school: "byui.edu",
      platform: false,
    });
  });
  it("platform admins see all schools or the one they pick", () => {
    expect(adminScopeFor({ email: "p@x.com", isAdmin: true }, "", true)).toEqual({ school: null, platform: true });
    expect(adminScopeFor({ email: "p@x.com", isAdmin: true }, " State.edu ", true)).toEqual({ school: "state.edu", platform: true });
  });
  it("an admin with a malformed email sees nothing rather than everything", () => {
    const s = adminScopeFor({ email: "broken", isAdmin: true }, null, false)!;
    expect(s.school).not.toBeNull();
    expect(schoolInScope("byui.edu", s)).toBe(false);
  });
});

describe("schoolInScope", () => {
  it("matches only the scoped school", () => {
    expect(schoolInScope("byui.edu", { school: "byui.edu", platform: false })).toBe(true);
    expect(schoolInScope("state.edu", { school: "byui.edu", platform: false })).toBe(false);
    expect(schoolInScope(null, { school: "byui.edu", platform: false })).toBe(false);
    expect(schoolInScope("state.edu", { school: null, platform: true })).toBe(true);
  });
});
