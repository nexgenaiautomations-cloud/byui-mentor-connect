import { describe, it, expect } from "vitest";
import {
  POSSIBLE_ACTIONS,
  CAN_CADENCE,
  INACTIVITY_WARN_DAYS,
  INACTIVITY_DISCONNECT_DAYS,
  CAREER_TASKS_OPTIONS,
  INDUSTRY_EXPERIENCES_OPTIONS,
  CAREER_CHATS_OPTIONS,
  ACCOMPLISHMENT_GROUPS,
  ALL_ACCOMPLISHMENTS,
  CELEBRATION_ACCOMPLISHMENTS,
  groupForAccomplishment,
  dominantGroup,
} from "@/lib/possible-actions";

describe("POSSIBLE_ACTIONS (legacy flat list)", () => {
  it("matches the BYUI CAN list verbatim", () => {
    expect(POSSIBLE_ACTIONS).toContain("Explore Careers, Companies, Industries");
    expect(POSSIBLE_ACTIONS).toContain("Help with LinkedIn or Other Platforms");
    expect(POSSIBLE_ACTIONS).toContain("Work on Resumes");
    expect(POSSIBLE_ACTIONS).toContain("Help with Grad School Preparation/Application");
  });

  it("has 15 actions", () => {
    expect(POSSIBLE_ACTIONS).toHaveLength(15);
  });

  it("includes Course planning", () => {
    expect(POSSIBLE_ACTIONS).toContain("Course planning");
  });
});

describe("accomplishment groups (grouped form)", () => {
  it("has 13 career tasks", () => {
    expect(CAREER_TASKS_OPTIONS).toHaveLength(13);
  });

  it("has 3 industry experiences (offers)", () => {
    expect(INDUSTRY_EXPERIENCES_OPTIONS).toHaveLength(3);
    expect(INDUSTRY_EXPERIENCES_OPTIONS).toContain(
      "My mentee got an internship offer"
    );
    expect(INDUSTRY_EXPERIENCES_OPTIONS).toContain(
      "My mentee got a career-related, full-time job offer"
    );
  });

  it("has 2 career chats", () => {
    expect(CAREER_CHATS_OPTIONS).toEqual([
      "Help with Informational Interview preparation",
      "Share professional connections and relationships",
    ]);
  });

  it("ACCOMPLISHMENT_GROUPS exposes all three sections in display order", () => {
    expect(ACCOMPLISHMENT_GROUPS.map((g) => g.key)).toEqual([
      "career_tasks",
      "industry_experiences",
      "career_chats",
    ]);
    expect(ACCOMPLISHMENT_GROUPS[0].heading).toBe("1. Career Tasks — weekly");
  });

  it("ALL_ACCOMPLISHMENTS contains 18 unique entries", () => {
    expect(ALL_ACCOMPLISHMENTS).toHaveLength(18);
    expect(new Set(ALL_ACCOMPLISHMENTS).size).toBe(18);
  });

  it("CELEBRATION_ACCOMPLISHMENTS covers the three offer items", () => {
    expect(CELEBRATION_ACCOMPLISHMENTS).toEqual(INDUSTRY_EXPERIENCES_OPTIONS);
  });
});

describe("groupForAccomplishment / dominantGroup", () => {
  it("maps a career task to career_tasks", () => {
    expect(groupForAccomplishment("Work on Resumes")).toBe("career_tasks");
  });

  it("maps a career chat to career_chats", () => {
    expect(groupForAccomplishment("Help with Informational Interview preparation")).toBe(
      "career_chats"
    );
  });

  it("returns null for unknown strings", () => {
    expect(groupForAccomplishment("Something else entirely")).toBeNull();
  });

  it("dominantGroup picks industry over chats over tasks", () => {
    expect(
      dominantGroup([
        "Work on Resumes",
        "Help with Informational Interview preparation",
        "My mentee got an internship offer",
      ])
    ).toBe("industry_experiences");
    expect(
      dominantGroup([
        "Work on Resumes",
        "Help with Informational Interview preparation",
      ])
    ).toBe("career_chats");
    expect(dominantGroup(["Work on Resumes"])).toBe("career_tasks");
    expect(dominantGroup([])).toBeNull();
  });
});

describe("CAN_CADENCE", () => {
  it("encodes the 1/2/3 cadence", () => {
    expect(CAN_CADENCE).toEqual([
      { n: 1, label: "Career Task", cadence: "weekly" },
      { n: 2, label: "Internships / Industry Experiences", cadence: "before senior year" },
      { n: 3, label: "Career Chats", cadence: "each month" },
    ]);
  });
});

describe("inactivity thresholds", () => {
  it("warn at 30 days, disconnect at 180", () => {
    expect(INACTIVITY_WARN_DAYS).toBe(30);
    expect(INACTIVITY_DISCONNECT_DAYS).toBe(180);
  });

  it("warn is strictly less than disconnect", () => {
    expect(INACTIVITY_WARN_DAYS).toBeLessThan(INACTIVITY_DISCONNECT_DAYS);
  });
});
