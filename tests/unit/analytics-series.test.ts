import { describe, it, expect } from "vitest";
import {
  participationByMonth,
  relationshipsByMonth,
  engagementMixByMonth,
  meetingsPerPairByMonth,
  healthHeatmap,
  weeklyCompletionHeatmap,
  stageHeatmap,
  pipelineByMonth,
  feedbackHeatmap,
  roiByMonth,
} from "@/lib/analytics-series";
import type { LogRow, MatchRow, StudentRow } from "@/lib/effectiveness";
import type { ExistingMilestone } from "@/lib/career";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const months = ["2026-04", "2026-05"];
let i = 0;
const match = (o: Partial<MatchRow>): MatchRow => ({
  id: `m${++i}`, mentorId: "t", menteeId: `s${i}`, status: "active", startedAt: d("2026-03-01"), endedAt: null, firstMeetingAt: null, lastInteractionAt: null, ...o,
});
const log = (o: Partial<LogRow>): LogRow => ({
  studentId: "s1", matchId: null, eventKind: "independent_activity", meetingDate: d("2026-04-10"), group: "career_tasks", isSystemGenerated: false, durationMinutes: null, ...o,
});
const student = (id: string, o: Partial<StudentRow> = {}): StudentRow => ({
  id, major: "Accounting", department: "Accounting", podName: null, cohort: "Winter 2026", createdAt: d("2026-01-01"), ...o,
});

describe("participation and relationships", () => {
  it("counts students with their own activity, never system logs", () => {
    const out = participationByMonth(
      [student("s1"), student("s2", { createdAt: d("2026-05-03") })],
      [log({}), log({ studentId: "s2", isSystemGenerated: true, eventKind: "system_event" }), log({ meetingDate: d("2026-05-02") })],
      months
    );
    expect(out).toEqual([
      { label: "Apr", active: 1, joined: 0 },
      { label: "May", active: 1, joined: 1 },
    ]);
  });
  it("active pairs are those still active at month end", () => {
    const out = relationshipsByMonth([match({}), match({ startedAt: d("2026-04-05"), endedAt: d("2026-04-20") })], months);
    expect(out[0]).toEqual({ label: "Apr", active: 1, started: 1 });
  });
});

describe("engagement mix", () => {
  it("classifies each active pair by its best interaction; independent activity is 'quiet'", () => {
    const a = match({});
    const b = match({});
    const c = match({});
    const out = engagementMixByMonth(
      [a, b, c],
      [
        log({ matchId: a.id, eventKind: "mentor_meeting" }),
        log({ matchId: b.id, eventKind: "touchpoint" }),
        log({ matchId: c.id, eventKind: "independent_activity" }),
      ],
      ["2026-04"]
    );
    expect(out[0]).toMatchObject({ met: 1, touchpoint: 1, quiet: 1, metPct: 33 });
  });
  it("months with no pairs are null, not zero", () => {
    expect(engagementMixByMonth([], [], ["2026-04"])[0].metPct).toBeNull();
    expect(meetingsPerPairByMonth([], [], ["2026-04"])[0].perPair).toBeNull();
  });
});

describe("heatmaps", () => {
  it("health cells are null where a group had no active pairs", () => {
    const a = match({ menteeId: "x" });
    const rows = healthHeatmap([a], [log({ matchId: a.id, eventKind: "mentor_meeting", meetingDate: d("2026-05-02") })], () => "Accounting", ["2026-02", "2026-05"]);
    expect(rows[0].cells[0]).toEqual({ value: null, n: 0, note: "no active pairs" });
    expect(rows[0].cells[1]).toEqual({ value: 100, n: 1 });
  });
  it("weekly completion suppresses groups below 5 students", () => {
    const now = d("2026-06-15");
    const big = ["a", "b", "c", "d", "e"].map((id) => student(id));
    const small = [student("z", { department: "Communication" })];
    const { rows, columns } = weeklyCompletionHeatmap([...big, ...small], [log({ studentId: "a", meetingDate: d("2026-06-09") })], now, 2, (s) => s.department);
    expect(columns).toHaveLength(2);
    expect(rows.find((r) => r.label === "Communication")!.cells.every((c) => c.value === null)).toBe(true);
    expect(rows.find((r) => r.label === "Accounting")!.cells[1]).toEqual({ value: 20, n: 5 });
  });
  it("stage heatmap places each student once per month by latest stage", () => {
    const ms: ExistingMilestone[] = [
      { id: "1", studentId: "a", stage: "applying", opportunityType: null, occurredOn: d("2026-04-02") },
      { id: "2", studentId: "a", stage: "interviewing", opportunityType: null, occurredOn: d("2026-05-02") },
    ];
    const rows = stageHeatmap(ms, months);
    expect(rows.find((r) => r.stage === "applying")!.cells).toEqual([1, 0]);
    expect(rows.find((r) => r.stage === "interviewing")!.cells).toEqual([0, 1]);
  });
  it("feedback months with fewer than 5 responses are hidden", () => {
    const fb = Array.from({ length: 5 }, (_, k) => ({ matchId: "m", role: "mentee", rating: k < 3 ? 5 : 4, year: 2026, month: 5 }));
    const rows = feedbackHeatmap([...fb, { matchId: "m", role: "mentee", rating: 2, year: 2026, month: 4 }], months);
    expect(rows[0].cells[0].value).toBeNull();
    expect(rows[0].cells[1]).toEqual({ value: 3, n: 5 });
  });
});

describe("pipeline and ROI", () => {
  it("counts each offer once, by type, and verified separately", () => {
    const ms = [
      { id: "o1", studentId: "a", stage: "offer_received", opportunityType: "internship", occurredOn: d("2026-04-03"), verification: "verified" },
      { id: "o2", studentId: "b", stage: "offer_received", opportunityType: "full_time", occurredOn: d("2026-04-04") },
      { id: "x", studentId: "c", stage: "interviewing", opportunityType: null, occurredOn: d("2026-04-05") },
    ];
    const [apr] = pipelineByMonth(ms, [d("2026-04-06")], ["2026-04"]);
    expect(apr).toMatchObject({ applications: 1, interviews: 1, internship: 1, full_time: 1, part_time: 0, verified: 1 });
  });
  it("tracked hours come from interactions only; modeled savings accumulate", () => {
    const out = roiByMonth(
      [log({ eventKind: "mentor_meeting", durationMinutes: 90 }), log({ eventKind: "independent_activity", durationMinutes: 600 })],
      [{ month: "2026-04", kind: "reminder", n: 20 }, { month: "2026-05", kind: "followup", n: 12 }],
      months,
      3,
      5
    );
    expect(out[0]).toMatchObject({ hours: 1.5, reminders: 20, savedHours: 1, cumulativeSavedHours: 1 });
    expect(out[1]).toMatchObject({ followups: 12, savedHours: 1, cumulativeSavedHours: 2 });
  });
});
