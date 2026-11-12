import { describe, it, expect } from "vitest";
import { graduationRank, roleRank, sortMembers, type SortableMember } from "@/lib/member-sort";

const m = (o: Partial<SortableMember>): SortableMember => ({
  name: "A",
  email: "a@byui.edu",
  major: null,
  semesterLevel: null,
  expectedGraduation: null,
  isMentor: false,
  isExecutiveMentor: false,
  isAdmin: false,
  isHeadAdmin: false,
  removedAt: null,
  activeMatches: 0,
  achievementsEarned: 0,
  createdAt: "2026-01-01T00:00:00Z",
  ...o,
});
const names = (rows: SortableMember[]) => rows.map((r) => r.name);

describe("sortMembers", () => {
  it("sorts names case-insensitively and falls back to email", () => {
    const rows = [m({ name: "bob" }), m({ name: null, email: "aaron@byui.edu" }), m({ name: "Alice" })];
    expect(sortMembers(rows, "name", "asc").map((r) => r.name ?? r.email)).toEqual(["aaron@byui.edu", "Alice", "bob"]);
  });
  it("orders numbers inside names naturally", () => {
    const rows = [m({ name: "Mentor 10" }), m({ name: "Mentor 2" }), m({ name: "Mentor 1" })];
    expect(names(sortMembers(rows, "name", "asc"))).toEqual(["Mentor 1", "Mentor 2", "Mentor 10"]);
  });
  it("puts blanks last in both directions", () => {
    const rows = [m({ name: "x", major: null }), m({ name: "y", major: "Finance" }), m({ name: "z", major: "Accounting" })];
    expect(names(sortMembers(rows, "major", "asc"))).toEqual(["z", "y", "x"]);
    expect(names(sortMembers(rows, "major", "desc"))).toEqual(["y", "z", "x"]);
  });
  it("orders year in school by level, not alphabetically", () => {
    const rows = [m({ name: "s", semesterLevel: "Senior" }), m({ name: "f", semesterLevel: "Freshman" }), m({ name: "j", semesterLevel: "Junior" })];
    expect(names(sortMembers(rows, "semesterLevel", "asc"))).toEqual(["f", "j", "s"]);
  });
  it("orders graduation by term and year", () => {
    const rows = [m({ name: "a", expectedGraduation: "Winter 2028" }), m({ name: "b", expectedGraduation: "Fall 2027" }), m({ name: "c", expectedGraduation: "Spring 2027" })];
    expect(names(sortMembers(rows, "expectedGraduation", "asc"))).toEqual(["c", "b", "a"]);
  });
  it("sorts numbers and dates, and keeps ties stable", () => {
    const rows = [m({ name: "a", activeMatches: 2 }), m({ name: "b", activeMatches: 5 }), m({ name: "c", activeMatches: 2 })];
    expect(names(sortMembers(rows, "activeMatches", "desc"))).toEqual(["b", "a", "c"]);
    const dated = [m({ name: "old", createdAt: "2025-01-01" }), m({ name: "new", createdAt: "2026-06-01" })];
    expect(names(sortMembers(dated, "createdAt", "desc"))).toEqual(["new", "old"]);
  });
  it("ranks roles from removed up to head admin", () => {
    expect(roleRank(m({ removedAt: "x", isAdmin: true }))).toBe(0);
    expect(roleRank(m({}))).toBeLessThan(roleRank(m({ isMentor: true })));
    expect(roleRank(m({ isMentor: true, isExecutiveMentor: true }))).toBeLessThan(roleRank(m({ isAdmin: true })));
    expect(roleRank(m({ isAdmin: true, isHeadAdmin: true }))).toBe(5);
  });
  it("does not mutate its input", () => {
    const rows = [m({ name: "b" }), m({ name: "a" })];
    sortMembers(rows, "name", "asc");
    expect(names(rows)).toEqual(["b", "a"]);
  });
});

describe("graduationRank", () => {
  it("parses terms, tolerates free text, and treats blank as missing", () => {
    expect(graduationRank("Spring 2027")! < graduationRank("Fall 2027")!).toBe(true);
    expect(graduationRank("Dec 2027")).toBe(20279);
    expect(graduationRank("")).toBeNull();
    expect(graduationRank("someday")).toBeNull();
  });
});
