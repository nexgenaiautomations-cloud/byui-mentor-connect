import { describe, expect, it } from "vitest";
import { ACTIONS } from "@/lib/possible-actions";
import { MAJOR_ACTIVITY_POINTS, currentMonthStart, logPoints, rankPods } from "@/lib/pods";

const label = (key: string) => ACTIONS.find((a) => a.key === key)!.menteeLabel;

describe("logPoints", () => {
  it("scores 1 point per activity and 5 per internship/job offer", () => {
    const topics = [label("resume_work"), label("internship_offer"), "Other: went to a career fair"].join(" · ");
    expect(logPoints({ topicsDiscussed: topics, isSystemGenerated: false })).toBe(1 + MAJOR_ACTIVITY_POINTS + 1);
  });

  it("gives system-generated goal logs no points", () => {
    expect(logPoints({ topicsDiscussed: label("resume_work"), isSystemGenerated: true })).toBe(0);
  });

  it("counts a log with free-text topics as one activity", () => {
    expect(logPoints({ topicsDiscussed: "Talked about grad school", isSystemGenerated: false })).toBe(1);
    expect(logPoints({ topicsDiscussed: null, isSystemGenerated: false })).toBe(1);
  });
});

describe("currentMonthStart", () => {
  it("resets on the 1st in Mountain time", () => {
    // 2026-12-01 03:00 UTC is still Nov 30 in Denver.
    expect(currentMonthStart(new Date("2026-12-01T03:00:00Z")).toISOString()).toBe("2026-11-01T06:00:00.000Z");
    expect(currentMonthStart(new Date("2026-12-01T08:00:00Z")).toISOString()).toBe("2026-12-01T07:00:00.000Z");
  });
});

describe("rankPods", () => {
  it("orders pods by points, then by name, with shared ranks for ties", () => {
    const ranked = rankPods([
      { id: "b", name: "Beta", points: 10, members: 2 },
      { id: "a", name: "Alpha", points: 10, members: 3 },
      { id: "c", name: "Gamma", points: 25, members: 1 },
      { id: "d", name: "Delta", points: 0, members: 4 },
    ]);
    expect(ranked.map((p) => [p.name, p.rank])).toEqual([
      ["Gamma", 1],
      ["Alpha", 2],
      ["Beta", 2],
      ["Delta", 4],
    ]);
  });
});
