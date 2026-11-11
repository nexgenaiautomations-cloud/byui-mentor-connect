import { describe, expect, it } from "vitest";
import { WAITLIST_RENOTIFY_MS, majorsMatch, membersToNotify } from "@/lib/mentor-waitlist";

const NOW = new Date("2026-11-11T18:00:00Z");
const day = 24 * 60 * 60 * 1000;
const member = (over: Partial<Parameters<typeof membersToNotify>[0][number]> = {}) => ({
  id: "m1",
  email: "ann@byui.edu",
  major: "Accounting",
  waitlistedAt: new Date(NOW.getTime() - 3 * day),
  notifiedAt: null as Date | null,
  ...over,
});

describe("majorsMatch", () => {
  it("ignores case and spacing, and needs both majors", () => {
    expect(majorsMatch(" accounting", "Accounting ")).toBe(true);
    expect(majorsMatch("Accounting", "Finance")).toBe(false);
    expect(majorsMatch(null, "Accounting")).toBe(false);
    expect(majorsMatch("", "")).toBe(false);
  });
});

describe("membersToNotify", () => {
  const mentor = { email: "bo@byui.edu", major: "Accounting" };

  it("notifies a waiting member when a mentor in their major has room", () => {
    expect(membersToNotify([member()], [mentor], NOW).map((m) => m.id)).toEqual(["m1"]);
  });

  it("skips other majors, other schools and members without a major", () => {
    expect(membersToNotify([member({ major: "Finance" })], [mentor], NOW)).toEqual([]);
    expect(membersToNotify([member({ email: "ann@usu.edu" })], [mentor], NOW)).toEqual([]);
    expect(membersToNotify([member({ major: null })], [mentor], NOW)).toEqual([]);
  });

  it("emails at most once a week", () => {
    const recent = new Date(NOW.getTime() - 2 * day);
    const old = new Date(NOW.getTime() - WAITLIST_RENOTIFY_MS - 1);
    expect(membersToNotify([member({ notifiedAt: recent })], [mentor], NOW)).toEqual([]);
    expect(membersToNotify([member({ notifiedAt: old })], [mentor], NOW)).toHaveLength(1);
  });

  it("notifies again if they rejoined the waitlist after the last email", () => {
    const notifiedAt = new Date(NOW.getTime() - 2 * day);
    const waitlistedAt = new Date(NOW.getTime() - 1 * day);
    expect(membersToNotify([member({ notifiedAt, waitlistedAt })], [mentor], NOW)).toHaveLength(1);
  });

  it("does nothing with no open mentors", () => {
    expect(membersToNotify([member()], [], NOW)).toEqual([]);
  });
});
