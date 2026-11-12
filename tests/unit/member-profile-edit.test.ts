import { describe, it, expect } from "vitest";
import { adminProfileEditSchema, buildProfileUpdate, checkProfileEdit } from "@/lib/member-profile-edit";

const current = {
  name: "Riley Park",
  firstName: "Riley",
  lastName: "Park",
  major: "Finance",
  minor: null,
  semesterLevel: "Junior",
  expectedGraduation: "Spring 2027",
  phone: null,
  preferredContactMethod: "email",
  bio: null,
};

describe("adminProfileEditSchema", () => {
  it("rejects email, roles and unknown fields", () => {
    expect(adminProfileEditSchema.safeParse({ email: "x@other.edu" }).success).toBe(false);
    expect(adminProfileEditSchema.safeParse({ isAdmin: true }).success).toBe(false);
  });
  it("requires names when sent and validates enums", () => {
    expect(adminProfileEditSchema.safeParse({ firstName: "  " }).success).toBe(false);
    expect(adminProfileEditSchema.safeParse({ semesterLevel: "Wizard" }).success).toBe(false);
    expect(adminProfileEditSchema.safeParse({ semesterLevel: "", preferredContactMethod: "teams" }).success).toBe(true);
  });
  it("trims values", () => {
    const r = adminProfileEditSchema.parse({ firstName: "  Sam " });
    expect(r.firstName).toBe("Sam");
  });
});

describe("buildProfileUpdate", () => {
  it("records only changed fields and recomposes the display name", () => {
    const { set, changed } = buildProfileUpdate(current, { firstName: "Sam", major: "Finance" });
    expect(changed).toEqual(["firstName"]);
    expect(set).toEqual({ firstName: "Sam", name: "Sam Park" });
  });
  it("stores blanks as null", () => {
    const { set, changed } = buildProfileUpdate(current, { major: "", minor: "" });
    expect(changed).toEqual(["major"]);
    expect(set).toEqual({ major: null });
  });
  it("returns nothing when nothing changed", () => {
    expect(buildProfileUpdate(current, { lastName: "Park" }).changed).toEqual([]);
  });
});

describe("checkProfileEdit", () => {
  const admin = { id: "a", isAdmin: true, isHeadAdmin: false };
  const head = { id: "h", isAdmin: true, isHeadAdmin: true };
  const member = { id: "m", isAdmin: false, isHeadAdmin: false };
  const otherAdmin = { id: "o", isAdmin: true, isHeadAdmin: false };
  it("lets admins edit members", () => expect(checkProfileEdit(admin, member)).toBeNull());
  it("blocks non-admins and self-edits here", () => {
    expect(checkProfileEdit(member, admin)).not.toBeNull();
    expect(checkProfileEdit(admin, admin)).not.toBeNull();
  });
  it("only the head admin edits another admin", () => {
    expect(checkProfileEdit(admin, otherAdmin)).not.toBeNull();
    expect(checkProfileEdit(head, otherAdmin)).toBeNull();
  });
});
