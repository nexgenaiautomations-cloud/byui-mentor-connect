import { describe, it, expect } from "vitest";
import {
  weekRangeForDate,
  monthRangeForDate,
  computeStreak,
} from "@/lib/kpis";

describe("weekRangeForDate (Sunday-start, local time)", () => {
  it("returns Sun 00:00 → next Sun 00:00 for a Wednesday", () => {
    // Wed Mar 4, 2026 12:30 (local). Sun before = Mar 1, Sun after = Mar 8.
    const wed = new Date(2026, 2, 4, 12, 30, 0, 0);
    const { start, end } = weekRangeForDate(wed);
    expect(start.getDay()).toBe(0); // Sunday
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(2);
    expect(start.getHours()).toBe(0);
    expect(end.getDay()).toBe(0);
    expect(end.getDate()).toBe(8);
  });

  it("treats Sunday at noon as the start of its own week", () => {
    const sunNoon = new Date(2026, 2, 1, 12, 0, 0, 0); // Sun Mar 1
    const { start, end } = weekRangeForDate(sunNoon);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(8);
  });

  it("treats Saturday 23:59 as still in the same week", () => {
    const satLate = new Date(2026, 2, 7, 23, 59, 0, 0); // Sat Mar 7
    const { start, end } = weekRangeForDate(satLate);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(8);
  });

  it("handles month rollover (Sun in Feb, Sat in Mar)", () => {
    const tue = new Date(2026, 1, 24, 9, 0, 0, 0); // Tue Feb 24
    const { start, end } = weekRangeForDate(tue);
    expect(start.getMonth()).toBe(1); // Feb
    expect(start.getDate()).toBe(22); // Sun Feb 22
    expect(end.getMonth()).toBe(2); // Mar
    expect(end.getDate()).toBe(1); // Sun Mar 1
  });
});

describe("monthRangeForDate", () => {
  it("returns 1st of the month → 1st of the next month", () => {
    const d = new Date(2026, 2, 15, 10, 0, 0, 0);
    const { start, end } = monthRangeForDate(d);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(1);
  });

  it("rolls over December → January next year", () => {
    const d = new Date(2026, 11, 30, 12, 0, 0, 0);
    const { start, end } = monthRangeForDate(d);
    expect(start.getMonth()).toBe(11);
    expect(start.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(0);
    expect(end.getFullYear()).toBe(2027);
  });
});

describe("computeStreak", () => {
  // Input array convention: index 0 = current week, index N = N weeks ago.
  // Each entry: did the student log >=1 career_tasks accomplishment in that week?

  it("returns 0 when nothing is completed", () => {
    expect(computeStreak([false, false, false, false]).streak).toBe(0);
  });

  it("returns 1 when only this week is complete", () => {
    expect(computeStreak([true]).streak).toBe(1);
  });

  it("counts consecutive completed weeks ending at current", () => {
    expect(computeStreak([true, true, true]).streak).toBe(3);
    expect(computeStreak([true, true, true, false]).streak).toBe(3);
  });

  it("preserves prior streak when current week is incomplete", () => {
    // This week incomplete but previous 3 were completed → streak = 3.
    expect(computeStreak([false, true, true, true, false]).streak).toBe(3);
  });

  it("resets streak when a gap appears before the most recent completes", () => {
    // current true, last week true, week before missed → streak 2.
    expect(computeStreak([true, true, false, true]).streak).toBe(2);
  });

  it("flags thisWeekIncomplete based on the current week", () => {
    expect(computeStreak([true]).thisWeekIncomplete).toBe(false);
    expect(computeStreak([false, true, true]).thisWeekIncomplete).toBe(true);
    expect(computeStreak([false]).thisWeekIncomplete).toBe(true);
  });

  it("handles empty input as zero / incomplete", () => {
    const r = computeStreak([]);
    expect(r.streak).toBe(0);
    expect(r.thisWeekIncomplete).toBe(true);
  });
});
