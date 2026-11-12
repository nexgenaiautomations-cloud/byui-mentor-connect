// Chart series for the analytics dashboards — pure, unit-tested.
// Every builder takes already school-scoped rows (effectiveness-server.ts)
// and returns small aggregated arrays, so no student-level data is sent to
// the browser. null = not enough data (suppressed) — never a fake 0.
import { DAY_MS, isInteraction, isMeeting } from "@/lib/engagement";
import { CAREER_STAGES, currentStage, isOpportunityType, type CareerStage, type ExistingMilestone } from "@/lib/career";
import { K_ANON, monthKey, monthLabel, type FeedbackRow, type LogRow, type MatchRow, type StudentRow } from "@/lib/effectiveness";
import { weekRangeForDate } from "@/lib/kpis";

const monthBounds = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return { start: Date.UTC(y, m - 1, 1), end: Date.UTC(y, m, 1) };
};

const activeDuring = (m: MatchRow, start: number, end: number) =>
  m.startedAt.getTime() < end && (!m.endedAt || m.endedAt.getTime() >= start);

// Students who did at least one thing themselves that month, plus new sign-ups.
export function participationByMonth(students: StudentRow[], logs: LogRow[], months: string[]) {
  const ids = new Set(students.map((s) => s.id));
  return months.map((key) => {
    const { start, end } = monthBounds(key);
    const active = new Set(
      logs
        .filter((l) => l.studentId && ids.has(l.studentId) && !l.isSystemGenerated && l.eventKind !== "system_event")
        .filter((l) => l.meetingDate.getTime() >= start && l.meetingDate.getTime() < end)
        .map((l) => l.studentId!)
    ).size;
    const joined = students.filter((s) => s.createdAt.getTime() >= start && s.createdAt.getTime() < end).length;
    return { label: monthLabel(key), active, joined };
  });
}

// Pairs active at month end, and pairs started in the month.
export function relationshipsByMonth(matches: MatchRow[], months: string[]) {
  return months.map((key) => {
    const { start, end } = monthBounds(key);
    return {
      label: monthLabel(key),
      active: matches.filter((m) => m.startedAt.getTime() < end && (!m.endedAt || m.endedAt.getTime() >= end)).length,
      started: matches.filter((m) => m.startedAt.getTime() >= start && m.startedAt.getTime() < end).length,
    };
  });
}

// Each pair active during the month, by its best interaction that month.
export function engagementMixByMonth(matches: MatchRow[], logs: LogRow[], months: string[]) {
  const byMatch = new Map<string, LogRow[]>();
  for (const l of logs) if (l.matchId && isInteraction(l.eventKind)) byMatch.set(l.matchId, [...(byMatch.get(l.matchId) ?? []), l]);
  return months.map((key) => {
    const { start, end } = monthBounds(key);
    let met = 0;
    let touch = 0;
    let quiet = 0;
    for (const m of matches) {
      if (!activeDuring(m, start, end)) continue;
      const inMonth = (byMatch.get(m.id) ?? []).filter((l) => l.meetingDate.getTime() >= start && l.meetingDate.getTime() < end);
      if (inMonth.some((l) => isMeeting(l.eventKind))) met++;
      else if (inMonth.length) touch++;
      else quiet++;
    }
    const total = met + touch + quiet;
    return {
      label: monthLabel(key),
      met,
      touchpoint: touch,
      quiet,
      // share of active pairs that met — null when there were no pairs
      metPct: total ? Math.round((met / total) * 100) : null,
    };
  });
}

export function meetingsPerPairByMonth(matches: MatchRow[], logs: LogRow[], months: string[]) {
  return months.map((key) => {
    const { start, end } = monthBounds(key);
    const pairs = matches.filter((m) => activeDuring(m, start, end)).length;
    const meetings = logs.filter((l) => isMeeting(l.eventKind) && l.meetingDate.getTime() >= start && l.meetingDate.getTime() < end).length;
    return { label: monthLabel(key), meetings, perPair: pairs ? Math.round((meetings / pairs) * 100) / 100 : null };
  });
}

// Health heatmap: group × month, share of pairs active that month that
// interacted. Cells with no active pairs are null.
export function healthHeatmap(matches: MatchRow[], logs: LogRow[], groupOf: (menteeId: string) => string, months: string[]) {
  const dates = new Map<string, number[]>();
  for (const l of logs) if (l.matchId && isInteraction(l.eventKind)) dates.set(l.matchId, [...(dates.get(l.matchId) ?? []), l.meetingDate.getTime()]);
  const groups = [...new Set(matches.map((m) => groupOf(m.menteeId)))].sort();
  return groups.map((g) => ({
    label: g,
    cells: months.map((key) => {
      const { start, end } = monthBounds(key);
      const pairs = matches.filter((m) => groupOf(m.menteeId) === g && activeDuring(m, start, end));
      if (!pairs.length) return { value: null, n: 0, note: "no active pairs" };
      const engaged = pairs.filter((m) => (dates.get(m.id) ?? []).some((t) => t >= start && t < end)).length;
      return { value: Math.round((engaged / pairs.length) * 100), n: pairs.length };
    }),
  }));
}

// 3-2-1 weekly task completion: group × completed week, suppressed below k.
export function weeklyCompletionHeatmap(students: StudentRow[], logs: LogRow[], now: Date, weeks: number, groupOf: (s: StudentRow) => string) {
  const tasks = logs.filter((l) => l.group === "career_tasks" && !l.isSystemGenerated && l.eventKind !== "system_event" && l.studentId);
  const ranges = Array.from({ length: weeks }, (_, i) => weekRangeForDate(new Date(now.getTime() - (weeks - i) * 7 * DAY_MS)));
  const columns = ranges.map((r) => `${r.start.getMonth() + 1}/${r.start.getDate()}`);
  const groups = new Map<string, StudentRow[]>();
  for (const s of students) groups.set(groupOf(s), [...(groups.get(groupOf(s)) ?? []), s]);
  const rows = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, list]) => ({
      label,
      cells: ranges.map((r) => {
        const eligible = list.filter((s) => s.createdAt < r.end);
        if (eligible.length < K_ANON) return { value: null, n: eligible.length, note: `fewer than ${K_ANON} students` };
        const ids = new Set(eligible.map((s) => s.id));
        const done = new Set(tasks.filter((l) => ids.has(l.studentId!) && l.meetingDate >= r.start && l.meetingDate < r.end).map((l) => l.studentId));
        return { value: Math.round((done.size / eligible.length) * 100), n: eligible.length };
      }),
    }));
  return { columns, rows };
}

// Career stage × month: students whose latest reported stage at month end
// is that stage.
export function stageHeatmap(milestones: ExistingMilestone[], months: string[]) {
  const byStudent = new Map<string, ExistingMilestone[]>();
  for (const m of milestones) byStudent.set(m.studentId, [...(byStudent.get(m.studentId) ?? []), m]);
  const counts = months.map((key) => {
    const { end } = monthBounds(key);
    const c = Object.fromEntries(CAREER_STAGES.map((s) => [s, 0])) as Record<CareerStage, number>;
    for (const list of byStudent.values()) {
      const s = currentStage(list.filter((m) => m.occurredOn.getTime() < end));
      if (s) c[s] += 1;
    }
    return c;
  });
  return CAREER_STAGES.map((stage) => ({ stage, cells: counts.map((c) => c[stage]) }));
}

// Pipeline activity per month: applications (milestones + logged
// applications), interviews, offers by type, and verified offers.
export function pipelineByMonth(milestones: (ExistingMilestone & { verification?: string })[], applicationDates: Date[], months: string[]) {
  return months.map((key) => {
    const { start, end } = monthBounds(key);
    const inM = milestones.filter((m) => m.occurredOn.getTime() >= start && m.occurredOn.getTime() < end);
    const offers = inM.filter((m) => m.stage === "offer_received" && isOpportunityType(m.opportunityType));
    return {
      label: monthLabel(key),
      applications: inM.filter((m) => m.stage === "applying").length + applicationDates.filter((d) => d.getTime() >= start && d.getTime() < end).length,
      interviews: inM.filter((m) => m.stage === "interviewing").length,
      internship: offers.filter((m) => m.opportunityType === "internship").length,
      part_time: offers.filter((m) => m.opportunityType === "part_time").length,
      full_time: offers.filter((m) => m.opportunityType === "full_time").length,
      verified: offers.filter((m) => m.verification === "verified").length,
    };
  });
}

// Mentee rating × month, counts — months with fewer than k responses hidden.
export function feedbackHeatmap(feedback: FeedbackRow[], months: string[]) {
  const mentee = feedback.filter((f) => f.role === "mentee");
  const perMonth = new Map(months.map((k) => [k, mentee.filter((f) => `${f.year}-${String(f.month).padStart(2, "0")}` === k)]));
  return [5, 4, 3, 2, 1].map((rating) => ({
    label: `${rating} star${rating === 1 ? "" : "s"}`,
    cells: months.map((k) => {
      const rows = perMonth.get(k)!;
      if (rows.length < K_ANON) return { value: null, n: rows.length, note: `fewer than ${K_ANON} responses` };
      return { value: rows.filter((f) => f.rating === rating).length, n: rows.length };
    }),
  }));
}

// ROI trend: logged hours and modeled minutes saved per month, cumulative.
export function roiByMonth(
  logs: LogRow[],
  deliveries: { month: string; kind: "reminder" | "followup"; n: number }[],
  months: string[],
  minutesPerReminder: number,
  minutesPerFollowUp: number
) {
  let cumulative = 0;
  return months.map((key) => {
    const { start, end } = monthBounds(key);
    const minutes = logs
      .filter((l) => isInteraction(l.eventKind) && l.meetingDate.getTime() >= start && l.meetingDate.getTime() < end)
      .reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
    const reminders = deliveries.filter((d) => d.month === key && d.kind === "reminder").reduce((s, d) => s + d.n, 0);
    const followups = deliveries.filter((d) => d.month === key && d.kind === "followup").reduce((s, d) => s + d.n, 0);
    const savedHours = (reminders * minutesPerReminder + followups * minutesPerFollowUp) / 60;
    cumulative += savedHours;
    return {
      label: monthLabel(key),
      hours: Math.round((minutes / 60) * 10) / 10,
      reminders,
      followups,
      savedHours: Math.round(savedHours * 10) / 10,
      cumulativeSavedHours: Math.round(cumulative * 10) / 10,
    };
  });
}

// The current month is still in progress: label its point so a partial
// month isn't read as a drop.
export function markPartialLast<T extends { label: string }>(rows: T[], now: Date, lastKey: string): T[] {
  if (!rows.length || lastKey !== monthKey(now)) return rows;
  return rows.map((r, i) => (i === rows.length - 1 ? { ...r, label: `${r.label} (to date)` } : r));
}

export { monthKey };
