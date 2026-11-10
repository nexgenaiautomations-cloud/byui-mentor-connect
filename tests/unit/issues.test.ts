import { describe, expect, it } from "vitest";
import {
  ISSUE_CATEGORIES,
  categoryLabel,
  isIssueCategory,
  isIssueStatus,
  unacknowledgedFor,
  acknowledgementSummary,
} from "@/lib/issues";

const issue = (id: string, createdAt: string) => ({
  id,
  createdAt: new Date(createdAt),
});

describe("issue categories", () => {
  it("labels every category", () => {
    for (const c of ISSUE_CATEGORIES) {
      expect(categoryLabel(c)).not.toBe(c);
    }
  });

  it("falls back to the raw value for unknown categories", () => {
    expect(categoryLabel("weird")).toBe("weird");
  });

  it("validates categories and statuses", () => {
    expect(isIssueCategory("it")).toBe(true);
    expect(isIssueCategory("nope")).toBe(false);
    expect(isIssueStatus("open")).toBe(true);
    expect(isIssueStatus("addressed")).toBe(true);
    expect(isIssueStatus("closed")).toBe(false);
  });
});

describe("unacknowledgedFor", () => {
  const issues = [
    issue("b", "2026-11-09T10:00:00Z"),
    issue("a", "2026-11-08T10:00:00Z"),
    issue("c", "2026-11-10T10:00:00Z"),
  ];

  it("returns every issue the admin has no receipt for, oldest first", () => {
    const receipts = [{ issueId: "b", adminId: "admin-2" }];
    expect(unacknowledgedFor("admin-1", issues, receipts).map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("excludes issues this admin already acknowledged", () => {
    const receipts = [
      { issueId: "a", adminId: "admin-1" },
      { issueId: "c", adminId: "admin-1" },
    ];
    expect(unacknowledgedFor("admin-1", issues, receipts).map((i) => i.id)).toEqual([
      "b",
    ]);
  });

  it("still requires acknowledgement after another admin addressed it", () => {
    const addressed = [{ ...issue("a", "2026-11-08T10:00:00Z"), status: "addressed" }];
    const receipts = [{ issueId: "a", adminId: "admin-2" }];
    expect(unacknowledgedFor("admin-1", addressed, receipts)).toHaveLength(1);
  });
});

describe("acknowledgementSummary", () => {
  const admins = [
    { id: "a1", name: "Dave" },
    { id: "a2", name: "Shaun" },
    { id: "a3", name: null },
  ];

  it("splits admins into seen (in order seen) and not yet seen", () => {
    const receipts = [
      { issueId: "x", adminId: "a2", seenAt: new Date("2026-11-10T09:00:00Z") },
      { issueId: "x", adminId: "a1", seenAt: new Date("2026-11-10T08:00:00Z") },
      { issueId: "y", adminId: "a3", seenAt: new Date("2026-11-10T08:00:00Z") },
    ];
    const s = acknowledgementSummary("x", admins, receipts);
    expect(s.seen.map((r) => r.adminId)).toEqual(["a1", "a2"]);
    expect(s.notSeen.map((a) => a.id)).toEqual(["a3"]);
  });

  it("keeps receipts from former admins visible in the seen list", () => {
    const receipts = [
      { issueId: "x", adminId: "gone", seenAt: new Date("2026-11-10T08:00:00Z") },
    ];
    const s = acknowledgementSummary("x", admins, receipts);
    expect(s.seen.map((r) => r.adminId)).toEqual(["gone"]);
    expect(s.notSeen).toHaveLength(3);
  });
});
