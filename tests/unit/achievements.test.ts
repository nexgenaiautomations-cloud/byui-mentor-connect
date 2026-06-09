import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  evaluateAchievementSet,
  type LogForAchievement,
  type ProfileSnapshot,
} from "@/lib/achievements";
import type { TrophyStats } from "@/lib/trophy-stats";

function log(opts: Partial<LogForAchievement> = {}): LogForAchievement {
  return {
    meetingDate: opts.meetingDate ?? new Date(2026, 2, 4),
    accomplishmentGroup: opts.accomplishmentGroup ?? "career_tasks",
    topicsDiscussed: opts.topicsDiscussed ?? "Worked on my resume",
  };
}

function stats(o: Partial<TrophyStats> = {}): TrophyStats {
  return {
    priorCareerChats: 0,
    loggedCareerChats: 0,
    totalCareerChats: 0,
    totalCareerTasks: 0,
    totalIndustryExperiences: 0,
    weeklyStreak: 0,
    thisWeekIncomplete: false,
    monthlyChatGoalStreak: 0,
    ...o,
  };
}

const FULL_PROFILE: ProfileSnapshot = {
  firstName: "Mason",
  lastName: "Member",
  major: "Marketing",
  image: null,
  bio: null,
  careerInterests: ["Brand Management — Consumer Marketing"],
};

describe("ACHIEVEMENTS catalogue", () => {
  it("does NOT include industry_breakthrough anymore", () => {
    expect(ACHIEVEMENTS.find((a) => a.key === "industry_breakthrough")).toBeUndefined();
  });

  it("every entry has a tier in {starter, progressive, hard}", () => {
    for (const a of ACHIEVEMENTS) {
      expect(["starter", "progressive", "hard"]).toContain(a.tier);
    }
  });

  it("includes the spec'd career chat milestone keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    for (const key of [
      "career_chat_starter", // 1
      "conversation_starter", // 3
      "networking_builder", // 10
      "connection_collector", // 25
      "career_chat_champion", // 50
      "networking_legend", // 100
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("includes the spec'd weekly streak milestone keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    for (const key of [
      "weekly_streak_starter", // 2
      "momentum_builder", // 4
      "consistency_champion", // 8
      "semester_strong", // 12
      "unstoppable", // 24
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("includes the spec'd career task milestone keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    for (const key of [
      "first_career_task",
      "resume_builder",
      "career_builder", // 10
      "career_momentum", // 25
      "career_machine", // 50
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("includes the spec'd monthly chat goal streak keys", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    for (const key of [
      "monthly_networker",
      "networking_habit",
      "relationship_builder",
      "networking_master",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("retains profile_complete + the three offer wins", () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    for (const key of [
      "profile_complete",
      "internship_win",
      "part_time_win",
      "full_time_win",
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("every progressive/hard milestone trophy exposes a progress fn", () => {
    const progressiveKeys = [
      "networking_builder",
      "connection_collector",
      "career_chat_champion",
      "momentum_builder",
      "consistency_champion",
      "career_builder",
      "career_momentum",
      "networking_habit",
      "relationship_builder",
      "networking_legend",
      "semester_strong",
      "unstoppable",
      "career_machine",
      "networking_master",
    ];
    for (const k of progressiveKeys) {
      const def = ACHIEVEMENTS.find((a) => a.key === k);
      expect(def?.progress).toBeDefined();
    }
  });
});

describe("evaluateAchievementSet", () => {
  it("returns empty when nothing has happened", () => {
    expect(evaluateAchievementSet([])).toEqual(new Set());
  });

  it("first_career_task fires on a single career_tasks log", () => {
    const earned = evaluateAchievementSet([
      log({ accomplishmentGroup: "career_tasks" }),
    ]);
    expect(earned.has("first_career_task")).toBe(true);
  });

  it("career_chat_starter fires when totalCareerChats >= 1 (via stats)", () => {
    const earned = evaluateAchievementSet([], undefined, stats({ totalCareerChats: 1 }));
    expect(earned.has("career_chat_starter")).toBe(true);
  });

  it("totalChatsTrophy milestones key off TrophyStats.totalCareerChats", () => {
    const s10 = stats({ totalCareerChats: 10 });
    const earned = evaluateAchievementSet([], undefined, s10);
    expect(earned.has("conversation_starter")).toBe(true);
    expect(earned.has("networking_builder")).toBe(true);
    expect(earned.has("connection_collector")).toBe(false);

    const s100 = stats({ totalCareerChats: 100 });
    const all = evaluateAchievementSet([], undefined, s100);
    expect(all.has("networking_legend")).toBe(true);
    expect(all.has("career_chat_champion")).toBe(true);
  });

  it("streak trophies key off weeklyStreak", () => {
    expect(
      evaluateAchievementSet([], undefined, stats({ weeklyStreak: 2 })).has(
        "weekly_streak_starter"
      )
    ).toBe(true);
    expect(
      evaluateAchievementSet([], undefined, stats({ weeklyStreak: 4 })).has(
        "momentum_builder"
      )
    ).toBe(true);
    expect(
      evaluateAchievementSet([], undefined, stats({ weeklyStreak: 24 })).has(
        "unstoppable"
      )
    ).toBe(true);
    expect(
      evaluateAchievementSet([], undefined, stats({ weeklyStreak: 1 })).has(
        "weekly_streak_starter"
      )
    ).toBe(false);
  });

  it("career task milestone trophies key off totalCareerTasks", () => {
    expect(
      evaluateAchievementSet([], undefined, stats({ totalCareerTasks: 25 })).has(
        "career_momentum"
      )
    ).toBe(true);
    expect(
      evaluateAchievementSet([], undefined, stats({ totalCareerTasks: 50 })).has(
        "career_machine"
      )
    ).toBe(true);
    expect(
      evaluateAchievementSet([], undefined, stats({ totalCareerTasks: 9 })).has(
        "career_builder"
      )
    ).toBe(false);
  });

  it("monthly chat-goal streak trophies fire by monthlyChatGoalStreak", () => {
    expect(
      evaluateAchievementSet([], undefined, stats({ monthlyChatGoalStreak: 2 }))
        .has("networking_habit")
    ).toBe(true);
    expect(
      evaluateAchievementSet([], undefined, stats({ monthlyChatGoalStreak: 6 }))
        .has("networking_master")
    ).toBe(true);
    expect(
      evaluateAchievementSet([], undefined, stats({ monthlyChatGoalStreak: 3 }))
        .has("relationship_builder")
    ).toBe(false);
  });

  it("monthly_networker fires from logs when ≥3 chats in any month", () => {
    const three = evaluateAchievementSet(
      [1, 8, 15].map((d) =>
        log({
          accomplishmentGroup: "career_chats",
          meetingDate: new Date(2026, 2, d),
        })
      )
    );
    expect(three.has("monthly_networker")).toBe(true);
    const two = evaluateAchievementSet(
      [1, 8].map((d) =>
        log({
          accomplishmentGroup: "career_chats",
          meetingDate: new Date(2026, 2, d),
        })
      )
    );
    expect(two.has("monthly_networker")).toBe(false);
  });

  it("internship/part-time/full-time wins still fire on the topic text", () => {
    const earned = evaluateAchievementSet([
      log({
        accomplishmentGroup: "industry_experiences",
        topicsDiscussed: "My mentee got an internship offer",
      }),
    ]);
    expect(earned.has("internship_win")).toBe(true);
    expect(earned.has("part_time_win")).toBe(false);
    const mentee = evaluateAchievementSet([
      log({
        accomplishmentGroup: "industry_experiences",
        topicsDiscussed: "I got an internship offer",
      }),
    ]);
    expect(mentee.has("internship_win")).toBe(true);
  });

  it("resume_builder + interview_ready remain log-driven", () => {
    expect(
      evaluateAchievementSet([log({ topicsDiscussed: "Worked on my resume" })])
        .has("resume_builder")
    ).toBe(true);
    expect(
      evaluateAchievementSet([
        log({ topicsDiscussed: "Practiced interviewing skills" }),
      ]).has("interview_ready")
    ).toBe(true);
  });

  it("profile_complete needs name + major + ≥1 career interest", () => {
    expect(evaluateAchievementSet([], FULL_PROFILE).has("profile_complete")).toBe(
      true
    );
    expect(evaluateAchievementSet([]).has("profile_complete")).toBe(false);
  });
});

describe("progress functions", () => {
  it("totalChats progress is current/target with the right unit", () => {
    const def = ACHIEVEMENTS.find((a) => a.key === "networking_builder")!;
    const p = def.progress?.([], undefined, stats({ totalCareerChats: 7 }));
    expect(p).toEqual({ current: 7, target: 10, unit: "Career Chats" });
  });

  it("progress caps at the target", () => {
    const def = ACHIEVEMENTS.find((a) => a.key === "conversation_starter")!;
    const p = def.progress?.([], undefined, stats({ totalCareerChats: 100 }));
    expect(p?.current).toBe(3);
  });

  it("streak progress uses weeks unit", () => {
    const def = ACHIEVEMENTS.find((a) => a.key === "momentum_builder")!;
    const p = def.progress?.([], undefined, stats({ weeklyStreak: 2 }));
    expect(p).toEqual({ current: 2, target: 4, unit: "weeks" });
  });

  it("monthly chat-goal streak progress uses months unit", () => {
    const def = ACHIEVEMENTS.find((a) => a.key === "networking_habit")!;
    const p = def.progress?.([], undefined, stats({ monthlyChatGoalStreak: 1 }));
    expect(p).toEqual({ current: 1, target: 2, unit: "months" });
  });
});
