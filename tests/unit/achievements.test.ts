import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  evaluateAchievementSet,
  type LogForAchievement,
} from "@/lib/achievements";

function log(opts: Partial<LogForAchievement> = {}): LogForAchievement {
  return {
    meetingDate: opts.meetingDate ?? new Date(2026, 2, 4),
    accomplishmentGroup: opts.accomplishmentGroup ?? "career_tasks",
    topicsDiscussed: opts.topicsDiscussed ?? "Work on Resumes",
  };
}

describe("ACHIEVEMENTS catalogue", () => {
  it("has exactly the 14 keys spec'd", () => {
    expect(ACHIEVEMENTS.map((a) => a.key).sort()).toEqual(
      [
        "first_career_task",
        "weekly_streak_starter",
        "career_chat_starter",
        "networking_builder",
        "internship_win",
        "part_time_win",
        "full_time_win",
        "resume_builder",
        "interview_ready",
        "can_standard_keeper",
        "extra_mile",
        "conversation_builder",
        "career_momentum",
        "industry_breakthrough",
      ].sort()
    );
  });

  it("every achievement has a non-empty title and description", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });
});

describe("evaluateAchievementSet", () => {
  it("returns empty when there are no logs", () => {
    expect(evaluateAchievementSet([])).toEqual(new Set());
  });

  it("first_career_task fires on a single career_tasks log", () => {
    const earned = evaluateAchievementSet([log({ accomplishmentGroup: "career_tasks" })]);
    expect(earned.has("first_career_task")).toBe(true);
  });

  it("career_chat_starter fires on a single career_chats log", () => {
    const earned = evaluateAchievementSet([log({ accomplishmentGroup: "career_chats" })]);
    expect(earned.has("career_chat_starter")).toBe(true);
    expect(earned.has("first_career_task")).toBe(false);
  });

  it("weekly_streak_starter requires 2 distinct weeks of career_tasks", () => {
    const oneWeek = evaluateAchievementSet([
      log({ meetingDate: new Date(2026, 2, 4) }), // Wed Mar 4
    ]);
    expect(oneWeek.has("weekly_streak_starter")).toBe(false);

    const twoWeeks = evaluateAchievementSet([
      log({ meetingDate: new Date(2026, 2, 4) }), // week of Mar 1
      log({ meetingDate: new Date(2026, 2, 11) }), // week of Mar 8
    ]);
    expect(twoWeeks.has("weekly_streak_starter")).toBe(true);
  });

  it("weekly_streak_starter ignores non-consecutive weeks", () => {
    const gap = evaluateAchievementSet([
      log({ meetingDate: new Date(2026, 2, 4) }), // week of Mar 1
      log({ meetingDate: new Date(2026, 2, 18) }), // week of Mar 15 — gap
    ]);
    expect(gap.has("weekly_streak_starter")).toBe(false);
  });

  it("networking_builder requires 3+ career_chats in the same month", () => {
    const two = evaluateAchievementSet([
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 4) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 8) }),
    ]);
    expect(two.has("networking_builder")).toBe(false);
    const three = evaluateAchievementSet([
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 4) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 8) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 15) }),
    ]);
    expect(three.has("networking_builder")).toBe(true);
  });

  it("conversation_builder requires more than three career_chats in a month", () => {
    const three = evaluateAchievementSet(
      [1, 8, 15].map((d) =>
        log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, d) })
      )
    );
    expect(three.has("conversation_builder")).toBe(false);
    const four = evaluateAchievementSet(
      [1, 8, 15, 22].map((d) =>
        log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, d) })
      )
    );
    expect(four.has("conversation_builder")).toBe(true);
  });

  it("extra_mile requires more than one career_tasks log in a week", () => {
    const single = evaluateAchievementSet([log({ meetingDate: new Date(2026, 2, 2) })]);
    expect(single.has("extra_mile")).toBe(false);
    const two = evaluateAchievementSet([
      log({ meetingDate: new Date(2026, 2, 2) }),
      log({ meetingDate: new Date(2026, 2, 5) }),
    ]);
    expect(two.has("extra_mile")).toBe(true);
  });

  it("internship_win / part_time_win / full_time_win fire only on their topic", () => {
    const earned = evaluateAchievementSet([
      log({
        accomplishmentGroup: "industry_experiences",
        topicsDiscussed: "My mentee got an internship offer",
      }),
    ]);
    expect(earned.has("internship_win")).toBe(true);
    expect(earned.has("industry_breakthrough")).toBe(true);
    expect(earned.has("part_time_win")).toBe(false);
    expect(earned.has("full_time_win")).toBe(false);
  });

  it("resume_builder fires when topic contains Work on Resumes", () => {
    expect(
      evaluateAchievementSet([log({ topicsDiscussed: "Work on Resumes" })]).has(
        "resume_builder"
      )
    ).toBe(true);
    expect(
      evaluateAchievementSet([log({ topicsDiscussed: "Course planning" })]).has(
        "resume_builder"
      )
    ).toBe(false);
  });

  it("interview_ready fires when topic contains any interview practice", () => {
    expect(
      evaluateAchievementSet([
        log({ topicsDiscussed: "Role Play Interviewing" }),
      ]).has("interview_ready")
    ).toBe(true);
    expect(
      evaluateAchievementSet([
        log({ topicsDiscussed: "Work on Interviewing Skills" }),
      ]).has("interview_ready")
    ).toBe(true);
  });

  it("can_standard_keeper requires weekly task + monthly chats goal in same period", () => {
    // Same month, but only 2 chats — should not earn
    const partial = evaluateAchievementSet([
      log({ accomplishmentGroup: "career_tasks", meetingDate: new Date(2026, 2, 2) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 4) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 9) }),
    ]);
    expect(partial.has("can_standard_keeper")).toBe(false);
    const full = evaluateAchievementSet([
      log({ accomplishmentGroup: "career_tasks", meetingDate: new Date(2026, 2, 2) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 4) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 9) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 15) }),
    ]);
    expect(full.has("can_standard_keeper")).toBe(true);
  });

  it("career_momentum requires both career tasks and chats in the same month", () => {
    const only_tasks = evaluateAchievementSet([
      log({ accomplishmentGroup: "career_tasks", meetingDate: new Date(2026, 2, 2) }),
    ]);
    expect(only_tasks.has("career_momentum")).toBe(false);
    const both = evaluateAchievementSet([
      log({ accomplishmentGroup: "career_tasks", meetingDate: new Date(2026, 2, 2) }),
      log({ accomplishmentGroup: "career_chats", meetingDate: new Date(2026, 2, 9) }),
    ]);
    expect(both.has("career_momentum")).toBe(true);
  });
});
