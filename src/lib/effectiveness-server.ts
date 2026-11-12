import "server-only";
// Loads the rows every Program Effectiveness / Executive / ROI / Careers view
// needs, already restricted to the admin's school and the chosen filters.
// All queries are parameterized Drizzle; school scoping happens in SQL.
import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  careerMilestones,
  interventionEvents,
  interventions,
  notificationDeliveries,
  matches,
  meetingLogs,
  monthlyFeedback,
  pods,
  schoolDomains,
  users,
} from "@/db/schema";
import { emailInScope, type AdminScope } from "@/lib/admin-scope";
import { departmentOf } from "@/lib/reports";
import { termOf, type FeedbackRow, type LogRow, type MatchRow, type StudentRow } from "@/lib/effectiveness";
import type { ExistingMilestone } from "@/lib/career";
import { OPEN_STATUSES } from "@/lib/interventions";
import { FOLLOW_UP_KINDS, REMINDER_KINDS, trackedMentorship, type RoiTracked } from "@/lib/program-report";


export type ProgramFilters = {
  school: string;
  department: string;
  major: string;
  pod: string;
  cohort: string;
};

export function parseProgramFilters(p: Record<string, string | undefined>): ProgramFilters {
  const clean = (v: string | undefined) => (v ?? "").trim().slice(0, 120);
  return {
    school: clean(p.school).toLowerCase(),
    department: clean(p.department),
    major: clean(p.major),
    pod: clean(p.pod),
    cohort: clean(p.cohort),
  };
}

export type ProgramData = {
  students: StudentRow[];
  matches: MatchRow[];
  logs: LogRow[];
  feedback: FeedbackRow[];
  milestones: (ExistingMilestone & { verification: string; source: string; employer: string | null })[];
  options: { majors: string[]; pods: string[]; cohorts: string[]; schools: string[] };
  studentById: Map<string, StudentRow>;
};

const CHUNK = 500;
function chunks<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
  return out;
}

export async function loadProgramData(scope: AdminScope, f: ProgramFilters): Promise<ProgramData> {
  // Students: active members (not mentors/admins) in the scoped school.
  const people = await db
    .select({
      id: users.id,
      major: users.major,
      createdAt: users.createdAt,
      podName: pods.name,
    })
    .from(users)
    .leftJoin(pods, eq(pods.id, users.podId))
    .where(
      and(
        isNull(users.deactivatedAt),
        eq(users.isAdmin, false),
        eq(users.isMentor, false),
        emailInScope(users.email, scope)
      )
    );

  const all: StudentRow[] = people.map((p) => ({
    id: p.id,
    major: p.major,
    department: departmentOf(p.major),
    podName: p.podName,
    cohort: termOf(p.createdAt),
    createdAt: p.createdAt,
  }));
  const options = {
    majors: [...new Set(all.map((s) => s.major).filter((m): m is string => !!m))].sort(),
    pods: [...new Set(all.map((s) => s.podName).filter((m): m is string => !!m))].sort(),
    cohorts: [...new Set(all.map((s) => s.cohort))].sort(),
    schools: scope.platform
      ? (await db.select({ d: schoolDomains.domain }).from(schoolDomains).where(eq(schoolDomains.active, true))).map((r) => r.d).sort()
      : [],
  };
  const students = all.filter(
    (s) =>
      (!f.department || s.department === f.department) &&
      (!f.major || s.major === f.major) &&
      (!f.pod || s.podName === f.pod) &&
      (!f.cohort || s.cohort === f.cohort)
  );
  const studentById = new Map(students.map((s) => [s.id, s]));
  const ids = students.map((s) => s.id);
  if (ids.length === 0) {
    return { students, matches: [], logs: [], feedback: [], milestones: [], options, studentById };
  }

  const matchRows: MatchRow[] = [];
  const logRows: LogRow[] = [];
  const milestoneRows: ProgramData["milestones"] = [];
  for (const part of chunks(ids)) {
    const [m, l, c] = await Promise.all([
      db
        .select({
          id: matches.id,
          mentorId: matches.mentorId,
          menteeId: matches.menteeId,
          status: matches.status,
          startedAt: matches.startedAt,
          endedAt: matches.endedAt,
          firstMeetingAt: matches.firstMeetingAt,
          lastInteractionAt: matches.lastInteractionAt,
        })
        .from(matches)
        .where(inArray(matches.menteeId, part)),
      db
        .select({
          studentId: meetingLogs.studentId,
          matchId: meetingLogs.matchId,
          eventKind: meetingLogs.eventKind,
          meetingDate: meetingLogs.meetingDate,
          group: meetingLogs.accomplishmentGroup,
          isSystemGenerated: meetingLogs.isSystemGenerated,
          durationMinutes: meetingLogs.durationMinutes,
        })
        .from(meetingLogs)
        .where(inArray(meetingLogs.studentId, part)),
      db
        .select({
          id: careerMilestones.id,
          studentId: careerMilestones.studentId,
          stage: careerMilestones.stage,
          opportunityType: careerMilestones.opportunityType,
          relatedMilestoneId: careerMilestones.relatedMilestoneId,
          occurredOn: careerMilestones.occurredOn,
          createdAt: careerMilestones.createdAt,
          verification: careerMilestones.verification,
          source: careerMilestones.source,
          employer: careerMilestones.employer,
        })
        .from(careerMilestones)
        .where(inArray(careerMilestones.studentId, part)),
    ]);
    matchRows.push(...m);
    logRows.push(...l);
    milestoneRows.push(...c);
  }

  const feedback: FeedbackRow[] = [];
  for (const part of chunks(matchRows.map((m) => m.id))) {
    const rows = await db
      .select({
        matchId: monthlyFeedback.matchId,
        role: monthlyFeedback.submittedByRole,
        rating: monthlyFeedback.rating,
        year: monthlyFeedback.year,
        month: monthlyFeedback.month,
      })
      .from(monthlyFeedback)
      .where(inArray(monthlyFeedback.matchId, part));
    feedback.push(...rows);
  }

  return { students, matches: matchRows, logs: logRows, feedback, milestones: milestoneRows, options, studentById };
}

// Used by pages to decide what school a platform admin is looking at.
export function scopeLabel(scope: AdminScope): string {
  return scope.school ?? "All schools";
}


// ---- Executive / ROI extras ----


export async function openInterventionStudents(scope: AdminScope): Promise<Set<string>> {
  const rows = await db
    .select({ studentId: interventions.studentId })
    .from(interventions)
    .where(
      and(
        inArray(interventions.status, [...OPEN_STATUSES]),
        scope.school ? eq(interventions.school, scope.school) : sql`true`
      )
    );
  return new Set(rows.map((r) => r.studentId).filter((v): v is string => !!v));
}

export async function interventionOutcomes(scope: AdminScope, range: { start: Date; end: Date }) {
  const schoolCond = scope.school ? eq(interventions.school, scope.school) : sql`true`;
  const [opened, byStatus] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(interventions)
      .where(and(schoolCond, gte(interventions.openedAt, range.start), lt(interventions.openedAt, range.end))),
    db
      .select({ status: interventions.status, n: sql<number>`count(*)::int` })
      .from(interventions)
      .where(and(schoolCond, gte(interventions.openedAt, range.start), lt(interventions.openedAt, range.end)))
      .groupBy(interventions.status),
  ]);
  return { opened: opened[0]?.n ?? 0, byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<string, number> };
}

// Tracked (not modeled) quantities for the ROI view, scoped to the school
// through the people involved.
export async function loadRoiTracked(scope: AdminScope, data: ProgramData, range: { start: Date; end: Date }): Promise<RoiTracked> {
  const studentIds = data.students.map((s) => s.id);
  const matchIds = data.matches.map((m) => m.id);
  const schoolCond = scope.school ? eq(interventions.school, scope.school) : sql`true`;
  const [deliveries, actionsDone, outreach, resolved] = await Promise.all([
    matchIds.length
      ? db
          .select({ kind: notificationDeliveries.kind, n: sql<number>`count(*)::int` })
          .from(notificationDeliveries)
          .where(
            and(
              eq(notificationDeliveries.status, "sent"),
              inArray(notificationDeliveries.matchId, matchIds),
              gte(notificationDeliveries.createdAt, range.start),
              lt(notificationDeliveries.createdAt, range.end)
            )
          )
          .groupBy(notificationDeliveries.kind)
      : Promise.resolve([] as { kind: string; n: number }[]),
    studentIds.length
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(meetingLogs)
          .where(
            and(
              inArray(meetingLogs.studentId, studentIds),
              isNotNull(meetingLogs.actionItemsDoneAt),
              gte(meetingLogs.actionItemsDoneAt, range.start),
              lt(meetingLogs.actionItemsDoneAt, range.end)
            )
          )
      : Promise.resolve([{ n: 0 }]),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(interventionEvents)
      .innerJoin(interventions, eq(interventions.id, interventionEvents.interventionId))
      .where(
        and(
          schoolCond,
          eq(interventionEvents.action, "outreach"),
          gte(interventionEvents.createdAt, range.start),
          lt(interventionEvents.createdAt, range.end)
        )
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(interventions)
      .where(and(schoolCond, isNotNull(interventions.resolvedAt), gte(interventions.resolvedAt, range.start), lt(interventions.resolvedAt, range.end))),
  ]);
  const byKind = new Map(deliveries.map((d) => [d.kind, d.n]));
  const sum = (kinds: string[]) => kinds.reduce((s, k) => s + (byKind.get(k) ?? 0), 0);
  return {
    ...trackedMentorship(data.logs, range),
    remindersDelivered: sum(REMINDER_KINDS),
    followUpsDelivered: sum(FOLLOW_UP_KINDS),
    followUpTasksCompleted: actionsDone[0]?.n ?? 0,
    interventionsRecorded: outreach[0]?.n ?? 0,
    casesResolved: resolved[0]?.n ?? 0,
  };
}

// ---- Chart series loaders (aggregated in SQL, school-scoped) ----

// Sent reminders vs follow-ups per month, for pairs in scope.
export async function deliveriesByMonth(data: ProgramData, since: Date) {
  const matchIds = data.matches.map((m) => m.id);
  if (!matchIds.length) return [] as { month: string; kind: "reminder" | "followup"; n: number }[];
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${notificationDeliveries.createdAt}), 'YYYY-MM')`,
      kind: notificationDeliveries.kind,
      n: sql<number>`count(*)::int`,
    })
    .from(notificationDeliveries)
    .where(
      and(
        eq(notificationDeliveries.status, "sent"),
        inArray(notificationDeliveries.matchId, matchIds),
        gte(notificationDeliveries.createdAt, since)
      )
    )
    .groupBy(sql`1`, notificationDeliveries.kind);
  return rows.map((r) => ({
    month: r.month,
    kind: (FOLLOW_UP_KINDS.includes(r.kind) ? "followup" : "reminder") as "reminder" | "followup",
    n: r.n,
  }));
}

// Intervention cases opened per month, by risk reason (a case can carry
// several reasons, so this counts reason occurrences).
export async function interventionReasonsByMonth(scope: AdminScope, since: Date) {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${interventions.openedAt}), 'YYYY-MM')`,
      reason: sql<string>`unnest(${interventions.reasons})`,
    })
    .from(interventions)
    .where(and(gte(interventions.openedAt, since), scope.school ? eq(interventions.school, scope.school) : sql`true`));
  const out = new Map<string, number>();
  for (const r of rows) out.set(`${r.reason}|${r.month}`, (out.get(`${r.reason}|${r.month}`) ?? 0) + 1);
  return out;
}
