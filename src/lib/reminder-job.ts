import "server-only";
// Hourly reminder job (docs/specs/accountability-upgrade.md §3). Gathers
// facts, asks the pure rules in notifications.ts / schedule.ts what is due,
// and hands each candidate to deliver(). Safe to run repeatedly.
import { and, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { matches, meetingLogs, scheduledMeetings, users } from "@/db/schema";
import { DAY_MS } from "@/lib/engagement";
import {
  dedupe,
  maxPerRun as parseMaxPerRun,
  notificationMode,
  pickInactivityNudge,
  type NotificationMode,
} from "@/lib/notifications";
import { deliver, newRunState, primeRunState, type Candidate, type RunState } from "@/lib/notifications-server";
import { getRawSetting, getThresholdsBySchool, saveSetting } from "@/lib/program-settings-server";
import { SETTING_KEYS } from "@/lib/program-settings";
import { isDue, parseHHMM } from "@/lib/schedule";
import { schoolOf } from "@/lib/school-scope";

type Person = { id: string; email: string; firstName: string | null; name: string | null; deactivatedAt: Date | null };

function firstName(p: Person): string | null {
  return p.firstName?.trim() || p.name?.trim().split(/\s+/)[0] || null;
}

function appUrl(): string {
  return (process.env.AUTH_URL ?? "https://byui-mentor-connect.vercel.app").replace(/\/$/, "");
}

export function formatWhen(startsAt: Date, time: string | null, tz: string): string {
  const opts: Intl.DateTimeFormatOptions = parseHHMM(time)
    ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }
    : { weekday: "short", month: "short", day: "numeric", timeZone: tz };
  return new Intl.DateTimeFormat("en-US", opts).format(startsAt);
}

export type JobResult = {
  mode: NotificationMode;
  liveSince: string | null;
  markedMissed: number;
  markedCompleted: number;
  candidates: number;
  outcomes: RunState["outcomes"] | null;
};

// Stored the first time the job runs in a sending mode. Inactivity nudges
// only fire for thresholds crossed after it (no backlog blast on enable).
async function liveSince(now: Date): Promise<Date> {
  const raw = await getRawSetting("*", SETTING_KEYS.notificationsLiveSince);
  if (raw) {
    const d = new Date(JSON.parse(raw));
    if (!Number.isNaN(d.getTime())) return d;
  }
  await saveSetting("*", SETTING_KEYS.notificationsLiveSince, now.toISOString(), null);
  return now;
}

export async function runReminderJob(now: Date = new Date()): Promise<JobResult> {
  const mode = notificationMode(process.env.NOTIFICATIONS_MODE);
  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");
  const personCols = (u: typeof mentor | typeof mentee) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    name: u.name,
    deactivatedAt: u.deactivatedAt,
  });

  // ---- 1. Scheduled meetings (state changes run even when mode is off) ----
  const meetings = await db
    .select({
      sm: scheduledMeetings,
      lastInteractionAt: matches.lastInteractionAt,
      mentor: personCols(mentor),
      mentee: personCols(mentee),
    })
    .from(scheduledMeetings)
    .innerJoin(matches, and(eq(matches.id, scheduledMeetings.matchId), eq(matches.status, "active")))
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(
      and(
        eq(scheduledMeetings.status, "scheduled"),
        gte(scheduledMeetings.startsAt, new Date(now.getTime() - 40 * DAY_MS)),
        lte(scheduledMeetings.startsAt, new Date(now.getTime() + 2 * DAY_MS))
      )
    );

  const inactiveUsers = new Set<string>();
  const note = (...people: Person[]) => {
    for (const p of people) if (p.deactivatedAt) inactiveUsers.add(p.id);
  };

  let markedMissed = 0;
  let markedCompleted = 0;
  const candidates: Candidate[] = [];
  for (const row of meetings) {
    const m = row.sm;
    note(row.mentor, row.mentee);
    // Interaction logged around the meeting (e.g. logged before the
    // scheduled row existed) → it happened.
    if (
      row.lastInteractionAt &&
      row.lastInteractionAt.getTime() >= m.startsAt.getTime() - 3 * DAY_MS &&
      m.startsAt <= now
    ) {
      await db.update(scheduledMeetings).set({ status: "completed", updatedAt: now }).where(eq(scheduledMeetings.id, m.id));
      markedCompleted++;
      continue;
    }
    if (isDue(m, "mark_missed", now)) {
      await db
        .update(scheduledMeetings)
        .set({ status: "missed", updatedAt: now })
        .where(and(eq(scheduledMeetings.id, m.id), eq(scheduledMeetings.status, "scheduled")));
      markedMissed++;
      continue;
    }
    const when = formatWhen(m.startsAt, m.scheduledTime, m.timezone);
    const pair: [Person, Person, "mentor" | "mentee"][] = [
      [row.mentor, row.mentee, "mentor"],
      [row.mentee, row.mentor, "mentee"],
    ];
    for (const kind of ["meeting_1h", "meeting_24h"] as const) {
      if (!isDue(m, kind, now)) continue;
      for (const [to, other, role] of pair) {
        candidates.push({
          dedupeKey: dedupe.meeting(kind, m.id, to.id),
          userId: to.id,
          email: to.email,
          kind,
          matchId: m.matchId,
          scheduledMeetingId: m.id,
          ctx: { appUrl: appUrl(), recipientFirstName: firstName(to), otherFirstName: firstName(other), recipientRole: role, when },
        });
      }
      break; // never both the 1h and 24h reminder in the same run
    }
    if (isDue(m, "log_followup", now)) {
      candidates.push({
        dedupeKey: dedupe.meeting("log_followup", m.id, row.mentor.id),
        userId: row.mentor.id,
        email: row.mentor.email,
        kind: "log_followup",
        matchId: m.matchId,
        scheduledMeetingId: m.id,
        ctx: { appUrl: appUrl(), recipientFirstName: firstName(row.mentor), otherFirstName: firstName(row.mentee), recipientRole: "mentor", when },
      });
    }
  }

  if (mode === "off") {
    return { mode, liveSince: null, markedMissed, markedCompleted, candidates: 0, outcomes: null };
  }

  const since = await liveSince(now);
  const recentFloor = new Date(Math.max(since.getTime(), now.getTime() - 10 * DAY_MS));

  // ---- 2. Confirm-the-meeting + action items (logs since go-live) ----
  const logs = await db
    .select({
      id: meetingLogs.id,
      matchId: meetingLogs.matchId,
      createdBy: meetingLogs.createdBy,
      mentorConfirmed: meetingLogs.mentorConfirmed,
      menteeConfirmed: meetingLogs.menteeConfirmed,
      meetingDate: meetingLogs.meetingDate,
      actionItems: meetingLogs.actionItems,
      actionItemsDoneAt: meetingLogs.actionItemsDoneAt,
      mentor: personCols(mentor),
      mentee: personCols(mentee),
    })
    .from(meetingLogs)
    .innerJoin(matches, and(eq(matches.id, meetingLogs.matchId), eq(matches.status, "active")))
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(
      and(
        inArray(meetingLogs.eventKind, ["mentor_meeting", "touchpoint"]),
        gte(meetingLogs.createdAt, recentFloor),
        or(
          eq(meetingLogs.mentorConfirmed, false),
          eq(meetingLogs.menteeConfirmed, false),
          and(isNotNull(meetingLogs.actionItems), ne(meetingLogs.actionItems, ""), isNull(meetingLogs.actionItemsDoneAt))
        )
      )
    );
  for (const l of logs) {
    note(l.mentor, l.mentee);
    // Ask the side that didn't log it to confirm.
    const toMentee = l.createdBy === "mentor" && !l.menteeConfirmed;
    const toMentor = l.createdBy === "mentee" && !l.mentorConfirmed;
    if (toMentee || toMentor) {
      const to = toMentee ? l.mentee : l.mentor;
      const other = toMentee ? l.mentor : l.mentee;
      candidates.push({
        dedupeKey: dedupe.log("confirm_meeting", l.id, to.id),
        userId: to.id,
        email: to.email,
        kind: "confirm_meeting",
        matchId: l.matchId,
        ctx: { appUrl: appUrl(), recipientFirstName: firstName(to), otherFirstName: firstName(other), recipientRole: toMentee ? "mentee" : "mentor" },
      });
    }
    const age = now.getTime() - l.meetingDate.getTime();
    if (l.actionItems?.trim() && !l.actionItemsDoneAt && age >= 3 * DAY_MS && age < 10 * DAY_MS) {
      candidates.push({
        dedupeKey: dedupe.log("action_items", l.id, l.mentee.id),
        userId: l.mentee.id,
        email: l.mentee.email,
        kind: "action_items",
        matchId: l.matchId,
        ctx: { appUrl: appUrl(), recipientFirstName: firstName(l.mentee), otherFirstName: firstName(l.mentor), recipientRole: "mentee" },
      });
    }
  }

  // ---- 3. Inactivity nudges ----
  const active = await db
    .select({
      id: matches.id,
      startedAt: matches.startedAt,
      firstMeetingAt: matches.firstMeetingAt,
      lastInteractionAt: matches.lastInteractionAt,
      mentor: personCols(mentor),
      mentee: personCols(mentee),
    })
    .from(matches)
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(eq(matches.status, "active"));
  const schools = active.map((a) => schoolOf(a.mentee.email) ?? "*");
  const thresholds = await getThresholdsBySchool(schools);
  for (const a of active) {
    note(a.mentor, a.mentee);
    const t = thresholds.get(schoolOf(a.mentee.email) ?? "*")!;
    const nudge = pickInactivityNudge(a, t, now, since);
    if (!nudge) continue;
    for (const [to, other, role] of [
      [a.mentor, a.mentee, "mentor"],
      [a.mentee, a.mentor, "mentee"],
    ] as [Person, Person, "mentor" | "mentee"][]) {
      candidates.push({
        dedupeKey: dedupe.inactivity(nudge.kind, a.id, nudge.ref, to.id),
        userId: to.id,
        email: to.email,
        kind: nudge.kind,
        matchId: a.id,
        ctx: { appUrl: appUrl(), recipientFirstName: firstName(to), otherFirstName: firstName(other), recipientRole: role },
      });
    }
  }

  // ---- 4. Deliver (priority = the order above) ----
  // Removed (deactivated) accounts never get email.
  const sendable = candidates.filter((c) => !inactiveUsers.has(c.userId));
  const state = newRunState(mode, parseMaxPerRun(process.env.NOTIFICATIONS_MAX_PER_RUN));
  await primeRunState(state, sendable.map((c) => c.userId), now);
  for (const c of sendable) {
    await deliver(c, state, now);
  }
  return {
    mode,
    liveSince: since.toISOString(),
    markedMissed,
    markedCompleted,
    candidates: sendable.length,
    outcomes: state.outcomes,
  };
}
