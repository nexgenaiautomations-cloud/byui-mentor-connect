import "server-only";
// DB side of event classification: keeps match timestamps, scheduled
// meetings and derived career milestones consistent with meeting_log.
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  careerMilestones,
  matches,
  meetingLogs,
  scheduledMeetings,
  type MeetingLog,
} from "@/db/schema";
import { computeMatchTimestamps, isInteraction } from "@/lib/engagement";
import { offersInTopics } from "@/lib/career";
import {
  DEFAULT_TIME_ZONE,
  dateInputToStr,
  fulfils,
  isValidTimeZone,
  parseHHMM,
  zonedToUtc,
} from "@/lib/schedule";

// Recompute (never increment) the accountability timestamps for a match from
// its classified logs, so edits and deletes can't leave them stale.
// last_activity_at (legacy, drives the 180-day auto-disconnect) only ever
// moves forward, and only on real interaction.
export async function recomputeMatchEngagement(matchId: string): Promise<void> {
  const [match] = await db
    .select({ id: matches.id, menteeId: matches.menteeId, lastActivityAt: matches.lastActivityAt })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return;
  const logs = await db
    .select({
      eventKind: meetingLogs.eventKind,
      meetingDate: meetingLogs.meetingDate,
      studentId: meetingLogs.studentId,
    })
    .from(meetingLogs)
    .where(eq(meetingLogs.matchId, matchId));
  const t = computeMatchTimestamps(logs, match.menteeId);
  const lastActivityAt =
    t.lastInteractionAt && t.lastInteractionAt > match.lastActivityAt
      ? t.lastInteractionAt
      : match.lastActivityAt;
  await db
    .update(matches)
    .set({ ...t, lastActivityAt })
    .where(eq(matches.id, matchId));
}

// Keep the scheduled_meeting row for a log's "next meeting" in sync.
// Only meetings/touchpoints between a pair schedule a next meeting.
export async function syncScheduledMeetingForLog(log: MeetingLog, actorId: string): Promise<void> {
  if (!log.matchId) return;
  if (!log.nextMeetingDate || !isInteraction(log.eventKind)) {
    await db
      .update(scheduledMeetings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(scheduledMeetings.sourceLogId, log.id), eq(scheduledMeetings.status, "scheduled")));
    return;
  }
  const tz = isValidTimeZone(log.nextMeetingTimezone) ? log.nextMeetingTimezone : DEFAULT_TIME_ZONE;
  const time = parseHHMM(log.nextMeetingTime) ? log.nextMeetingTime : null;
  const date = dateInputToStr(log.nextMeetingDate);
  const startsAt = zonedToUtc(date, time, tz);
  await db
    .insert(scheduledMeetings)
    .values({
      matchId: log.matchId,
      sourceLogId: log.id,
      scheduledById: actorId,
      scheduledDate: date,
      scheduledTime: time,
      timezone: tz,
      startsAt,
    })
    .onConflictDoUpdate({
      target: scheduledMeetings.sourceLogId,
      set: {
        scheduledDate: date,
        scheduledTime: time,
        timezone: tz,
        startsAt,
        // A rescheduled meeting is live again unless it was already done.
        status: sql`CASE WHEN ${scheduledMeetings.status} = 'completed' THEN 'completed' ELSE 'scheduled' END`,
        updatedAt: new Date(),
      },
    });
}

// A logged meeting/touchpoint fulfils any open scheduled meeting for the
// match within ±3 days (also clears "missed" if logged late).
export async function completeScheduledMeetings(log: MeetingLog): Promise<void> {
  if (!log.matchId || !isInteraction(log.eventKind)) return;
  const open = await db
    .select({ id: scheduledMeetings.id, startsAt: scheduledMeetings.startsAt, sourceLogId: scheduledMeetings.sourceLogId })
    .from(scheduledMeetings)
    .where(
      and(
        eq(scheduledMeetings.matchId, log.matchId),
        inArray(scheduledMeetings.status, ["scheduled", "missed"])
      )
    );
  const hit = open.filter((m) => m.sourceLogId !== log.id && fulfils(m, log.meetingDate)).map((m) => m.id);
  if (hit.length === 0) return;
  await db
    .update(scheduledMeetings)
    .set({ status: "completed", completedLogId: log.id, updatedAt: new Date() })
    .where(inArray(scheduledMeetings.id, hit));
}

// Offer accomplishments on a log ↔ derived career milestones, one per
// (log, type). Removing the offer from the log removes the milestone.
export async function syncCareerMilestonesForLog(log: MeetingLog): Promise<void> {
  if (!log.studentId || log.isSystemGenerated) return;
  const types = offersInTopics(log.topicsDiscussed);
  const cond = [eq(careerMilestones.sourceLogId, log.id), eq(careerMilestones.source, "activity_log")];
  await db
    .delete(careerMilestones)
    .where(
      types.length > 0
        ? and(...cond, notInArray(sql`coalesce(${careerMilestones.opportunityType}, '')`, types))
        : and(...cond)
    );
  for (const type of types) {
    await db
      .insert(careerMilestones)
      .values({
        studentId: log.studentId,
        stage: "offer_received",
        opportunityType: type,
        occurredOn: log.meetingDate,
        source: "activity_log",
        sourceLogId: log.id,
      })
      .onConflictDoUpdate({
        target: [careerMilestones.sourceLogId, careerMilestones.opportunityType],
        set: { occurredOn: log.meetingDate },
      });
  }
}

// Run every derived-state sync after a log is written. Failures are logged
// and swallowed: the user's log itself has already been saved.
export async function afterLogWrite(log: MeetingLog, actorId: string): Promise<void> {
  const steps: [string, () => Promise<void>][] = [
    ["engagement", async () => (log.matchId ? recomputeMatchEngagement(log.matchId) : undefined)],
    ["schedule", () => syncScheduledMeetingForLog(log, actorId)],
    ["complete", () => completeScheduledMeetings(log)],
    ["career", () => syncCareerMilestonesForLog(log)],
  ];
  for (const [name, fn] of steps) {
    try {
      await fn();
    } catch (e) {
      console.error(`afterLogWrite(${name}) failed:`, e);
    }
  }
}
