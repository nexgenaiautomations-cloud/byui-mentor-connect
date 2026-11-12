import { describe, it, expect } from "vitest";
import {
  rate,
  termOf,
  firstMeetingByCohort,
  firstMeetingOverall,
  retainedAt,
  retentionOverall,
  healthOf,
  engagementHeatmap,
  meetingConsistency,
  workloadVsEngagement,
  weeklyTaskCompletion,
  industryExperienceProgress,
  pledgeByGroup,
  outcomesByEngagement,
  feedbackTrends,
  type MatchRow,
  type LogRow,
  type StudentRow,
} from "@/lib/effectiveness";
import { DEFAULT_THRESHOLDS } from "@/lib/program-settings";
import type { ExistingMilestone } from "@/lib/career";

const now = new Date("2026-06-15T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const at = (start: Date, days: number) => new Date(start.getTime() + days * 86400000);

let seq = 0;
const match = (o: Partial<MatchRow> = {}): MatchRow => ({
  id: `m${++seq}`,
  mentorId: "mentor1",
  menteeId: `s${seq}`,
  status: "active",
  startedAt: daysAgo(60),
  endedAt: null,
  firstMeetingAt: null,
  lastInteractionAt: null,
  ...o,
});
const log = (o: Partial<LogRow>): LogRow => ({
  studentId: "s",
  matchId: null,
  eventKind: "mentor_meeting",
  meetingDate: now,
  group: "career_tasks",
  isSystemGenerated: false,
  durationMinutes: null,
  ...o,
});
const student = (id: string, o: Partial<StudentRow> = {}): StudentRow => ({
  id,
  major: "Accounting",
  department: "Business",
  podName: null,
  cohort: "Winter 2026",
  createdAt: new Date("2025-01-01"),
  ...o,
});

describe("rate", () => {
  it("suppresses small denominators", () => {
    expect(rate(1, 4).pct).toBeNull();
    expect(rate(1, 5).pct).toBe(20);
    expect(rate(0, 0, 1).pct).toBeNull();
  });
});

describe("termOf", () => {
  it("maps months to BYU-I style terms", () => {
    expect(termOf(new Date("2026-02-01"))).toBe("Winter 2026");
    expect(termOf(new Date("2026-06-01"))).toBe("Spring 2026");
    expect(termOf(new Date("2026-10-01"))).toBe("Fall 2026");
  });
});

describe("first meeting", () => {
  it("excludes matches too young for the window from the denominator", () => {
    const start = daysAgo(10);
    const ms = Array.from({ length: 5 }, () => match({ startedAt: start, firstMeetingAt: at(start, 3) }));
    const r = firstMeetingOverall(ms, now, 7);
    expect(r).toEqual({ num: 5, den: 5, pct: 100 });
    expect(firstMeetingOverall(ms, now, 14).den).toBe(0);
  });
  it("counts only meetings inside the window", () => {
    const start = daysAgo(40);
    const ms = [
      ...Array.from({ length: 3 }, () => match({ startedAt: start, firstMeetingAt: at(start, 5) })),
      match({ startedAt: start, firstMeetingAt: at(start, 20) }),
      match({ startedAt: start, firstMeetingAt: null }),
    ];
    const [c] = firstMeetingByCohort(ms, now, ["2026-05"]);
    expect(c.windows[7]).toEqual({ num: 3, den: 5, pct: 60 });
    expect(c.windows[30]).toEqual({ num: 4, den: 5, pct: 80 });
  });
});

describe("retention", () => {
  it("requires an interaction in the window, not just active status", () => {
    const m = match({ startedAt: daysAgo(100) });
    expect(retainedAt(m, [at(m.startedAt, 25)], 30)).toBe(true);
    expect(retainedAt(m, [at(m.startedAt, 25)], 60)).toBe(false);
    expect(retainedAt(m, [at(m.startedAt, 45)], 60)).toBe(true);
  });
  it("ignores independent activity", () => {
    const ms = Array.from({ length: 5 }, () => match({ startedAt: daysAgo(100) }));
    const logs = ms.map((m) => log({ matchId: m.id, eventKind: "independent_activity", meetingDate: at(m.startedAt, 20) }));
    expect(retentionOverall(ms, logs, now, 30)).toEqual({ num: 0, den: 5, pct: 0 });
    const meetings = ms.map((m) => log({ matchId: m.id, eventKind: "touchpoint", meetingDate: at(m.startedAt, 20) }));
    expect(retentionOverall(ms, meetings, now, 30).pct).toBe(100);
  });
});

describe("health + heatmap", () => {
  const t = DEFAULT_THRESHOLDS;
  it("classifies by the last real interaction", () => {
    expect(healthOf(match({ firstMeetingAt: daysAgo(10), lastInteractionAt: daysAgo(10) }), now, t)).toBe("healthy");
    expect(healthOf(match({ firstMeetingAt: daysAgo(40), lastInteractionAt: daysAgo(40) }), now, t)).toBe("needs_attention");
    expect(healthOf(match({ startedAt: daysAgo(200), firstMeetingAt: daysAgo(90), lastInteractionAt: daysAgo(90) }), now, t)).toBe("inactive");
    expect(healthOf(match({ startedAt: daysAgo(9) }), now, t)).toBe("needs_attention");
  });
  it("heatmap cells count pairs active in the month that interacted in it", () => {
    const a = match({ menteeId: "a", startedAt: new Date("2026-04-01") });
    const b = match({ menteeId: "b", startedAt: new Date("2026-04-01") });
    const logs = [log({ matchId: a.id, eventKind: "mentor_meeting", meetingDate: new Date("2026-05-10") }), log({ matchId: b.id, eventKind: "independent_activity", meetingDate: new Date("2026-05-10") })];
    const [row] = engagementHeatmap([a, b], logs, () => "Business", ["2026-05"]);
    expect(row.cells[0]).toEqual({ month: "2026-05", active: 2, engaged: 1, pct: 50 });
  });
});

describe("meeting consistency", () => {
  it("excludes touchpoints, independent and system logs from meeting counts", () => {
    const a = match({ menteeId: "a" });
    const logs = [
      log({ matchId: a.id, eventKind: "mentor_meeting", meetingDate: daysAgo(40) }),
      log({ matchId: a.id, eventKind: "mentor_meeting", meetingDate: daysAgo(10) }),
      log({ matchId: a.id, eventKind: "touchpoint", meetingDate: daysAgo(5) }),
      log({ matchId: a.id, eventKind: "independent_activity", meetingDate: daysAgo(4) }),
      log({ matchId: a.id, eventKind: "system_event", meetingDate: daysAgo(3) }),
    ];
    const c = meetingConsistency([a, match({ menteeId: "b" })], logs, now, 30);
    expect(c.totalMeetings).toBe(2);
    expect(c.meetingsPerStudent).toBe(1);
    expect(c.avgDaysBetweenMeetings).toBe(30);
    expect(c.noMeetingYet).toEqual({ num: 1, den: 2, pct: 50 });
  });
  it("groups mentors by load", () => {
    const w = workloadVsEngagement(
      [match({ mentorId: "x", lastInteractionAt: daysAgo(3) }), match({ mentorId: "x" }), match({ mentorId: "y", lastInteractionAt: daysAgo(3) })],
      now
    );
    expect(w).toEqual([
      { label: "1 mentee", mentors: 1, pairs: 1, engaged: { num: 1, den: 1, pct: 100 } },
      { label: "2 mentees", mentors: 1, pairs: 2, engaged: { num: 1, den: 2, pct: 50 } },
    ]);
  });
});

describe("3-2-1 pledge", () => {
  const students = ["a", "b", "c", "d", "e"].map((id) => student(id));
  it("weekly completion ignores system auto-logs and uses completed weeks", () => {
    const lastWeek = daysAgo(7);
    const logs = [
      log({ studentId: "a", group: "career_tasks", eventKind: "independent_activity", meetingDate: lastWeek }),
      log({ studentId: "b", group: "career_tasks", eventKind: "system_event", isSystemGenerated: true, meetingDate: lastWeek }),
    ];
    const [w] = weeklyTaskCompletion(students, logs, now, 1);
    expect(w.rate).toEqual({ num: 1, den: 5, pct: 20 });
  });
  it("industry experiences come from distinct offers, not generic activity", () => {
    const ms: ExistingMilestone[] = [
      { id: "1", studentId: "a", stage: "offer_received", opportunityType: "internship", occurredOn: now },
      { id: "2", studentId: "a", stage: "offer_accepted", opportunityType: "internship", relatedMilestoneId: "1", occurredOn: now },
      { id: "3", studentId: "a", stage: "offer_received", opportunityType: "full_time", occurredOn: now },
      { id: "4", studentId: "b", stage: "applying", opportunityType: null, occurredOn: now },
    ];
    const p = industryExperienceProgress(students, ms);
    expect(p.perStudent.get("a")).toBe(2);
    expect(p.perStudent.get("b")).toBe(0);
    expect(p.distribution).toEqual({ none: 4, one: 0, twoPlus: 1 });
  });
  it("suppresses groups smaller than 5", () => {
    const rows = pledgeByGroup([...students, student("z", { major: "Art", department: "Arts" })], [], [], now, (s) => s.department);
    expect(rows.find((r) => r.group === "Arts")).toMatchObject({ students: 1, suppressed: true, onTrack: null });
    expect(rows.find((r) => r.group === "Business")?.suppressed).toBe(false);
  });
});

describe("outcomes by engagement", () => {
  it("is descriptive, suppresses small groups and needs 5 offers for an average", () => {
    const students = Array.from({ length: 6 }, (_, i) => student(`s${i}`));
    const matches = students.slice(0, 5).map((s) => match({ menteeId: s.id }));
    const logs = matches.flatMap((m) => [1, 2, 3].map((d) => log({ studentId: m.menteeId, matchId: m.id, eventKind: "mentor_meeting", meetingDate: daysAgo(d * 10) })));
    const ms: ExistingMilestone[] = [{ id: "o", studentId: "s0", stage: "offer_received", opportunityType: "internship", occurredOn: daysAgo(1) }];
    const r = outcomesByEngagement(students, matches, logs, ms);
    expect(r.engaged).toMatchObject({ students: 5, suppressed: false, withOffer: { num: 1, den: 5, pct: 20 } });
    expect(r.unmatched).toMatchObject({ students: 1, suppressed: true, withOffer: null });
    expect(r.avgMeetingsBeforeFirstOffer).toBeNull();
    expect(r.offersObserved).toBe(1);
  });
});

describe("feedback trends", () => {
  it("suppresses averages under 5 responses and compares engaged vs not", () => {
    const m = match({ startedAt: new Date("2026-01-01") });
    const fb = Array.from({ length: 5 }, () => ({ matchId: m.id, role: "mentee", rating: 4, year: 2026, month: 5 }));
    const r = feedbackTrends(fb, [m], [log({ matchId: m.id, eventKind: "mentor_meeting", meetingDate: new Date("2026-05-05") })], ["2026-04", "2026-05"]);
    expect(r.byMonth[1]).toEqual({ month: "2026-05", responses: 5, expected: 1, avg: 4 });
    expect(r.byMonth[0].avg).toBeNull();
    expect(r.vsEngagement.interacted).toEqual({ n: 5, avg: 4 });
    expect(r.vsEngagement.noInteraction.avg).toBeNull();
    expect(feedbackTrends(fb.slice(0, 2), [m], [], ["2026-05"]).distribution).toBeNull();
  });
});
