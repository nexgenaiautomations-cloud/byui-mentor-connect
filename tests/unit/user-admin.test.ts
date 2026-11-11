import { describe, expect, it } from "vitest";
import { checkRoleChange, checkRemoval, checkRestore, currentRole } from "@/lib/user-admin";

const u = (over: Partial<Parameters<typeof checkRemoval>[1]> & { id: string }) => ({
  isAdmin: false,
  isHeadAdmin: false,
  isMentor: false,
  isExecutiveMentor: false,
  deactivatedAt: null as Date | null,
  ...over,
});

const admin = u({ id: "admin", isAdmin: true });
const head = u({ id: "head", isAdmin: true, isHeadAdmin: true });

describe("currentRole", () => {
  it("maps flags to the managed role", () => {
    expect(currentRole(u({ id: "a" }))).toBe("member");
    expect(currentRole(u({ id: "a", isMentor: true }))).toBe("mentor");
    expect(currentRole(u({ id: "a", isMentor: true, isExecutiveMentor: true }))).toBe(
      "executive_mentor"
    );
  });
});

describe("checkRoleChange", () => {
  it("lets any admin demote a mentor to member", () => {
    expect(checkRoleChange(admin, u({ id: "m", isMentor: true }), "member")).toBeNull();
  });

  it("lets any admin promote a member to mentor or executive mentor", () => {
    expect(checkRoleChange(admin, u({ id: "m" }), "mentor")).toBeNull();
    expect(checkRoleChange(admin, u({ id: "m" }), "executive_mentor")).toBeNull();
  });

  it("refuses non-admins", () => {
    expect(checkRoleChange(u({ id: "x" }), u({ id: "m" }), "mentor")).toMatch(/admin/i);
  });

  it("refuses changing your own role", () => {
    expect(checkRoleChange(admin, admin, "member")).toMatch(/your own/i);
  });

  it("refuses a no-op change", () => {
    expect(checkRoleChange(admin, u({ id: "m", isMentor: true }), "mentor")).toMatch(/already/i);
  });

  it("only the head admin may change another admin's role", () => {
    const other = u({ id: "o", isAdmin: true, isMentor: true });
    expect(checkRoleChange(admin, other, "member")).toMatch(/head admin/i);
    expect(checkRoleChange(head, other, "member")).toBeNull();
  });

  it("refuses removed accounts", () => {
    expect(
      checkRoleChange(admin, u({ id: "r", deactivatedAt: new Date() }), "mentor")
    ).toMatch(/removed/i);
  });
});

describe("checkRemoval / checkRestore", () => {
  it("lets an admin remove a member or mentor", () => {
    expect(checkRemoval(admin, u({ id: "m" }))).toBeNull();
    expect(checkRemoval(admin, u({ id: "m", isMentor: true }))).toBeNull();
  });

  it("refuses removing yourself", () => {
    expect(checkRemoval(admin, admin)).toMatch(/yourself/i);
  });

  it("only the head admin may remove another admin, and never the head admin", () => {
    const other = u({ id: "o", isAdmin: true });
    expect(checkRemoval(admin, other)).toMatch(/head admin/i);
    expect(checkRemoval(head, other)).toBeNull();
    expect(checkRemoval(head, u({ id: "h2", isAdmin: true, isHeadAdmin: true }))).toMatch(
      /head admin/i
    );
  });

  it("refuses removing an already removed account", () => {
    expect(checkRemoval(admin, u({ id: "r", deactivatedAt: new Date() }))).toMatch(/already/i);
  });

  it("restores only removed accounts", () => {
    expect(checkRestore(admin, u({ id: "r", deactivatedAt: new Date() }))).toBeNull();
    expect(checkRestore(admin, u({ id: "m" }))).toMatch(/not removed/i);
    expect(checkRestore(u({ id: "x" }), u({ id: "r", deactivatedAt: new Date() }))).toMatch(
      /admin/i
    );
  });
});
