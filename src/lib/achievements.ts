// Achievement engine.
//
// The catalog defines trophies by stable key. Each trophy has a tier
// (starter / progressive / hard), a check() that decides whether the
// student has earned it, and — for progressive trophies — a progress()
// that reports how close they are.
//
// Three data sources flow into checks:
//   - logs: the student's activity log rows
//   - profile: a snapshot of fields like firstName, major, careerInterests
//   - stats: TrophyStats (totals + streaks, includes signup priorCareerChats)
//
// KPI-style trophies (chat milestones, streaks, task counts) live entirely
// in `stats` so the math is computed once per evaluation and shared with
// the Trophy Case UI's progress bars.
import { db } from "@/db/client";
import {
  achievements,
  meetingLogs,
  users,
  type Achievement,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { weekRangeForDate } from "./kpis";
import { getTrophyStats, type TrophyStats } from "./trophy-stats";

export type LogForAchievement = {
  meetingDate: Date;
  accomplishmentGroup: "career_tasks" | "industry_experiences" | "career_chats" | null;
  topicsDiscussed: string | null;
};

// Subset of the user row used by profile-driven achievements (profile_complete).
export type ProfileSnapshot = {
  firstName: string | null;
  lastName: string | null;
  major: string | null;
  image: string | null;
  bio: string | null;
  careerInterests: string[] | null;
};

export type AchievementTier = "starter" | "progressive" | "hard";

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  tier: AchievementTier;
  // True if the student has earned this achievement. All three sources are
  // optional so legacy tests that only pass logs still work.
  check: (
    logs: LogForAchievement[],
    profile?: ProfileSnapshot,
    stats?: TrophyStats
  ) => boolean;
  // For progressive trophies: where the student is vs the target. UI shows
  // a "current / target" progress bar for locked rows. Return null if the
  // trophy is binary (earned/not — no scale).
  progress?: (
    logs: LogForAchievement[],
    profile?: ProfileSnapshot,
    stats?: TrophyStats
  ) => { current: number; target: number; unit: string } | null;
};

// ---- helpers ----

function topicMatches(log: LogForAchievement, needles: string[]): boolean {
  if (!log.topicsDiscussed) return false;
  const t = log.topicsDiscussed.toLowerCase();
  return needles.some((n) => t.includes(n.toLowerCase()));
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

// Factory for "≥N total career chats" trophies — keeps the catalog readable.
function totalChatsTrophy(opts: {
  key: string;
  title: string;
  description: string;
  tier: AchievementTier;
  target: number;
}): AchievementDef {
  return {
    key: opts.key,
    title: opts.title,
    description: opts.description,
    tier: opts.tier,
    check: (_l, _p, stats) =>
      stats != null && stats.totalCareerChats >= opts.target,
    progress: (_l, _p, stats) =>
      stats == null
        ? null
        : {
            current: Math.min(stats.totalCareerChats, opts.target),
            target: opts.target,
            unit: "Career Chats",
          },
  };
}

function streakTrophy(opts: {
  key: string;
  title: string;
  description: string;
  tier: AchievementTier;
  target: number;
}): AchievementDef {
  return {
    key: opts.key,
    title: opts.title,
    description: opts.description,
    tier: opts.tier,
    check: (_l, _p, stats) =>
      stats != null && stats.weeklyStreak >= opts.target,
    progress: (_l, _p, stats) =>
      stats == null
        ? null
        : {
            current: Math.min(stats.weeklyStreak, opts.target),
            target: opts.target,
            unit: opts.target === 1 ? "week" : "weeks",
          },
  };
}

function totalTasksTrophy(opts: {
  key: string;
  title: string;
  description: string;
  tier: AchievementTier;
  target: number;
}): AchievementDef {
  return {
    key: opts.key,
    title: opts.title,
    description: opts.description,
    tier: opts.tier,
    check: (_l, _p, stats) =>
      stats != null && stats.totalCareerTasks >= opts.target,
    progress: (_l, _p, stats) =>
      stats == null
        ? null
        : {
            current: Math.min(stats.totalCareerTasks, opts.target),
            target: opts.target,
            unit: "Career Tasks",
          },
  };
}

function monthlyChatGoalStreakTrophy(opts: {
  key: string;
  title: string;
  description: string;
  tier: AchievementTier;
  target: number;
}): AchievementDef {
  return {
    key: opts.key,
    title: opts.title,
    description: opts.description,
    tier: opts.tier,
    check: (_l, _p, stats) =>
      stats != null && stats.monthlyChatGoalStreak >= opts.target,
    progress: (_l, _p, stats) =>
      stats == null
        ? null
        : {
            current: Math.min(stats.monthlyChatGoalStreak, opts.target),
            target: opts.target,
            unit: opts.target === 1 ? "month" : "months",
          },
  };
}

// ---- catalogue ----

export const ACHIEVEMENTS: AchievementDef[] = [
  // ============================================================
  //  STARTER TROPHIES
  // ============================================================
  {
    key: "first_career_task",
    title: "First Career Task",
    description: "Logged your first weekly Career Task.",
    tier: "starter",
    check: (logs) => logs.some((l) => l.accomplishmentGroup === "career_tasks"),
  },
  // career_chat_starter key retained from earlier seasons — display title
  // updated to "First Career Chat" per the new copy.
  {
    key: "career_chat_starter",
    title: "First Career Chat",
    description:
      "Complete your first career chat or informational interview.",
    tier: "starter",
    check: (_l, _p, stats) => (stats?.totalCareerChats ?? 0) >= 1,
    progress: (_l, _p, stats) =>
      stats == null
        ? null
        : {
            current: Math.min(stats.totalCareerChats, 1),
            target: 1,
            unit: "Career Chat",
          },
  },
  totalChatsTrophy({
    key: "conversation_starter",
    title: "Conversation Starter",
    description: "Complete 3 total career chats.",
    tier: "starter",
    target: 3,
  }),
  {
    key: "resume_builder",
    title: "Resume Ready",
    description: "Log a resume-related Career Task.",
    tier: "starter",
    check: (logs) => logs.some((l) => topicMatches(l, ["resume"])),
  },
  {
    key: "interview_ready",
    title: "Interview Ready",
    description: "Log interview practice or skill-building.",
    tier: "starter",
    check: (logs) =>
      logs.some((l) => topicMatches(l, ["interviewing", "interview question"])),
  },
  // weekly_streak_starter key retained from earlier seasons; title is now
  // "Streak Starter" per the new naming.
  {
    key: "weekly_streak_starter",
    title: "Streak Starter",
    description:
      "Complete your weekly Career Task goal 2 weeks in a row.",
    tier: "starter",
    check: (_l, _p, stats) => (stats?.weeklyStreak ?? 0) >= 2,
    progress: (_l, _p, stats) =>
      stats == null
        ? null
        : {
            current: Math.min(stats.weeklyStreak, 2),
            target: 2,
            unit: "weeks",
          },
  },
  {
    key: "monthly_networker",
    title: "Monthly Networker",
    description: "Complete 3 Career Chats in one month.",
    tier: "starter",
    check: (logs) => {
      const counts = countsBy(
        logs.filter((l) => l.accomplishmentGroup === "career_chats"),
        (l) => monthKey(l.meetingDate)
      );
      return [...counts.values()].some((c) => c >= 3);
    },
  },
  {
    key: "profile_complete",
    title: "Profile Complete",
    description:
      "Filled out your profile — name, major, and at least one career interest — so mentors can find you.",
    tier: "starter",
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

  // ============================================================
  //  PROGRESSIVE TROPHIES
  // ============================================================
  // networking_builder key retained — meaning changes from "3 chats in a
  // month" (now monthly_networker) to "10 total career chats". Earned rows
  // from the old meaning persist; new earners need 10.
  totalChatsTrophy({
    key: "networking_builder",
    title: "Networking Builder",
    description: "Complete 10 total career chats.",
    tier: "progressive",
    target: 10,
  }),
  totalChatsTrophy({
    key: "connection_collector",
    title: "Connection Collector",
    description: "Complete 25 total career chats.",
    tier: "progressive",
    target: 25,
  }),
  totalChatsTrophy({
    key: "career_chat_champion",
    title: "Career Chat Champion",
    description: "Complete 50 total career chats.",
    tier: "progressive",
    target: 50,
  }),
  streakTrophy({
    key: "momentum_builder",
    title: "Momentum Builder",
    description:
      "Complete your weekly Career Task goal 4 weeks in a row.",
    tier: "progressive",
    target: 4,
  }),
  streakTrophy({
    key: "consistency_champion",
    title: "Consistency Champion",
    description:
      "Complete your weekly Career Task goal 8 weeks in a row.",
    tier: "progressive",
    target: 8,
  }),
  totalTasksTrophy({
    key: "career_builder",
    title: "Career Builder",
    description: "Complete 10 Career Tasks.",
    tier: "progressive",
    target: 10,
  }),
  // career_momentum key retained — meaning changes to "25 Career Tasks" per
  // the new spec. The old meaning was "tasks + chats in the same month".
  totalTasksTrophy({
    key: "career_momentum",
    title: "Career Momentum",
    description: "Complete 25 Career Tasks.",
    tier: "progressive",
    target: 25,
  }),
  monthlyChatGoalStreakTrophy({
    key: "networking_habit",
    title: "Networking Habit",
    description: "Complete the monthly Career Chat goal 2 months in a row.",
    tier: "progressive",
    target: 2,
  }),
  monthlyChatGoalStreakTrophy({
    key: "relationship_builder",
    title: "Relationship Builder",
    description: "Complete the monthly Career Chat goal 4 months in a row.",
    tier: "progressive",
    target: 4,
  }),
  {
    key: "internship_win",
    title: "Internship Win",
    description: "Logged an internship offer.",
    tier: "progressive",
    check: (logs) =>
      logs.some((l) => topicMatches(l, ["internship offer"])),
  },
  {
    key: "part_time_win",
    title: "Part-Time Career Win",
    description: "Logged a career-related part-time job offer.",
    tier: "progressive",
    check: (logs) =>
      logs.some((l) =>
        topicMatches(l, ["career-related, part-time job offer"])
      ),
  },
  {
    key: "full_time_win",
    title: "Full-Time Career Win",
    description: "Logged a career-related full-time job offer.",
    tier: "progressive",
    check: (logs) =>
      logs.some((l) =>
        topicMatches(l, ["career-related, full-time job offer"])
      ),
  },
  {
    key: "extra_mile",
    title: "Extra Mile",
    description: "Completed more than one Career Task in a single week.",
    tier: "progressive",
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
    tier: "progressive",
    check: (logs) => {
      const counts = countsBy(
        logs.filter((l) => l.accomplishmentGroup === "career_chats"),
        (l) => monthKey(l.meetingDate)
      );
      return [...counts.values()].some((c) => c > 3);
    },
  },
  {
    key: "can_standard_keeper",
    title: "CAN Standard Keeper",
    description:
      "Completed your weekly Career Task and the monthly Career Chats goal in the same period.",
    tier: "progressive",
    check: (logs) => {
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

  // ============================================================
  //  HARD TROPHIES
  // ============================================================
  totalChatsTrophy({
    key: "networking_legend",
    title: "Networking Legend",
    description: "Complete 100 total career chats.",
    tier: "hard",
    target: 100,
  }),
  streakTrophy({
    key: "semester_strong",
    title: "Semester Strong",
    description:
      "Complete your weekly Career Task goal 12 weeks in a row.",
    tier: "hard",
    target: 12,
  }),
  streakTrophy({
    key: "unstoppable",
    title: "Unstoppable",
    description:
      "Complete your weekly Career Task goal 24 weeks in a row.",
    tier: "hard",
    target: 24,
  }),
  totalTasksTrophy({
    key: "career_machine",
    title: "Career Machine",
    description: "Complete 50 Career Tasks.",
    tier: "hard",
    target: 50,
  }),
  monthlyChatGoalStreakTrophy({
    key: "networking_master",
    title: "Networking Master",
    description: "Complete the monthly Career Chat goal 6 months in a row.",
    tier: "hard",
    target: 6,
  }),
];

// Pure aggregator — runs every catalog check against logs + profile + stats.
export function evaluateAchievementSet(
  logs: LogForAchievement[],
  profile?: ProfileSnapshot,
  stats?: TrophyStats
): Set<string> {
  const earned = new Set<string>();
  for (const def of ACHIEVEMENTS) {
    if (def.check(logs, profile, stats)) earned.add(def.key);
  }
  return earned;
}

// ---- DB integration ----

// Fetches logs + profile + stats and runs every check. Returns only the
// newly-earned definitions so the UI can show a celebration.
export async function evaluateAchievementsForStudent(
  studentId: string
): Promise<{ newlyEarned: AchievementDef[] }> {
  const [logs, [userRow], stats] = await Promise.all([
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
    getTrophyStats(studentId),
  ]);

  const profile: ProfileSnapshot | undefined = userRow ?? undefined;
  const earnedKeys = evaluateAchievementSet(logs, profile, stats);
  if (earnedKeys.size === 0) return { newlyEarned: [] };

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

// Trophy Case + Settings strip — each item includes earned state, optional
// earnedAt, and (for progressive trophies) a progress {current, target}.
export type AchievementListing = {
  key: string;
  title: string;
  description: string;
  tier: AchievementTier;
  isEarned: boolean;
  earnedAt: Date | null;
  progress: { current: number; target: number; unit: string } | null;
};

export async function listAchievementsForStudent(
  studentId: string
): Promise<AchievementListing[]> {
  const [earned, logs, [userRow], stats] = await Promise.all([
    db
      .select()
      .from(achievements)
      .where(eq(achievements.studentId, studentId)),
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
    getTrophyStats(studentId),
  ]);

  const byKey = new Map<string, Achievement>();
  for (const e of earned) byKey.set(e.achievementKey, e);

  const profile: ProfileSnapshot | undefined = userRow ?? undefined;

  return ACHIEVEMENTS.map((a) => {
    const e = byKey.get(a.key);
    const p = a.progress?.(logs, profile, stats) ?? null;
    return {
      key: a.key,
      title: a.title,
      description: a.description,
      tier: a.tier,
      isEarned: Boolean(e),
      earnedAt: e?.earnedAt ?? null,
      progress: p,
    };
  });
}

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

export async function clearAchievementsForStudent(studentId: string) {
  await db.delete(achievements).where(and(eq(achievements.studentId, studentId)));
}
