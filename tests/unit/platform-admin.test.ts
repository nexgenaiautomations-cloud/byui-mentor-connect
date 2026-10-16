import { describe, it, expect } from "vitest";
import { isPlatformAdminEmail, parsePlatformAdminEmails } from "@/lib/platform-admin";

describe("parsePlatformAdminEmails", () => {
  it("splits, trims and lowercases a comma list", () => {
    expect(parsePlatformAdminEmails(" A@x.edu, b@Y.edu ,,")).toEqual(["a@x.edu", "b@y.edu"]);
  });

  it("returns an empty list when unset", () => {
    expect(parsePlatformAdminEmails(undefined)).toEqual([]);
  });
});

describe("isPlatformAdminEmail", () => {
  it("matches case-insensitively", () => {
    expect(isPlatformAdminEmail("Owner@School.edu", ["owner@school.edu"])).toBe(true);
  });

  it("denies everyone when the list is empty", () => {
    expect(isPlatformAdminEmail("owner@school.edu", [])).toBe(false);
  });

  it("denies emails not on the list", () => {
    expect(isPlatformAdminEmail("admin@school.edu", ["owner@school.edu"])).toBe(false);
  });
});
