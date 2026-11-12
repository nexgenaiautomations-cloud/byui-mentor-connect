import { describe, it, expect } from "vitest";
import {
  offersInTopics,
  validateMilestone,
  currentStage,
  countOffers,
  funnelUniqueStudents,
  studentsByCurrentStage,
  type ExistingMilestone,
} from "@/lib/career";

const d = (s: string) => new Date(s);
const m = (over: Partial<ExistingMilestone>): ExistingMilestone => ({
  id: Math.random().toString(36).slice(2),
  studentId: "s1",
  stage: "applying",
  opportunityType: null,
  relatedMilestoneId: null,
  occurredOn: d("2026-01-01"),
  ...over,
});

describe("offersInTopics", () => {
  it("reads mentee and mentor offer labels", () => {
    expect(offersInTopics("I got an internship offer · Worked on my resume")).toEqual(["internship"]);
    expect(offersInTopics("My mentee got a career-related, full-time job offer")).toEqual(["full_time"]);
  });
  it("counts each type at most once per log", () => {
    expect(
      offersInTopics("I got an internship offer · I got an internship offer · I got a career-related, part-time job offer")
    ).toEqual(["internship", "part_time"]);
  });
  it("ignores non-offer and empty topics", () => {
    expect(offersInTopics("Worked on my resume")).toEqual([]);
    expect(offersInTopics(null)).toEqual([]);
  });
});

describe("validateMilestone", () => {
  it("requires an opportunity type from offer onward", () => {
    expect(validateMilestone({ stage: "offer_received", opportunityType: null, relatedMilestoneId: null }, [])).toMatch(/internship/);
    expect(validateMilestone({ stage: "applying", opportunityType: null, relatedMilestoneId: null }, [])).toBeNull();
  });
  it("only links acceptances to the student's own offers", () => {
    const offer = m({ id: "o1", stage: "offer_received", opportunityType: "internship" });
    expect(validateMilestone({ stage: "offer_accepted", opportunityType: "internship", relatedMilestoneId: "o1" }, [offer])).toBeNull();
    expect(validateMilestone({ stage: "offer_accepted", opportunityType: "internship", relatedMilestoneId: "nope" }, [offer])).toMatch(/not found/);
    expect(validateMilestone({ stage: "interviewing", opportunityType: "internship", relatedMilestoneId: "o1" }, [offer])).toMatch(/Only/);
  });
  it("refuses accepting the same offer twice", () => {
    const offer = m({ id: "o1", stage: "offer_received", opportunityType: "internship" });
    const acc = m({ id: "a1", stage: "offer_accepted", opportunityType: "internship", relatedMilestoneId: "o1" });
    expect(validateMilestone({ stage: "offer_accepted", opportunityType: "internship", relatedMilestoneId: "o1" }, [offer, acc])).toMatch(/already/);
  });
});

describe("currentStage", () => {
  it("is null with no milestones", () => {
    expect(currentStage([])).toBeNull();
  });
  it("is the most recent report, even if it moved backwards", () => {
    expect(
      currentStage([
        m({ stage: "interviewing", occurredOn: d("2026-01-01") }),
        m({ stage: "applying", occurredOn: d("2026-02-01") }),
      ])
    ).toBe("applying");
  });
  it("breaks same-day ties by the furthest stage", () => {
    expect(
      currentStage([
        m({ stage: "offer_accepted", opportunityType: "internship", occurredOn: d("2026-01-01") }),
        m({ stage: "offer_received", opportunityType: "internship", occurredOn: d("2026-01-01") }),
      ])
    ).toBe("offer_accepted");
  });
});

describe("countOffers — no double counting", () => {
  it("an accepted offer linked to its offer counts once", () => {
    const offer = m({ id: "o1", stage: "offer_received", opportunityType: "internship" });
    const acc = m({ id: "a1", stage: "offer_accepted", opportunityType: "internship", relatedMilestoneId: "o1" });
    const start = m({ id: "st", stage: "started", opportunityType: "internship", relatedMilestoneId: "o1" });
    expect(countOffers([offer, acc, start])).toEqual({ internship: 1, part_time: 0, full_time: 0 });
  });
  it("an acceptance with no recorded offer implies one offer", () => {
    const acc = m({ id: "a1", stage: "offer_accepted", opportunityType: "full_time" });
    const start = m({ id: "st", stage: "started", opportunityType: "full_time" });
    expect(countOffers([acc, start])).toEqual({ internship: 0, part_time: 0, full_time: 1 });
  });
  it("two genuine offers count twice", () => {
    expect(
      countOffers([
        m({ stage: "offer_received", opportunityType: "internship" }),
        m({ stage: "offer_received", opportunityType: "internship" }),
      ]).internship
    ).toBe(2);
  });
});

describe("funnelUniqueStudents", () => {
  it("counts students, not events, and fills applying→interviewing backwards", () => {
    const f = funnelUniqueStudents([
      m({ studentId: "a", stage: "offer_received", opportunityType: "internship" }),
      m({ studentId: "a", stage: "offer_received", opportunityType: "part_time" }),
      m({ studentId: "b", stage: "applying" }),
      m({ studentId: "c", stage: "exploring" }),
    ]);
    expect(f.offer_received).toBe(1);
    expect(f.interviewing).toBe(1);
    expect(f.applying).toBe(2);
    expect(f.exploring).toBe(1);
    expect(f.offer_accepted).toBe(0);
  });
  it("accepts extra applying signals from activity logs without duplicates", () => {
    const f = funnelUniqueStudents([m({ studentId: "a", stage: "applying" })], ["a", "z"]);
    expect(f.applying).toBe(2);
  });
});

describe("studentsByCurrentStage", () => {
  it("places each student once", () => {
    const out = studentsByCurrentStage([
      m({ studentId: "a", stage: "applying", occurredOn: d("2026-01-01") }),
      m({ studentId: "a", stage: "interviewing", occurredOn: d("2026-02-01") }),
      m({ studentId: "b", stage: "exploring" }),
    ]);
    expect(out.interviewing).toBe(1);
    expect(out.applying).toBe(0);
    expect(out.exploring).toBe(1);
  });
});
