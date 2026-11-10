import { describe, expect, it } from "vitest";
import { applyFilters, departmentOf, parseFilters, resolveRange, toCsv, type ReportRow } from "@/lib/reports";

const NOW = new Date("2026-11-10T18:00:00Z"); // Nov 10, 11am in Denver

describe("resolveRange", () => {
  it("this month runs from the 1st (Mountain time) to now", () => {
    const r = resolveRange({ preset: "this_month" }, NOW);
    expect(r.start.toISOString()).toBe("2026-11-01T06:00:00.000Z");
    expect(r.end).toEqual(NOW);
  });

  it("last month is the whole previous calendar month", () => {
    const r = resolveRange({ preset: "last_month" }, NOW);
    expect(r.start.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-01T06:00:00.000Z");
  });

  it("year to date starts Jan 1", () => {
    expect(resolveRange({ preset: "ytd" }, NOW).start.toISOString()).toBe("2026-01-01T07:00:00.000Z");
  });

  it("custom dates include the whole end day", () => {
    const r = resolveRange({ preset: "custom", from: "2026-09-01", to: "2026-09-30" }, NOW);
    expect(r.start.toISOString()).toBe("2026-09-01T06:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-01T06:00:00.000Z");
  });

  it("handles the daylight-saving change", () => {
    const r = resolveRange({ preset: "custom", from: "2026-03-08", to: "2026-03-08" }, NOW);
    expect(r.start.toISOString()).toBe("2026-03-08T07:00:00.000Z"); // MST
    expect(r.end.toISOString()).toBe("2026-03-09T06:00:00.000Z"); // MDT
  });

  it("swaps a reversed custom range and falls back on bad input", () => {
    const r = resolveRange({ preset: "custom", from: "2026-09-30", to: "2026-09-01" }, NOW);
    expect(r.start < r.end).toBe(true);
    expect(resolveRange({ preset: "custom", from: "nope" }, NOW).preset).toBe("last_30");
  });
});

describe("departmentOf", () => {
  it("groups communication tracks and unknown majors", () => {
    expect(departmentOf("Communication: Journalism")).toBe("Communication");
    expect(departmentOf("Accounting")).toBe("Accounting");
    expect(departmentOf("Underwater Basket Weaving")).toBe("Other");
    expect(departmentOf(null)).toBe("Not listed");
  });
});

const row = (over: Partial<ReportRow>): ReportRow => ({
  id: "x",
  name: "X",
  email: "x@byui.edu",
  role: "member",
  major: "Accounting",
  department: "Accounting",
  semesterLevel: "Junior",
  podName: null,
  activeMentees: 0,
  activities: 0,
  careerTasks: 0,
  industryExperiences: 0,
  careerChats: 0,
  points: 0,
  joinedInRange: false,
  ...over,
});

describe("applyFilters", () => {
  const rows = [
    row({ id: "a", major: "Finance", department: "Business Management", careerChats: 4 }),
    row({ id: "b", role: "mentor", activeMentees: 3, semesterLevel: "Senior" }),
    row({ id: "c", major: "Communication: Journalism", department: "Communication", careerChats: 0 }),
  ];

  it("filters by department, major, year, role, mentees and interviews", () => {
    expect(applyFilters(rows, parseFilters({ department: "Communication" })).map((r) => r.id)).toEqual(["c"]);
    expect(applyFilters(rows, parseFilters({ major: "Finance" })).map((r) => r.id)).toEqual(["a"]);
    expect(applyFilters(rows, parseFilters({ year: "Senior" })).map((r) => r.id)).toEqual(["b"]);
    expect(applyFilters(rows, parseFilters({ role: "mentor" })).map((r) => r.id)).toEqual(["b"]);
    expect(applyFilters(rows, parseFilters({ mentees: "3" })).map((r) => r.id)).toEqual(["b"]);
    expect(applyFilters(rows, parseFilters({ interviews: "1" })).map((r) => r.id)).toEqual(["a"]);
  });

  it("ignores unknown filter values", () => {
    expect(applyFilters(rows, parseFilters({ role: "wizard", mentees: "lots" }))).toHaveLength(3);
  });
});

describe("toCsv", () => {
  it("quotes fields that need it", () => {
    const csv = toCsv([row({ name: 'Smith, "Jo"' })]);
    expect(csv.split("\n")[0]).toMatch(/^Name,Email,Role/);
    expect(csv).toContain('"Smith, ""Jo"""');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(toCsv([row({ name: "=HYPERLINK(1)" })])).toContain("'=HYPERLINK(1)");
  });
});
