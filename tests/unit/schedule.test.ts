import { describe, it, expect } from "vitest";
import {
  zonedToUtc,
  localDateStr,
  addDays,
  isValidTimeZone,
  parseHHMM,
  reminderWindow,
  isDue,
  fulfils,
  type ScheduledShape,
} from "@/lib/schedule";

const H = 60 * 60 * 1000;

describe("timezone helpers", () => {
  it("converts Denver wall time to UTC across DST", () => {
    // MST (UTC-7) in January, MDT (UTC-6) in July
    expect(zonedToUtc("2026-01-15", "14:30", "America/Denver").toISOString()).toBe("2026-01-15T21:30:00.000Z");
    expect(zonedToUtc("2026-07-15", "14:30", "America/Denver").toISOString()).toBe("2026-07-15T20:30:00.000Z");
  });
  it("uses local midnight when no time is given", () => {
    expect(zonedToUtc("2026-03-02", null, "America/New_York").toISOString()).toBe("2026-03-02T05:00:00.000Z");
  });
  it("handles the spring-forward day", () => {
    // 2026-03-08 02:00 MST → 03:00 MDT; 10:00 MDT is 16:00 UTC
    expect(zonedToUtc("2026-03-08", "10:00", "America/Denver").toISOString()).toBe("2026-03-08T16:00:00.000Z");
  });
  it("reads local calendar dates", () => {
    expect(localDateStr(new Date("2026-01-16T03:00:00Z"), "America/Denver")).toBe("2026-01-15");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("validates zones and times", () => {
    expect(isValidTimeZone("America/Boise")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(parseHHMM("09:05")).toEqual({ h: 9, m: 5 });
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM("9:5")).toBeNull();
  });
});

const timed: ScheduledShape = {
  scheduledDate: "2026-02-10",
  scheduledTime: "15:00",
  timezone: "America/Denver",
  startsAt: zonedToUtc("2026-02-10", "15:00", "America/Denver"),
  status: "scheduled",
};
const dateOnly: ScheduledShape = {
  scheduledDate: "2026-02-10",
  scheduledTime: null,
  timezone: "America/Denver",
  startsAt: zonedToUtc("2026-02-10", null, "America/Denver"),
  status: "scheduled",
};

describe("reminder windows", () => {
  it("24h reminder for a timed meeting", () => {
    const start = timed.startsAt.getTime();
    expect(isDue(timed, "meeting_24h", new Date(start - 25 * H))).toBe(false);
    expect(isDue(timed, "meeting_24h", new Date(start - 23 * H))).toBe(true);
    expect(isDue(timed, "meeting_24h", new Date(start - 0.5 * H))).toBe(false);
  });
  it("1h reminder only exists when a time was given", () => {
    expect(reminderWindow(dateOnly, "meeting_1h")).toBeNull();
    const start = timed.startsAt.getTime();
    expect(isDue(timed, "meeting_1h", new Date(start - 0.5 * H))).toBe(true);
    expect(isDue(timed, "meeting_1h", new Date(start + 1))).toBe(false);
  });
  it("date-only meetings get a day-before reminder from 9am local, never an invented time", () => {
    // 2026-02-09 09:00 MST = 16:00Z
    expect(isDue(dateOnly, "meeting_24h", new Date("2026-02-09T15:59:00Z"))).toBe(false);
    expect(isDue(dateOnly, "meeting_24h", new Date("2026-02-09T16:00:00Z"))).toBe(true);
    expect(isDue(dateOnly, "meeting_24h", new Date("2026-02-10T08:00:00Z"))).toBe(false);
  });
  it("follow-up 2h after a timed meeting, next morning for date-only", () => {
    const start = timed.startsAt.getTime();
    expect(isDue(timed, "log_followup", new Date(start + 1 * H))).toBe(false);
    expect(isDue(timed, "log_followup", new Date(start + 3 * H))).toBe(true);
    expect(isDue(dateOnly, "log_followup", new Date("2026-02-11T16:30:00Z"))).toBe(true);
    expect(isDue(dateOnly, "log_followup", new Date("2026-02-10T20:00:00Z"))).toBe(false);
  });
  it("marks missed a week after the follow-up", () => {
    const start = timed.startsAt.getTime();
    expect(isDue(timed, "mark_missed", new Date(start + 2 * H + 6 * 24 * H))).toBe(false);
    expect(isDue(timed, "mark_missed", new Date(start + 2 * H + 7 * 24 * H))).toBe(true);
  });
  it("nothing is due once the meeting is completed or cancelled", () => {
    const start = timed.startsAt.getTime();
    expect(isDue({ ...timed, status: "completed" }, "meeting_24h", new Date(start - 2 * H))).toBe(false);
    expect(isDue({ ...timed, status: "cancelled" }, "log_followup", new Date(start + 3 * H))).toBe(false);
  });
  it("a log within 3 days fulfils the meeting", () => {
    expect(fulfils(timed, new Date(timed.startsAt.getTime() + 2 * 24 * H))).toBe(true);
    expect(fulfils(timed, new Date(timed.startsAt.getTime() - 4 * 24 * H))).toBe(false);
  });
});
