// Achievement engine — pure check functions over a fetched log array, plus a
// thin DB layer that loads logs, runs every check, and upserts earned rows.
//
// Why pure: TDD-friendly and the entire catalogue runs in one pass over a
// short in-memory array (one student's logs over their lifetime). No N+1 SQL.
import { db } from "@/db/client";
import {
  achievements,
  meetingLogs,
  users,
  type Achievement,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { weekRangeForDate, monthRangeForDate } from "./kpis";

export type LogForAchievement = {
  meetingDate: Date;
  accomplishmentGroup: "career_tasks" | "industry_experiences" | "career_chats" | null;
  topicsDiscussed: string | null;
};

// Subset of the user row needed by profile-driven achievements (e.g.
// profile_complete). Kept separate from the row type so future callers can
// build a snapshot from any source.
export type ProfileSnapshot = {
  firstName: string | null;
  lastName: string | null;
  major: string | null;
  image: string | null;
  bio: string | null;
  careerInterests: string[] | null;
};

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  // True if the student has earned this achievement. Some checks read logs,
  // some read the profile snapshot, some read both — all three signatures are
  // expressible via the optional second argument.
  check: (logs: LogForAchievement[], profile?: ProfileSnapshot) => boolean;
};

// ---- helpers ----

function topicMatches(log: LogForAchievement, needles: string[]): boolean {
  if (!log.topicsDiscussed) return false;
  const t = log.topicsDiscussed;
  return needles.some((n) => t.includes(n));
}

function weekKey(d: Date): number {
  const { start } = weekRangeForDate(d);
  return start.getTime();
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function countsBy<T>(items: T[], key: (x: T) => string | number) {
  const map = new Map<string | number, number>();
  for (const x of items) {
    const k = key(x);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function hasConsecutiveWeeks(weeks: Set<number>, runLength: number): boolean {
  if (weeks.size < runLength) return false;
  const sorted = [...weeks].sort((a, b) => a - b);
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 7 * 24 * 60 * 60 * 1000) {
      run++;
      if (run >= runLength) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

// ---- catalogue ----

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "first_career_task",
    title: "First Career Task",
    description: "Logged your first weekly Career Task.",
    check: (logs) => logs.some((l) => l.accomplishmentGroup === "career_tasks"),
  },
  {
    key: "weekly_streak_starter",
    title: "Weekly Streak Starter",
    description: "Completed your weekly Career Task two weeks in a row.",
    check: (logs) => {
      const weeks = new Set(
        logs
          .filter((l) => l.accomplishmentGroup === "career_tasks")
          .map((l) => weekKey(l.meetingDate))
      );
      return hasConsecutiveWeeks(weeks, 2);
    },
  },
  {
    key: "career_chat_starter",
    title: "Career Chat Starter",
    description: "Logged your first Career Chat.",
    check: (logs) => logs.some((l) => l.accomplishmentGroup === "career_chats"),
  },
  {
    key: "networking_builder",
    title: "Networking Builder",
    description: "Completed three Career Chats in a single month.",
    check: (logs) => {
      const counts = countsBy(
        logs.filter((l) => l.accomplishmentGroup === "career_chats"),
        (l) => monthKey(l.meetingDate)
      );
      return [...counts.values()].some((c) => c >= 3);
    },
  },
  {
    key: "internship_win",
    title: "Internship Win",
    description: "Logged an internship offer.",
    check: (logs) =>
      logs.some((l) =>
        topicMatches(l, ["My mentee got an internship offer"])
      ),
  },
  {
    key: "part_time_win",
    title: "Part-Time Career Win",
    description: "Logged a career-related part-time job offer.",
    check: (logs) =>
      logs.some((l) =>
        topicMatches(l, ["career-related, part-time job offer"])
      ),
  },
  {
    key: "full_time_win",
    title: "Full-Time Career Win",
    description: "Logged a career-related full-time job offer.",
    check: (logs) =>
      logs.some((l) =>
        topicMatches(l, ["career-related, full-time job offer"])
      ),
  },
  {
    key: "resume_builder",
    title: "Resume Builder",
    description: "Logged work on your resume.",
    check: (logs) => logs.some((l) => topicMatches(l, ["Work on Resumes"])),
  },
  {
    key: "interview_ready",
    title: "Interview Ready",
    description: "Logged interview practice or skill-building.",
    check: (logs) =>
      logs.some((l) =>
        topicMatches(l, ["Work on Interviewing Skills", "Role Play Interviewing"])
      ),
  },
  {
    key: "can_standard_keeper",
    title: "CAN Standard Keeper",
    description:
      "Completed your weekly Career Task and the monthly Career Chats goal in the same period.",
    check: (logs) => {
      // For any month that has >=3 career_chats, check whether any week in
      // that month also had >=1 career_tasks.
      const chatsByMonth = countsBy(
        logs.filter((l) => l.accomplishmentGroup === "career_chats"),
        (l) => monthKey(l.meetingDate)
      );
      const goalMonths = new Set(
        [...chatsByMonth.entries()].filter(([, c]) => c >= 3).map(([m]) => m)
      );
      if (goalMonths.size === 0) return false;
      return logs.some(
        (l) =>
          l.accomplishmentGroup === "career_tasks" &&
          goalMonths.has(monthKey(l.meetingDate))
      );
    },
  },
  {
    key: "extra_mile",
    title: "Extra Mile",
    description: "Completed more than one Career Task in a single week.",
    check: (logs) => {
      const counts = countsBy(
        logs.filter((l) => l.accomplishmentGroup === "career_tasks"),
        (l) => weekKey(l.meetingDate)
      );
      return [...counts.values()].some((c) => c > 1);
    },
  },
  {
    key: "conversation_builder",
    title: "Conversation Builder",
    description: "Completed more than three Career Chats in a single month.",
    check: (logs) => {
      const counts = countsBy(
        logs.filter((l) => l.accomplishmentGroup === "career_chats"),
        (l) => monthKey(l.meetingDate)
      );
      return [...counts.values()].some((c) => c > 3);
    },
  },
  {
    key: "career_momentum",
    title: "Career Momentum",
    description:
      "Completed Career Tasks and Career Chats in the same month.",
    check: (logs) => {
      const taskMonths = new Set(
        logs
          .filter((l) => l.accomplishmentGroup === "career_tasks")
          .map((l) => monthKey(l.meetingDate))
      );
      const chatMonths = logs
        .filter((l) => l.accomplishmentGroup === "career_chats")
        .map((l) => monthKey(l.meetingDate));
      return chatMonths.some((m) => taskMonths.has(m));
    },
  },
  {
    key: "industry_breakthrough",
    title: "Industry Breakthrough",
    description: "Logged an internship or job offer.",
    check: (logs) =>
      logs.some((l) => l.accomplishmentGroup === "industry_experiences"),
  },
  {
    key: "profile_complete",
    title: "Profile Complete",
    description:
      "Filled out your profile — name, major, and at least one career interest — so mentors can find you.",
    check: (_logs, profile) => {
      if (!profile) return false;
      const hasName = Boolean(
        profile.firstName?.trim() && profile.lastName?.trim()
      );
      const hasMajor = Boolean(profile.major?.trim());
      const hasInterest =
        Array.isArray(profile.careerInterests) &&
        profile.careerInterests.length > 0;
      return hasName && hasMajor && hasInterest;
    },
  },
];

// Pure aggregator — returns the set of earned keys for a given log array and
// optional profile snapshot. Exported for the unit tests; the DB-aware
// variants below call this.
export function evaluateAchievementSet(
  logs: LogForAchievement[],
  profile?: ProfileSnapshot
): Set<string> {
  const earned = new Set<string>();
  for (const def of ACHIEVEMENTS) {
    if (def.check(logs, profile)) earned.add(def.key);
  }
  return earned;
}

// ---- DB integration ----

// Fetches a student's logs, runs every check, and upserts newly-earned rows.
// Returns the freshly-earned definitions so the UI can show a celebration.
export async function evaluateAchievementsForStudent(
  studentId: string
): Promise<{ newlyEarned: AchievementDef[] }> {
  const [logs, [userRow]] = await Promise.all([
    db
      .select({
        meetingDate: meetingLogs.meetingDate,
        accomplishmentGroup: meetingLogs.accomplishmentGroup,
        topicsDiscussed: meetingLogs.topicsDiscussed,
      })
      .from(meetingLogs)
      .where(eq(meetingLogs.studentId, studentId)),
    db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        major: users.major,
        image: users.image,
        bio: users.bio,
        careerInterests: users.careerInterests,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1),
  ]);

  const profile: ProfileSnapshot | undefined = userRow ?? undefined;
  const earnedKeys = evaluateAchievementSet(logs, profile);
  if (earnedKeys.size === 0) return { newlyEarned: [] };

  // Read what's already persisted so we only insert deltas (and so the toast
  // doesn't fire for re-evaluations).
  const existing = await db
    .select({ achievementKey: achievements.achievementKey })
    .from(achievements)
    .where(eq(achievements.studentId, studentId));
  const have = new Set(existing.map((r) => r.achievementKey));

  const newKeys = [...earnedKeys].filter((k) => !have.has(k));
  if (newKeys.length === 0) return { newlyEarned: [] };

  await db
    .insert(achievements)
    .values(newKeys.map((k) => ({ studentId, achievementKey: k })))
    .onConflictDoNothing();

  return {
    newlyEarned: ACHIEVEMENTS.filter((a) => newKeys.includes(a.key)),
  };
}

// Read the full catalog joined to a student's earned rows. Used by the Trophy
// Case page and the Settings mini-strip.
export async function listAchievementsForStudent(
  studentId: string
): Promise<
  {
    key: string;
    title: string;
    description: string;
    isEarned: boolean;
    earnedAt: Date | null;
  }[]
> {
  const earned = await db
    .select()
    .from(achievements)
    .where(eq(achievements.studentId, studentId));
  const byKey = new Map<string, Achievement>();
  for (const e of earned) byKey.set(e.achievementKey, e);

  return ACHIEVEMENTS.map((a) => {
    const e = byKey.get(a.key);
    return {
      key: a.key,
      title: a.title,
      description: a.description,
      isEarned: Boolean(e),
      earnedAt: e?.earnedAt ?? null,
    };
  });
}

// Convenience used by the dashboard / settings: list of newly-earned keys
// that haven't been "viewed" yet. We don't currently track a viewed flag, so
// this is just the earned-at-descending list; the UI can decide what to show.
export async function recentlyEarnedAchievements(
  studentId: string,
  limit = 3
): Promise<Achievement[]> {
  return db
    .select()
    .from(achievements)
    .where(eq(achievements.studentId, studentId))
    .orderBy(sql`${achievements.earnedAt} desc`)
    .limit(limit);
}

// Guarded helper used by an admin route (Phase 2) and seeding to reset a
// student's earned set. Safe no-op for non-admin callers — caller must do its
// own auth gate first.
export async function clearAchievementsForStudent(studentId: string) {
  await db.delete(achievements).where(and(eq(achievements.studentId, studentId)));
}
