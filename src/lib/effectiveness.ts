// Program-effectiveness metrics — pure, unit-tested. The server loader
// (effectiveness-server.ts) fetches school-scoped rows and calls these.
// Definitions: docs/specs/accountability-upgrade.md §6. Rules that hold
// everywhere here:
//   * only mentor_meeting rows are meetings; meeting + touchpoint are
//     interactions; independent and system rows never count as engagement
//   * a rate whose denominator is below MIN_DENOMINATOR is null ("—")
//   * feedback / outcome groups smaller than K_ANON students are suppressed
import { DAY_MS, interactionReference, isInteraction, isMeeting, type EventKind } from "@/lib/engagement";
import { countOffers, type ExistingMilestone } from "@/lib/career";
import { monthRangeForDate, weekRangeForDate } from "@/lib/kpis";
import type { Thresholds } from "@/lib/program-settings";

export const K_ANON = 5;
export const MIN_DENOMINATOR = 5;

export type Rate = { num: number; den: number; pct: number | null };
export function rate(num: number, den: number, minDen = MIN_DENOMINATOR): Rate {
  return { num, den, pct: den >= minDen && den > 0 ? Math.round((num / den) * 1000) / 10 : null };
}

export type StudentRow = {
  id: string;
  major: string | null;
  department: string;
  podName: string | null;
  cohort: string;
  createdAt: Date;
};
export type MatchRow = {
  id: string;
  mentorId: string;
  menteeId: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  firstMeetingAt: Date | null;
  lastInteractionAt: Date | null;
};
export type LogRow = {
  studentId: string | null;
  matchId: string | null;
  eventKind: EventKind | null;
  meetingDate: Date;
  group: "career_tasks" | "industry_experiences" | "career_chats" | null;
  isSystemGenerated: boolean;
  durationMinutes: number | null;
};
export type FeedbackRow = { matchId: string; role: string; rating: number; year: number; month: number };

// ---- Cohorts ----

// BYU-Idaho style terms: Winter (Jan–Apr), Spring (May–Aug), Fall (Sep–Dec).
export function termOf(d: Date): string {
  const m = d.getUTCMonth();
  const term = m < 4 ? "Winter" : m < 8 ? "Spring" : "Fall";
  return `${term} ${d.getUTCFullYear()}`;
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string, withYear = false): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    ...(withYear ? { year: "2-digit" } : {}),
    timeZone: "UTC",
  });
}

export function lastMonthKeys(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

// ---- First meeting ----

export const FIRST_MEETING_WINDOWS = [7, 14, 30] as const;

// Per cohort (month the match started): of matches at least N days old,
// how many had their first meeting within N days. Matches too young to have
// reached N days are left out of that window's denominator.
export function firstMeetingByCohort(matches: MatchRow[], now: Date, cohorts: string[]) {
  return cohorts.map((cohort) => {
    const inCohort = matches.filter((m) => monthKey(m.startedAt) === cohort);
    const windows = {} as Record<(typeof FIRST_MEETING_WINDOWS)[number], Rate>;
    for (const n of FIRST_MEETING_WINDOWS) {
      const mature = inCohort.filter((m) => now.getTime() - m.startedAt.getTime() >= n * DAY_MS);
      const hit = mature.filter(
        (m) => m.firstMeetingAt && m.firstMeetingAt.getTime() - m.startedAt.getTime() <= n * DAY_MS
      );
      windows[n] = rate(hit.length, mature.length);
    }
    return { cohort, matches: inCohort.length, windows };
  });
}

export function firstMeetingOverall(matches: MatchRow[], now: Date, n: number): Rate {
  const mature = matches.filter((m) => now.getTime() - m.startedAt.getTime() >= n * DAY_MS);
  const hit = mature.filter(
    (m) => m.firstMeetingAt && m.firstMeetingAt.getTime() - m.startedAt.getTime() <= n * DAY_MS
  );
  return rate(hit.length, mature.length);
}

// ---- Retention ----

export const RETENTION_POINTS = [30, 60, 90] as const;

function interactionDatesByMatch(logs: LogRow[]): Map<string, Date[]> {
  const out = new Map<string, Date[]>();
  for (const l of logs) {
    if (!l.matchId || !isInteraction(l.eventKind)) continue;
    const list = out.get(l.matchId) ?? [];
    list.push(l.meetingDate);
    out.set(l.matchId, list);
  }
  return out;
}

// Retained at N days = the pair actually interacted in the 30 days leading
// up to day N of the match. Status "active" alone is not retention.
export function retainedAt(m: MatchRow, dates: Date[], n: number): boolean {
  const lo = m.startedAt.getTime() + (n - 30) * DAY_MS;
  const hi = m.startedAt.getTime() + n * DAY_MS;
  return dates.some((d) => d.getTime() > lo && d.getTime() <= hi);
}

export function retentionByCohort(matches: MatchRow[], logs: LogRow[], now: Date, cohorts: string[]) {
  const dates = interactionDatesByMatch(logs);
  return cohorts.map((cohort) => {
    const inCohort = matches.filter((m) => monthKey(m.startedAt) === cohort);
    const points = {} as Record<(typeof RETENTION_POINTS)[number], Rate>;
    for (const n of RETENTION_POINTS) {
      const mature = inCohort.filter((m) => now.getTime() - m.startedAt.getTime() >= n * DAY_MS);
      points[n] = rate(mature.filter((m) => retainedAt(m, dates.get(m.id) ?? [], n)).length, mature.length);
    }
    return { cohort, matches: inCohort.length, points };
  });
}

export function retentionOverall(matches: MatchRow[], logs: LogRow[], now: Date, n: number): Rate {
  const dates = interactionDatesByMatch(logs);
  const mature = matches.filter((m) => now.getTime() - m.startedAt.getTime() >= n * DAY_MS);
  return rate(mature.filter((m) => retainedAt(m, dates.get(m.id) ?? [], n)).length, mature.length);
}

// ---- Health ----

export type Health = "healthy" | "needs_attention" | "inactive";

export function healthOf(m: MatchRow, now: Date, t: Thresholds): Health {
  const days = (now.getTime() - interactionReference(m).getTime()) / DAY_MS;
  if (days >= t.adminAttentionDays) return "inactive";
  if (!m.firstMeetingAt && (now.getTime() - m.startedAt.getTime()) / DAY_MS >= t.firstMeetingNudgeDays) {
    return "needs_attention";
  }
  if (days > t.expectedMeetingIntervalDays) return "needs_attention";
  return "healthy";
}

export function healthCounts(matches: MatchRow[], now: Date, t: Thresholds): Record<Health, number> {
  const out: Record<Health, number> = { healthy: 0, needs_attention: 0, inactive: 0 };
  for (const m of matches) if (m.status === "active") out[healthOf(m, now, t)] += 1;
  return out;
}

// Rows = groups, columns = months; cell = share of pairs active during the
// month that interacted in that month. `n` is shown so tiny cells read right.
export function engagementHeatmap(
  matches: MatchRow[],
  logs: LogRow[],
  groupOfMentee: (menteeId: string) => string,
  months: string[]
) {
  const dates = interactionDatesByMatch(logs);
  const groups = new Map<string, Map<string, { active: number; engaged: number }>>();
  for (const m of matches) {
    const g = groupOfMentee(m.menteeId);
    const row = groups.get(g) ?? new Map();
    for (const key of months) {
      const [y, mo] = key.split("-").map(Number);
      const start = Date.UTC(y, mo - 1, 1);
      const end = Date.UTC(y, mo, 1);
      const activeInMonth =
        m.startedAt.getTime() < end && (!m.endedAt || m.endedAt.getTime() >= start);
      if (!activeInMonth) continue;
      const cell = row.get(key) ?? { active: 0, engaged: 0 };
      cell.active += 1;
      if ((dates.get(m.id) ?? []).some((d) => d.getTime() >= start && d.getTime() < end)) cell.engaged += 1;
      row.set(key, cell);
    }
    groups.set(g, row);
  }
  return [...groups.entries()]
    .map(([group, row]) => ({
      group,
      cells: months.map((key) => {
        const c = row.get(key) ?? { active: 0, engaged: 0 };
        return { month: key, active: c.active, engaged: c.engaged, pct: c.active ? Math.round((c.engaged / c.active) * 100) : null };
      }),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

// ---- Meeting consistency ----

export function meetingConsistency(
  matches: MatchRow[],
  logs: LogRow[],
  now: Date,
  expectedIntervalDays: number
) {
  const meetingsByMatch = new Map<string, Date[]>();
  for (const l of logs) {
    if (!l.matchId || !isMeeting(l.eventKind)) continue;
    const list = meetingsByMatch.get(l.matchId) ?? [];
    list.push(l.meetingDate);
    meetingsByMatch.set(l.matchId, list);
  }
  const active = matches.filter((m) => m.status === "active");
  const totalMeetings = [...meetingsByMatch.values()].reduce((s, l) => s + l.length, 0);
  const students = new Set(matches.map((m) => m.menteeId));

  const gaps: number[] = [];
  for (const list of meetingsByMatch.values()) {
    const sorted = [...list].sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / DAY_MS);
  }

  // On cadence: over the last 90 days of the pair's life (or since it
  // started), at least one meeting per expected interval.
  const mature = active.filter((m) => now.getTime() - m.startedAt.getTime() >= expectedIntervalDays * DAY_MS);
  const onCadence = mature.filter((m) => {
    const windowDays = Math.min(90, (now.getTime() - m.startedAt.getTime()) / DAY_MS);
    const need = Math.max(1, Math.floor(windowDays / expectedIntervalDays));
    const since = now.getTime() - windowDays * DAY_MS;
    return (meetingsByMatch.get(m.id) ?? []).filter((d) => d.getTime() >= since).length >= need;
  });

  return {
    totalMeetings,
    meetingsPerStudent: students.size ? Math.round((totalMeetings / students.size) * 10) / 10 : null,
    meetingsPerActiveMatch: active.length
      ? Math.round((active.reduce((s, m) => s + (meetingsByMatch.get(m.id)?.length ?? 0), 0) / active.length) * 10) / 10
      : null,
    avgDaysBetweenMeetings: gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null,
    onCadence: rate(onCadence.length, mature.length),
    noMeetingYet: rate(active.filter((m) => !(meetingsByMatch.get(m.id)?.length)).length, active.length, 1),
  };
}

// Mentor load vs how many of their pairs interacted in the last 30 days.
export function workloadVsEngagement(matches: MatchRow[], now: Date) {
  const byMentor = new Map<string, MatchRow[]>();
  for (const m of matches) {
    if (m.status !== "active") continue;
    const list = byMentor.get(m.mentorId) ?? [];
    list.push(m);
    byMentor.set(m.mentorId, list);
  }
  const buckets = new Map<string, { mentors: number; pairs: number; engaged: number }>();
  for (const list of byMentor.values()) {
    const label = list.length >= 5 ? "5+ mentees" : `${list.length} mentee${list.length === 1 ? "" : "s"}`;
    const b = buckets.get(label) ?? { mentors: 0, pairs: 0, engaged: 0 };
    b.mentors += 1;
    b.pairs += list.length;
    b.engaged += list.filter((m) => m.lastInteractionAt && now.getTime() - m.lastInteractionAt.getTime() <= 30 * DAY_MS).length;
    buckets.set(label, b);
  }
  const order = ["1 mentee", "2 mentees", "3 mentees", "4 mentees", "5+ mentees"];
  return order
    .filter((l) => buckets.has(l))
    .map((label) => {
      const b = buckets.get(label)!;
      return { label, mentors: b.mentors, pairs: b.pairs, engaged: rate(b.engaged, b.pairs, 1) };
    });
}

// ---- 3-2-1 pledge ----

// Student-generated logs only: system auto-logs restate a goal, they aren't
// a separate activity.
function studentLogs(logs: LogRow[]) {
  return logs.filter((l) => !l.isSystemGenerated && l.eventKind !== "system_event" && l.studentId);
}

export function weeklyTaskCompletion(students: StudentRow[], logs: LogRow[], now: Date, weeks: number) {
  const out: { weekStart: Date; rate: Rate }[] = [];
  const own = studentLogs(logs).filter((l) => l.group === "career_tasks");
  for (let i = weeks; i >= 1; i--) {
    // Completed weeks only (i >= 1), so the current partial week never drags the trend down.
    const ref = new Date(now.getTime() - i * 7 * DAY_MS);
    const { start, end } = weekRangeForDate(ref);
    const eligible = students.filter((s) => s.createdAt < end);
    const done = new Set(own.filter((l) => l.meetingDate >= start && l.meetingDate < end).map((l) => l.studentId!));
    out.push({ weekStart: start, rate: rate(eligible.filter((s) => done.has(s.id)).length, eligible.length) });
  }
  return out;
}

export function monthlyChatCompletion(students: StudentRow[], logs: LogRow[], now: Date, months: number) {
  const out: { month: string; rate: Rate }[] = [];
  const chats = studentLogs(logs).filter((l) => l.group === "career_chats");
  for (let i = months; i >= 1; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 15);
    const { start, end } = monthRangeForDate(ref);
    const eligible = students.filter((s) => s.createdAt < end);
    const count = new Map<string, number>();
    for (const l of chats) if (l.meetingDate >= start && l.meetingDate < end) count.set(l.studentId!, (count.get(l.studentId!) ?? 0) + 1);
    out.push({
      month: monthKey(new Date(Date.UTC(start.getFullYear(), start.getMonth(), 1))),
      rate: rate(eligible.filter((s) => (count.get(s.id) ?? 0) >= 3).length, eligible.length),
    });
  }
  return out;
}

// Industry experiences = distinct internship/job offers (never generic
// career activity), de-duplicated through career milestones.
export function industryExperienceProgress(students: StudentRow[], milestones: ExistingMilestone[]) {
  const per = new Map<string, number>();
  const byStudent = new Map<string, ExistingMilestone[]>();
  for (const m of milestones) {
    const list = byStudent.get(m.studentId) ?? [];
    list.push(m);
    byStudent.set(m.studentId, list);
  }
  for (const s of students) {
    const c = countOffers(byStudent.get(s.id) ?? []);
    per.set(s.id, c.internship + c.part_time + c.full_time);
  }
  const dist = { none: 0, one: 0, twoPlus: 0 };
  for (const s of students) {
    const n = per.get(s.id) ?? 0;
    if (n === 0) dist.none++;
    else if (n === 1) dist.one++;
    else dist.twoPlus++;
  }
  return { distribution: dist, twoPlus: rate(dist.twoPlus, students.length), perStudent: per };
}

// "On track" with 3-2-1 right now: a career task in at least 3 of the last 4
// completed weeks and 3+ career chats last full month.
export function pledgeOnTrack(students: StudentRow[], logs: LogRow[], now: Date): Set<string> {
  const own = studentLogs(logs);
  const weeksHit = new Map<string, number>();
  for (let i = 1; i <= 4; i++) {
    const { start, end } = weekRangeForDate(new Date(now.getTime() - i * 7 * DAY_MS));
    const done = new Set(own.filter((l) => l.group === "career_tasks" && l.meetingDate >= start && l.meetingDate < end).map((l) => l.studentId!));
    for (const id of done) weeksHit.set(id, (weeksHit.get(id) ?? 0) + 1);
  }
  const { start, end } = monthRangeForDate(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  const chats = new Map<string, number>();
  for (const l of own) if (l.group === "career_chats" && l.meetingDate >= start && l.meetingDate < end) chats.set(l.studentId!, (chats.get(l.studentId!) ?? 0) + 1);
  return new Set(students.filter((s) => (weeksHit.get(s.id) ?? 0) >= 3 && (chats.get(s.id) ?? 0) >= 3).map((s) => s.id));
}

// Breakdown by a student attribute with k-anonymity suppression.
export function pledgeByGroup(
  students: StudentRow[],
  logs: LogRow[],
  milestones: ExistingMilestone[],
  now: Date,
  key: (s: StudentRow) => string
) {
  const onTrack = pledgeOnTrack(students, logs, now);
  const industry = industryExperienceProgress(students, milestones).perStudent;
  const groups = new Map<string, StudentRow[]>();
  for (const s of students) {
    const g = key(s);
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([group, list]) => {
      const suppressed = list.length < K_ANON;
      return {
        group,
        students: list.length,
        suppressed,
        onTrack: suppressed ? null : rate(list.filter((s) => onTrack.has(s.id)).length, list.length),
        twoPlusIndustry: suppressed ? null : rate(list.filter((s) => (industry.get(s.id) ?? 0) >= 2).length, list.length),
      };
    })
    .sort((a, b) => b.students - a.students);
}

// ---- Outcomes vs engagement (descriptive only) ----

export const ENGAGED_MEETINGS = 3;

export function outcomesByEngagement(
  students: StudentRow[],
  matches: MatchRow[],
  logs: LogRow[],
  milestones: ExistingMilestone[]
) {
  const meetingsByStudent = new Map<string, Date[]>();
  for (const l of logs) {
    if (!isMeeting(l.eventKind) || !l.studentId) continue;
    meetingsByStudent.set(l.studentId, [...(meetingsByStudent.get(l.studentId) ?? []), l.meetingDate]);
  }
  const matched = new Set(matches.map((m) => m.menteeId));
  const firstOffer = new Map<string, Date>();
  for (const m of milestones) {
    if (!["offer_received", "offer_accepted", "started"].includes(String(m.stage))) continue;
    const prev = firstOffer.get(m.studentId);
    if (!prev || m.occurredOn < prev) firstOffer.set(m.studentId, m.occurredOn);
  }
  const groups: Record<"engaged" | "less_engaged" | "unmatched", StudentRow[]> = {
    engaged: [],
    less_engaged: [],
    unmatched: [],
  };
  for (const s of students) {
    if (!matched.has(s.id)) groups.unmatched.push(s);
    else if ((meetingsByStudent.get(s.id)?.length ?? 0) >= ENGAGED_MEETINGS) groups.engaged.push(s);
    else groups.less_engaged.push(s);
  }
  const summarize = (list: StudentRow[]) => {
    const suppressed = list.length < K_ANON;
    return {
      students: list.length,
      suppressed,
      withOffer: suppressed ? null : rate(list.filter((s) => firstOffer.has(s.id)).length, list.length),
    };
  };
  const before: number[] = [];
  for (const [id, at] of firstOffer) {
    if (!matched.has(id)) continue;
    before.push((meetingsByStudent.get(id) ?? []).filter((d) => d <= at).length);
  }
  return {
    engaged: summarize(groups.engaged),
    lessEngaged: summarize(groups.less_engaged),
    unmatched: summarize(groups.unmatched),
    avgMeetingsBeforeFirstOffer:
      before.length >= K_ANON ? Math.round((before.reduce((s, n) => s + n, 0) / before.length) * 10) / 10 : null,
    offersObserved: before.length,
  };
}

// ---- Feedback ----

export function feedbackTrends(
  feedback: FeedbackRow[],
  matches: MatchRow[],
  logs: LogRow[],
  months: string[]
) {
  const mentee = feedback.filter((f) => f.role === "mentee");
  const fkey = (f: FeedbackRow) => `${f.year}-${String(f.month).padStart(2, "0")}`;
  const distribution = [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: mentee.filter((f) => f.rating === r).length }));
  const suppressDistribution = mentee.length < K_ANON;

  const byMonth = months.map((key) => {
    const rows = mentee.filter((f) => fkey(f) === key);
    const [y, mo] = key.split("-").map(Number);
    const start = Date.UTC(y, mo - 1, 1);
    const end = Date.UTC(y, mo, 1);
    // Expected: one mentee check-in per pair active during the month.
    const expected = matches.filter((m) => m.startedAt.getTime() < end && (!m.endedAt || m.endedAt.getTime() >= start)).length;
    return {
      month: key,
      responses: rows.length,
      expected,
      avg: rows.length >= K_ANON ? Math.round((rows.reduce((s, f) => s + f.rating, 0) / rows.length) * 100) / 100 : null,
    };
  });

  // Rating vs whether the pair interacted that month.
  const interactedIn = new Set<string>();
  for (const l of logs) if (l.matchId && isInteraction(l.eventKind)) interactedIn.add(`${l.matchId}|${monthKey(l.meetingDate)}`);
  const withInteraction = mentee.filter((f) => interactedIn.has(`${f.matchId}|${fkey(f)}`));
  const without = mentee.filter((f) => !interactedIn.has(`${f.matchId}|${fkey(f)}`));
  const avg = (l: FeedbackRow[]) => (l.length >= K_ANON ? Math.round((l.reduce((s, f) => s + f.rating, 0) / l.length) * 100) / 100 : null);
  return {
    responses: mentee.length,
    distribution: suppressDistribution ? null : distribution,
    byMonth,
    vsEngagement: {
      interacted: { n: withInteraction.length, avg: avg(withInteraction) },
      noInteraction: { n: without.length, avg: avg(without) },
    },
  };
}
