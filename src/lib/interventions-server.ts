import "server-only";
// Intervention Center data layer (docs/specs/accountability-upgrade.md §5).
import { and, desc, eq, inArray, isNotNull, isNull, ne, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  interventionEvents,
  interventions,
  matches,
  meetingLogs,
  monthlyFeedback,
  notificationDeliveries,
  scheduledMeetings,
  users,
} from "@/db/schema";
import { interactionReference } from "@/lib/engagement";
import { assessRisk, OPEN_STATUSES, type RiskReason } from "@/lib/interventions";
import { getThresholdsBySchool } from "@/lib/program-settings-server";
import { schoolOf } from "@/lib/school-scope";

// Re-evaluate risk for every active match (optionally one school) and open,
// update or clear cases. Never closes a case on its own — people do that.
export async function detectInterventions(now: Date = new Date(), school: string | null = null) {
  const mentee = alias(users, "mentee_u");
  const active = await db
    .select({
      id: matches.id,
      mentorId: matches.mentorId,
      menteeId: matches.menteeId,
      startedAt: matches.startedAt,
      firstMeetingAt: matches.firstMeetingAt,
      lastInteractionAt: matches.lastInteractionAt,
      menteeEmail: mentee.email,
    })
    .from(matches)
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(
      and(
        eq(matches.status, "active"),
        school ? sql`lower(split_part(${mentee.email}, '@', 2)) = ${school}` : sql`true`
      )
    );
  if (active.length === 0) return { opened: 0, updated: 0, cleared: 0, evaluated: 0 };
  const ids = active.map((m) => m.id);

  const [missed, reminders, ratings, openActions, openCases] = await Promise.all([
    db
      .select({ matchId: scheduledMeetings.matchId, startsAt: scheduledMeetings.startsAt })
      .from(scheduledMeetings)
      .where(and(inArray(scheduledMeetings.matchId, ids), eq(scheduledMeetings.status, "missed"))),
    db
      .select({ matchId: notificationDeliveries.matchId, createdAt: notificationDeliveries.createdAt })
      .from(notificationDeliveries)
      .where(and(inArray(notificationDeliveries.matchId, ids), eq(notificationDeliveries.status, "sent"))),
    db
      .select({
        matchId: monthlyFeedback.matchId,
        rating: monthlyFeedback.rating,
        year: monthlyFeedback.year,
        month: monthlyFeedback.month,
      })
      .from(monthlyFeedback)
      .where(and(inArray(monthlyFeedback.matchId, ids), eq(monthlyFeedback.submittedByRole, "mentee"))),
    db
      .select({ matchId: meetingLogs.matchId, meetingDate: meetingLogs.meetingDate })
      .from(meetingLogs)
      .where(
        and(
          inArray(meetingLogs.matchId, ids),
          inArray(meetingLogs.eventKind, ["mentor_meeting", "touchpoint"]),
          isNotNull(meetingLogs.actionItems),
          ne(meetingLogs.actionItems, ""),
          isNull(meetingLogs.actionItemsDoneAt)
        )
      ),
    db
      .select({ id: interventions.id, matchId: interventions.matchId, reasons: interventions.reasons })
      .from(interventions)
      .where(and(inArray(interventions.matchId, ids), inArray(interventions.status, [...OPEN_STATUSES]))),
  ]);

  const thresholds = await getThresholdsBySchool(active.map((m) => schoolOf(m.menteeEmail) ?? "*"));
  const caseByMatch = new Map(openCases.map((c) => [c.matchId, c]));
  let opened = 0;
  let updated = 0;
  let cleared = 0;

  for (const m of active) {
    const ref = interactionReference(m);
    const latest = ratings
      .filter((r) => r.matchId === m.id)
      .sort((a, b) => b.year - a.year || b.month - a.month)[0];
    const oldestOpen = openActions
      .filter((a) => a.matchId === m.id)
      .reduce<Date | null>((min, a) => (!min || a.meetingDate < min ? a.meetingDate : min), null);
    const schoolKey = schoolOf(m.menteeEmail) ?? "*";
    const reasons: RiskReason[] = assessRisk(
      {
        startedAt: m.startedAt,
        firstMeetingAt: m.firstMeetingAt,
        lastInteractionAt: m.lastInteractionAt,
        missedSinceInteraction: missed.filter((x) => x.matchId === m.id && x.startsAt > ref).length,
        remindersSinceInteraction: reminders.filter((x) => x.matchId === m.id && x.createdAt > ref).length,
        latestMenteeRating: latest?.rating ?? null,
        oldestOpenActionItemsAt: oldestOpen,
      },
      thresholds.get(schoolKey)!,
      now
    );
    const existing = caseByMatch.get(m.id);
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

    if (!existing && reasons.length > 0) {
      // The partial unique index (one open case per match) makes a racing
      // second insert fail harmlessly.
      const [row] = await db
        .insert(interventions)
        .values({
          matchId: m.id,
          studentId: m.menteeId,
          mentorId: m.mentorId,
          school: schoolKey,
          reasons,
          lastDetectedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: interventions.id });
      if (row) {
        await db.insert(interventionEvents).values({ interventionId: row.id, action: "opened", toStatus: "new", note: reasons.join(", ") });
        opened++;
      }
    } else if (existing && !same(existing.reasons, reasons)) {
      await db
        .update(interventions)
        .set({ reasons, lastDetectedAt: now, updatedAt: now })
        .where(eq(interventions.id, existing.id));
      await db.insert(interventionEvents).values({
        interventionId: existing.id,
        action: reasons.length ? "redetected" : "risk_cleared",
        note: reasons.join(", ") || null,
      });
      if (reasons.length) updated++;
      else cleared++;
    } else if (existing) {
      await db.update(interventions).set({ lastDetectedAt: now }).where(eq(interventions.id, existing.id));
    }
  }
  return { opened, updated, cleared, evaluated: active.length };
}

export type CaseRow = Awaited<ReturnType<typeof listCases>>[number];

// Cases for the admin view. Deliberately no meeting notes, action-item text
// or feedback answers — only counts, dates and the rating band via reasons.
export async function listCases(opts: { school: string | null; status: "open" | "closed" | "all"; assignedTo?: string; ids?: string[] }) {
  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");
  const assignee = alias(users, "assignee_u");
  const outreachBy = alias(users, "outreach_u");
  const statusCond =
    opts.status === "open"
      ? inArray(interventions.status, [...OPEN_STATUSES])
      : opts.status === "closed"
        ? notInArray(interventions.status, [...OPEN_STATUSES])
        : sql`true`;
  return db
    .select({
      id: interventions.id,
      matchId: interventions.matchId,
      school: interventions.school,
      status: interventions.status,
      reasons: interventions.reasons,
      openedAt: interventions.openedAt,
      updatedAt: interventions.updatedAt,
      followUpOn: interventions.followUpOn,
      lastOutreachAt: interventions.lastOutreachAt,
      lastOutreachById: interventions.lastOutreachById,
      lastOutreachByName: outreachBy.name,
      assignedToId: interventions.assignedToId,
      assignedToName: assignee.name,
      studentId: interventions.studentId,
      studentName: mentee.name,
      studentEmail: mentee.email,
      mentorId: interventions.mentorId,
      mentorName: mentor.name,
      mentorEmail: mentor.email,
      matchStatus: matches.status,
      startedAt: matches.startedAt,
      lastInteractionAt: matches.lastInteractionAt,
      meetingCount: sql<number>`(select count(*)::int from "meeting_log" where match_id = ${interventions.matchId} and event_kind = 'mentor_meeting')`,
      lastReminderAt: sql<Date | null>`(select max(created_at) from "notification_delivery" where match_id = ${interventions.matchId} and status = 'sent')`.mapWith(
        (v: unknown) => (v ? new Date(v as string) : null)
      ),
    })
    .from(interventions)
    .innerJoin(matches, eq(matches.id, interventions.matchId))
    .leftJoin(mentor, eq(mentor.id, interventions.mentorId))
    .leftJoin(mentee, eq(mentee.id, interventions.studentId))
    .leftJoin(assignee, eq(assignee.id, interventions.assignedToId))
    .leftJoin(outreachBy, eq(outreachBy.id, interventions.lastOutreachById))
    .where(
      and(
        statusCond,
        opts.school ? eq(interventions.school, opts.school) : sql`true`,
        opts.assignedTo ? eq(interventions.assignedToId, opts.assignedTo) : sql`true`,
        opts.ids ? inArray(interventions.id, opts.ids.length ? opts.ids : ["00000000-0000-0000-0000-000000000000"]) : sql`true`
      )
    )
    .orderBy(desc(interventions.openedAt));
}

export async function caseEvents(caseIds: string[]) {
  if (caseIds.length === 0) return [];
  const actor = alias(users, "actor_u");
  return db
    .select({
      id: interventionEvents.id,
      interventionId: interventionEvents.interventionId,
      action: interventionEvents.action,
      fromStatus: interventionEvents.fromStatus,
      toStatus: interventionEvents.toStatus,
      note: interventionEvents.note,
      createdAt: interventionEvents.createdAt,
      actorName: actor.name,
    })
    .from(interventionEvents)
    .leftJoin(actor, eq(actor.id, interventionEvents.actorId))
    .where(inArray(interventionEvents.interventionId, caseIds))
    .orderBy(desc(interventionEvents.createdAt));
}

// People a case can be assigned to: admins and executive mentors at the
// same school.
export async function assignableStaff(school: string | null) {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin, isExecutiveMentor: users.isExecutiveMentor })
    .from(users)
    .where(and(isNull(users.deactivatedAt), sql`(${users.isAdmin} or ${users.isExecutiveMentor})`));
  return rows
    .filter((r) => !school || schoolOf(r.email) === school)
    .map((r) => ({ id: r.id, name: r.name ?? r.email, role: r.isAdmin ? "Admin" : "Executive mentor", school: schoolOf(r.email) }));
}

export async function interventionCounts(school: string | null) {
  const rows = await db
    .select({ status: interventions.status, n: sql<number>`count(*)::int` })
    .from(interventions)
    .where(school ? eq(interventions.school, school) : sql`true`)
    .groupBy(interventions.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
}

