// KPI engine — pure date/streak math + a Drizzle query layer for the dashboard,
// mentor mentee cards, and the activity-log page header.
//
// Weeks are Sunday → Saturday in local time. Months are calendar months.
// All counts are derived from the meeting_log table via accomplishment_group.
//
// The data functions live alongside the math so the API/UI never has to
// duplicate aggregation logic. Aggregations are intentionally cheap: a
// student's weekly/monthly state is bounded by a handful of rows.
import { db } from "@/db/client";
import { meetingLogs } from "@/db/schema";
import { and, eq, gte, inArray, lt } from "drizzle-orm";

// ---- Pure date helpers ----

// Sunday-start, local time, inclusive start and exclusive end so range
// comparisons can use [start, end).
export function weekRangeForDate(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  // Walk back to the most recent Sunday (getDay() === 0 means Sunday already).
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function monthRangeForDate(d: Date): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export function previousWeekRange(d: Date, weeksAgo: number): {
  start: Date;
  end: Date;
} {
  const { start } = weekRangeForDate(d);
  const newStart = new Date(start);
  newStart.setDate(newStart.getDate() - 7 * weeksAgo);
  const newEnd = new Date(newStart);
  newEnd.setDate(newEnd.getDate() + 7);
  return { start: newStart, end: newEnd };
}

// ---- Pure streak math ----

// Input: per-week completion booleans, index 0 = current week, index N = N
// weeks ago. Output: the current streak count and whether the current week is
// incomplete (which the UI uses to nudge "this week incomplete" copy).
//
// Streak semantics (per spec):
//   - If current week is complete: count consecutive completes from current.
//   - If current week is incomplete: count consecutive completes from last
//     week backwards — the streak is preserved across an in-progress week.
export function computeStreak(weekHasTask: boolean[]): {
  streak: number;
  thisWeekIncomplete: boolean;
} {
  const thisWeekIncomplete = !(weekHasTask[0] ?? false);
  const startIdx = thisWeekIncomplete ? 1 : 0;
  let streak = 0;
  for (let i = startIdx; i < weekHasTask.length; i++) {
    if (weekHasTask[i]) streak++;
    else break;
  }
  return { streak, thisWeekIncomplete };
}

// ---- DB-aware aggregations ----

export type StudentKpis = {
  weeklyCareerTask: { done: number; goal: 1; complete: boolean };
  monthlyCareerChats: { done: number; goal: 3; complete: boolean };
  weeklyStreak: number;
  thisWeekIncomplete: boolean;
};

// How many past weeks to inspect when computing the streak. A streak longer
// than this is shown as "26+" by the UI. Bounded so the query is cheap.
const STREAK_LOOKBACK_WEEKS = 26;

export async function getStudentKpis(
  studentId: string,
  now: Date = new Date()
): Promise<StudentKpis> {
  const week = weekRangeForDate(now);
  const month = monthRangeForDate(now);
  const earliest = previousWeekRange(now, STREAK_LOOKBACK_WEEKS).start;

  // Pull all rows in the lookback window once. Each row is small (a few
  // columns) and the per-student count over ~6 months is bounded.
  const rows = await db
    .select({
      meetingDate: meetingLogs.meetingDate,
      group: meetingLogs.accomplishmentGroup,
    })
    .from(meetingLogs)
    .where(
      and(
        eq(meetingLogs.studentId, studentId),
        gte(meetingLogs.meetingDate, earliest),
        lt(meetingLogs.meetingDate, week.end)
      )
    );

  let weeklyCareerTaskDone = 0;
  let monthlyCareerChatsDone = 0;
  const weekHasTask: boolean[] = new Array(STREAK_LOOKBACK_WEEKS + 1).fill(
    false
  );

  for (const r of rows) {
    const d = r.meetingDate;
    // Weekly career task count (current week only)
    if (r.group === "career_tasks" && d >= week.start && d < week.end) {
      weeklyCareerTaskDone++;
    }
    // Monthly career chats count (current month only)
    if (r.group === "career_chats" && d >= month.start && d < month.end) {
      monthlyCareerChatsDone++;
    }
    // Streak: mark the week index this date falls into
    if (r.group === "career_tasks") {
      const weeksBack = Math.floor(
        (week.start.getTime() - weekRangeForDate(d).start.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      const idx = weeksBack;
      if (idx >= 0 && idx < weekHasTask.length) weekHasTask[idx] = true;
    }
  }

  const { streak, thisWeekIncomplete } = computeStreak(weekHasTask);

  return {
    weeklyCareerTask: {
      done: weeklyCareerTaskDone,
      goal: 1,
      complete: weeklyCareerTaskDone >= 1,
    },
    monthlyCareerChats: {
      done: monthlyCareerChatsDone,
      goal: 3,
      complete: monthlyCareerChatsDone >= 3,
    },
    weeklyStreak: streak,
    thisWeekIncomplete,
  };
}

// Batch variant for the mentor's My Mentees grid — a single SQL fan-out keeps
// the page snappy even with a full mentor capacity (5–10 students).
export async function getStudentKpisBatch(
  studentIds: string[],
  now: Date = new Date()
): Promise<Map<string, StudentKpis>> {
  const out = new Map<string, StudentKpis>();
  if (studentIds.length === 0) return out;
  const week = weekRangeForDate(now);
  const month = monthRangeForDate(now);
  const earliest = previousWeekRange(now, STREAK_LOOKBACK_WEEKS).start;

  const rows = await db
    .select({
      studentId: meetingLogs.studentId,
      meetingDate: meetingLogs.meetingDate,
      group: meetingLogs.accomplishmentGroup,
    })
    .from(meetingLogs)
    .where(
      and(
        inArray(meetingLogs.studentId, studentIds),
        gte(meetingLogs.meetingDate, earliest),
        lt(meetingLogs.meetingDate, week.end)
      )
    );

  const byStudent = new Map<
    string,
    { weeklyTasks: number; monthlyChats: number; weekHasTask: boolean[] }
  >();
  for (const id of studentIds) {
    byStudent.set(id, {
      weeklyTasks: 0,
      monthlyChats: 0,
      weekHasTask: new Array(STREAK_LOOKBACK_WEEKS + 1).fill(false),
    });
  }

  for (const r of rows) {
    if (!r.studentId) continue;
    const bucket = byStudent.get(r.studentId);
    if (!bucket) continue;
    const d = r.meetingDate;
    if (r.group === "career_tasks" && d >= week.start && d < week.end) {
      bucket.weeklyTasks++;
    }
    if (r.group === "career_chats" && d >= month.start && d < month.end) {
      bucket.monthlyChats++;
    }
    if (r.group === "career_tasks") {
      const weeksBack = Math.floor(
        (week.start.getTime() - weekRangeForDate(d).start.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      if (weeksBack >= 0 && weeksBack < bucket.weekHasTask.length) {
        bucket.weekHasTask[weeksBack] = true;
      }
    }
  }

  for (const id of studentIds) {
    const b = byStudent.get(id)!;
    const { streak, thisWeekIncomplete } = computeStreak(b.weekHasTask);
    out.set(id, {
      weeklyCareerTask: {
        done: b.weeklyTasks,
        goal: 1,
        complete: b.weeklyTasks >= 1,
      },
      monthlyCareerChats: {
        done: b.monthlyChats,
        goal: 3,
        complete: b.monthlyChats >= 3,
      },
      weeklyStreak: streak,
      thisWeekIncomplete,
    });
  }

  return out;
}
