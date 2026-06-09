// Aggregate stats for the Trophy Case and the achievement engine.
//
// Pulls a student's activity logs, the saved priorCareerChats value from
// signup, and computes the rolled-up totals + streaks the trophy catalog
// needs. All counts include both mentee-self-logs and mentor-logged rows
// that belong to the student.
import { db } from "@/db/client";
import { meetingLogs, users } from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import {
  computeStreak,
  monthRangeForDate,
  previousWeekRange,
  weekRangeForDate,
} from "./kpis";

export type TrophyStats = {
  priorCareerChats: number;
  loggedCareerChats: number;
  totalCareerChats: number;
  totalCareerTasks: number;
  totalIndustryExperiences: number;
  weeklyStreak: number;
  thisWeekIncomplete: boolean;
  // Consecutive months hitting ≥3 career chats, walking back from the most
  // recent complete month (excludes the current month if it isn't complete
  // yet, same logic as the weekly streak).
  monthlyChatGoalStreak: number;
};

// Parse the priorCareerChats field, which may be:
//   - a clean numeric string ("5", "100") — new signup path
//   - a legacy range string ("0", "1-10", "11-25", "26-50", "51-100", "100+")
//   - null / undefined for accounts created before the field existed
//
// Ranges resolve to a sensible midpoint so old users don't lose all their
// pre-existing chat count, but new signups always store a clean number.
export function parsePriorCareerChats(value: string | null | undefined): number {
  if (value == null) return 0;
  const trimmed = String(value).trim();
  if (!trimmed) return 0;

  // Quick path: parseable as a non-negative integer
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  // Legacy ranges
  const RANGE: Record<string, number> = {
    "0": 0,
    "1-10": 5,
    "11-25": 18,
    "26-50": 38,
    "51-100": 75,
    "100+": 100,
  };
  if (RANGE[trimmed] !== undefined) return RANGE[trimmed];

  // "10-15" or other generic ranges — average them.
  const match = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (match) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.round((a + b) / 2);
  }

  // "100+" / "50+" style with anything else trailing
  const plus = trimmed.match(/^(\d+)\+/);
  if (plus) return Number(plus[1]);

  return 0;
}

const STREAK_LOOKBACK_WEEKS = 60;
const MONTH_STREAK_LOOKBACK = 12;

// Single DB round-trip for everything the catalog needs.
export async function getTrophyStats(
  studentId: string,
  now: Date = new Date()
): Promise<TrophyStats> {
  const earliest = previousWeekRange(now, STREAK_LOOKBACK_WEEKS).start;

  const [userRow] = await db
    .select({ priorCareerChats: users.priorCareerChats })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);
  const priorCareerChats = parsePriorCareerChats(
    userRow?.priorCareerChats ?? null
  );

  // Pull every log for this student in the lookback window. Cheap enough for
  // a single student — bounded by ~60 weeks of activity.
  const logs = await db
    .select({
      meetingDate: meetingLogs.meetingDate,
      group: meetingLogs.accomplishmentGroup,
    })
    .from(meetingLogs)
    .where(
      and(
        eq(meetingLogs.studentId, studentId),
        gte(meetingLogs.meetingDate, earliest),
        lt(meetingLogs.meetingDate, weekRangeForDate(now).end)
      )
    );

  // Lifetime totals (within the lookback window — anything older is rare in
  // practice and would slow the streak calc).
  let loggedCareerChats = 0;
  let totalCareerTasks = 0;
  let totalIndustryExperiences = 0;
  // Per-week career_task flag for streak math
  const week = weekRangeForDate(now);
  const weekHasTask: boolean[] = new Array(STREAK_LOOKBACK_WEEKS + 1).fill(
    false
  );
  // Per-month career_chat counts for monthly-streak math
  const monthChats = new Array(MONTH_STREAK_LOOKBACK + 1).fill(0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  for (const r of logs) {
    if (r.group === "career_chats") loggedCareerChats++;
    if (r.group === "career_tasks") totalCareerTasks++;
    if (r.group === "industry_experiences") totalIndustryExperiences++;

    if (r.group === "career_tasks") {
      const weeksBack = Math.floor(
        (week.start.getTime() - weekRangeForDate(r.meetingDate).start.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      if (weeksBack >= 0 && weeksBack < weekHasTask.length) {
        weekHasTask[weeksBack] = true;
      }
    }
    if (r.group === "career_chats") {
      const monthsBack =
        (monthStart.getFullYear() - r.meetingDate.getFullYear()) * 12 +
        (monthStart.getMonth() - r.meetingDate.getMonth());
      if (monthsBack >= 0 && monthsBack < monthChats.length) {
        monthChats[monthsBack]++;
      }
    }
  }

  const { streak: weeklyStreak, thisWeekIncomplete } =
    computeStreak(weekHasTask);

  // Monthly chat-goal streak: consecutive months with ≥3 chats. Skip the
  // current month if it hasn't hit 3 yet (same forgive-this-period rule as
  // the weekly streak).
  let monthlyChatGoalStreak = 0;
  const startIdx = monthChats[0] >= 3 ? 0 : 1;
  for (let i = startIdx; i < monthChats.length; i++) {
    if (monthChats[i] >= 3) monthlyChatGoalStreak++;
    else break;
  }
  // Silence unused-import warning for monthRangeForDate (kept so future
  // refactors can use it without re-adding the import).
  void monthRangeForDate;

  return {
    priorCareerChats,
    loggedCareerChats,
    totalCareerChats: priorCareerChats + loggedCareerChats,
    totalCareerTasks,
    totalIndustryExperiences,
    weeklyStreak,
    thisWeekIncomplete,
    monthlyChatGoalStreak,
  };
}
