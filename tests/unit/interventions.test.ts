import { describe, it, expect } from "vitest";
import {
  assessRisk,
  canTransition,
  duplicateOutreachWarning,
  type MatchRiskFacts,
} from "@/lib/interventions";
import { DEFAULT_THRESHOLDS, resolveThresholds, thresholdOrderError, resolveRoi, DEFAULT_ROI } from "@/lib/program-settings";

const now = new Date("2026-06-01T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const base: MatchRiskFacts = {
  startedAt: daysAgo(10),
  firstMeetingAt: daysAgo(8),
  lastInteractionAt: daysAgo(2),
  missedSinceInteraction: 0,
  remindersSinceInteraction: 0,
  latestMenteeRating: null,
  oldestOpenActionItemsAt: null,
};

describe("assessRisk", () => {
  it("a healthy pair has no risk", () => {
    expect(assessRisk(base, DEFAULT_THRESHOLDS, now)).toEqual([]);
  });
  it("flags no first meeting after the risk threshold", () => {
    expect(assessRisk({ ...base, firstMeetingAt: null, lastInteractionAt: null, startedAt: daysAgo(20) }, DEFAULT_THRESHOLDS, now)).toEqual([]);
    expect(assessRisk({ ...base, firstMeetingAt: null, lastInteractionAt: null, startedAt: daysAgo(21) }, DEFAULT_THRESHOLDS, now)).toContain("no_first_meeting");
  });
  it("measures the gap from the last interaction, falling back to start", () => {
    expect(assessRisk({ ...base, lastInteractionAt: daysAgo(59) }, DEFAULT_THRESHOLDS, now)).not.toContain("interaction_gap");
    expect(assessRisk({ ...base, lastInteractionAt: daysAgo(60) }, DEFAULT_THRESHOLDS, now)).toContain("interaction_gap");
    expect(
      assessRisk({ ...base, startedAt: daysAgo(70), firstMeetingAt: null, lastInteractionAt: null }, DEFAULT_THRESHOLDS, now)
    ).toEqual(expect.arrayContaining(["interaction_gap", "no_first_meeting"]));
  });
  it("flags missed meetings, ignored reminders and low ratings", () => {
    const r = assessRisk(
      { ...base, missedSinceInteraction: 1, remindersSinceInteraction: 3, latestMenteeRating: 2 },
      DEFAULT_THRESHOLDS,
      now
    );
    expect(r).toEqual(["missed_meeting", "unanswered_reminders", "low_satisfaction"]);
  });
  it("stalled actions only when nothing has happened since", () => {
    expect(assessRisk({ ...base, oldestOpenActionItemsAt: daysAgo(30), lastInteractionAt: daysAgo(30) }, DEFAULT_THRESHOLDS, now)).toContain("stalled_actions");
    expect(assessRisk({ ...base, oldestOpenActionItemsAt: daysAgo(30), lastInteractionAt: daysAgo(5) }, DEFAULT_THRESHOLDS, now)).not.toContain("stalled_actions");
  });
  it("respects configured thresholds", () => {
    const t = { ...DEFAULT_THRESHOLDS, adminAttentionDays: 10 };
    expect(assessRisk({ ...base, lastInteractionAt: daysAgo(10) }, t, now)).toContain("interaction_gap");
  });
});

describe("status machine", () => {
  it("open cases move freely and can finish", () => {
    expect(canTransition("new", "contacted")).toBe(true);
    expect(canTransition("awaiting_response", "resolved")).toBe(true);
    expect(canTransition("reviewing", "closed")).toBe(true);
  });
  it("nothing goes back to new, finished cases reopen only to reviewing", () => {
    expect(canTransition("reviewing", "new")).toBe(false);
    expect(canTransition("resolved", "contacted")).toBe(false);
    expect(canTransition("closed", "reviewing")).toBe(true);
    expect(canTransition("new", "new")).toBe(false);
  });
});

describe("duplicate outreach", () => {
  it("warns only for another admin's recent outreach", () => {
    const c = { lastOutreachAt: new Date(now.getTime() - 3600000), lastOutreachById: "a1" };
    expect(duplicateOutreachWarning(c, "a2", now)).toBe(true);
    expect(duplicateOutreachWarning(c, "a1", now)).toBe(false);
    expect(duplicateOutreachWarning({ ...c, lastOutreachAt: daysAgo(3) }, "a2", now)).toBe(false);
    expect(duplicateOutreachWarning({ lastOutreachAt: null, lastOutreachById: null }, "a2", now)).toBe(false);
  });
});

describe("program settings", () => {
  it("layers school settings over defaults and ignores bad rows", () => {
    expect(resolveThresholds(null, '{"checkInNudgeDays": 10}').checkInNudgeDays).toBe(10);
    expect(resolveThresholds("not json").checkInNudgeDays).toBe(14);
    expect(resolveThresholds('{"checkInNudgeDays": -4}').checkInNudgeDays).toBe(14);
    expect(resolveThresholds('{"evil": 1}')).toEqual(DEFAULT_THRESHOLDS);
    expect(resolveRoi('{"staffHourlyCost": 40}')).toEqual({ ...DEFAULT_ROI, staffHourlyCost: 40 });
  });
  it("requires escalating thresholds", () => {
    expect(thresholdOrderError(DEFAULT_THRESHOLDS)).toBeNull();
    expect(thresholdOrderError({ ...DEFAULT_THRESHOLDS, concernNudgeDays: 10 })).not.toBeNull();
  });
});
