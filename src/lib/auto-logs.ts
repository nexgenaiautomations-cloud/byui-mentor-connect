// Auto-log engine — when a student log tips a weekly or monthly KPI
// threshold, write a system-generated row to meeting_log so the goal
// completion shows up in activity history.
//
// Dedup invariant: at most one system log per (studentId, period, kpi).
// The check uses a "marker" string in topics_discussed + the meetingDate
// range so we don't need a separate "auto_logs" table.
import { db } from "@/db/client";
import { meetingLogs } from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { weekRangeForDate, monthRangeForDate, getStudentKpis } from "./kpis";

export const WEEKLY_AUTO_LOG_TOPIC = "Weekly Career Task goal completed";
export const MONTHLY_AUTO_LOG_TOPIC = "Monthly Career Chats goal completed";

// ---- pure decision helpers (unit-tested) ----

export function shouldCreateWeeklyAutoLog(
  currentCount: number,
  alreadyExists: boolean
): boolean {
  return currentCount >= 1 && !alreadyExists;
}

export function shouldCreateMonthlyAutoLog(
  currentCount: number,
  alreadyExists: boolean
): boolean {
  return currentCount >= 3 && !alreadyExists;
}

// ---- DB-aware: call after a successful student log insert ----

// Returns the list of auto-logs created on this call (0–2) so the caller can
// surface a "goal completed" toast.
export async function maybeCreateAutoLogs(
  studentId: string,
  now: Date = new Date()
): Promise<{ created: ("weekly" | "monthly")[] }> {
  const kpis = await getStudentKpis(studentId, now);
  const week = weekRangeForDate(now);
  const month = monthRangeForDate(now);
  const created: ("weekly" | "monthly")[] = [];

  // Weekly auto-log
  const existingWeekly = await db
    .select({ id: meetingLogs.id })
    .from(meetingLogs)
    .where(
      and(
        eq(meetingLogs.studentId, studentId),
        eq(meetingLogs.isSystemGenerated, true),
        eq(meetingLogs.topicsDiscussed, WEEKLY_AUTO_LOG_TOPIC),
        gte(meetingLogs.meetingDate, week.start),
        lt(meetingLogs.meetingDate, week.end)
      )
    )
    .limit(1);

  if (
    shouldCreateWeeklyAutoLog(
      kpis.weeklyCareerTask.done,
      existingWeekly.length > 0
    )
  ) {
    // onConflictDoNothing: the partial unique index meeting_log_weekly_auto_uniq
    // (scripts/apply-security-indexes.ts) closes the race where two concurrent
    // log submissions both pass the SELECT above.
    const inserted = await db
      .insert(meetingLogs)
      .values({
        studentId,
        menteeId: studentId,
        createdBy: "system",
        isSystemGenerated: true,
        accomplishmentGroup: "career_tasks",
        meetingDate: now,
        meetingType: "other",
        topicsDiscussed: WEEKLY_AUTO_LOG_TOPIC,
      })
      .onConflictDoNothing()
      .returning({ id: meetingLogs.id });
    if (inserted.length > 0) created.push("weekly");
  }

  // Monthly auto-log
  const existingMonthly = await db
    .select({ id: meetingLogs.id })
    .from(meetingLogs)
    .where(
      and(
        eq(meetingLogs.studentId, studentId),
        eq(meetingLogs.isSystemGenerated, true),
        eq(meetingLogs.topicsDiscussed, MONTHLY_AUTO_LOG_TOPIC),
        gte(meetingLogs.meetingDate, month.start),
        lt(meetingLogs.meetingDate, month.end)
      )
    )
    .limit(1);

  if (
    shouldCreateMonthlyAutoLog(
      kpis.monthlyCareerChats.done,
      existingMonthly.length > 0
    )
  ) {
    // Same race-closing pattern as the weekly insert above, backed by
    // meeting_log_monthly_auto_uniq.
    const inserted = await db
      .insert(meetingLogs)
      .values({
        studentId,
        menteeId: studentId,
        createdBy: "system",
        isSystemGenerated: true,
        accomplishmentGroup: "career_chats",
        meetingDate: now,
        meetingType: "other",
        topicsDiscussed: MONTHLY_AUTO_LOG_TOPIC,
      })
      .onConflictDoNothing()
      .returning({ id: meetingLogs.id });
    if (inserted.length > 0) created.push("monthly");
  }

  return { created };
}
