import { describe, it, expect } from "vitest";
import { computeRoi, executiveSummary, toMetricCsv, trackedMentorship, pct } from "@/lib/program-report";
import { DEFAULT_ROI, DEFAULT_THRESHOLDS } from "@/lib/program-settings";
import type { LogRow, MatchRow, StudentRow } from "@/lib/effectiveness";

const now = new Date("2026-06-15T12:00:00Z");
const range = { start: new Date("2026-06-01"), end: new Date("2026-07-01") };
const log = (o: Partial<LogRow>): LogRow => ({
  studentId: "s1",
  matchId: "m1",
  eventKind: "mentor_meeting",
  meetingDate: new Date("2026-06-10"),
  group: null,
  isSystemGenerated: false,
  durationMinutes: 30,
  ...o,
});

describe("computeRoi", () => {
  it("keeps tracked numbers and modeled estimates apart, showing the math", () => {
    const r = computeRoi(
      {
        loggedMinutes: 150,
        interactionsLogged: 5,
        interactionsWithoutDuration: 1,
        remindersDelivered: 20,
        followUpsDelivered: 6,
        followUpTasksCompleted: 4,
        interventionsRecorded: 3,
        casesResolved: 2,
      },
      { ...DEFAULT_ROI, minutesPerReminder: 3, minutesPerFollowUp: 5, staffHourlyCost: 30, minutesPerIntervention: 20 }
    );
    expect(r.tracked.mentorshipHours).toBe(2.5);
    expect(r.modeled.staffMinutesSaved).toBe(90);
    expect(r.modeled.staffHoursSaved).toBe(1.5);
    expect(r.modeled.staffCostSaved).toBe(45);
    expect(r.modeled.interventionStaffHours).toBe(1);
    expect(r.modeled.mentorshipValue).toBeNull();
    expect(r.formulas[0]).toContain("20 reminders × 3 min");
  });
  it("only shows a mentorship dollar value when one is configured", () => {
    const r = computeRoi(
      { loggedMinutes: 120, interactionsLogged: 2, interactionsWithoutDuration: 0, remindersDelivered: 0, followUpsDelivered: 0, followUpTasksCompleted: 0, interventionsRecorded: 0, casesResolved: 0 },
      { ...DEFAULT_ROI, mentorHourValue: 50 }
    );
    expect(r.modeled.mentorshipValue).toBe(100);
  });
});

describe("trackedMentorship", () => {
  it("sums only interactions in range and counts missing durations", () => {
    const t = trackedMentorship(
      [
        log({}),
        log({ eventKind: "touchpoint", durationMinutes: null }),
        log({ eventKind: "independent_activity", durationMinutes: 60 }),
        log({ meetingDate: new Date("2026-05-01") }),
      ],
      range
    );
    expect(t).toEqual({ loggedMinutes: 30, interactionsLogged: 2, interactionsWithoutDuration: 1 });
  });
});

describe("executiveSummary", () => {
  it("counts meetings in period, never activities, and scopes intervention students", () => {
    const students: StudentRow[] = [{ id: "s1", major: null, department: "x", podName: null, cohort: "c", createdAt: new Date("2025-01-01") }];
    const matches: MatchRow[] = [
      { id: "m1", mentorId: "t", menteeId: "s1", status: "active", startedAt: new Date("2026-05-01"), endedAt: null, firstMeetingAt: new Date("2026-05-03"), lastInteractionAt: new Date("2026-06-10") },
    ];
    const s = executiveSummary({
      students,
      matches,
      logs: [log({}), log({ eventKind: "independent_activity" }), log({ eventKind: "system_event" })],
      milestones: [{ id: "o", studentId: "s1", stage: "offer_received", opportunityType: "internship", occurredOn: new Date("2026-06-05") }],
      openInterventionStudents: new Set(["s1", "other-school-student"]),
      range,
      now,
      thresholds: DEFAULT_THRESHOLDS,
    });
    expect(s.meetingsInPeriod).toBe(1);
    expect(s.studentsNeedingIntervention).toBe(1);
    expect(s.internshipsReported).toBe(1);
    expect(s.firstMeeting30.pct).toBeNull(); // only 1 match → not enough data
    expect(s.health.healthy).toBe(1);
  });
});

describe("CSV", () => {
  it("guards against formula injection and labels insufficient data", () => {
    const csv = toMetricCsv("ICAN", [["=cmd()", 1], ["Rate", pct({ num: 1, den: 2, pct: null })]]);
    expect(csv).toContain("'=cmd()");
    expect(csv).toContain("insufficient data (n=2)");
  });
});
