import { describe, it, expect } from "vitest";
import {
  POSSIBLE_ACTIONS,
  CAN_CADENCE,
  INACTIVITY_WARN_DAYS,
  INACTIVITY_DISCONNECT_DAYS,
  CAREER_TASKS_OPTIONS,
  INDUSTRY_EXPERIENCES_OPTIONS,
  CAREER_CHATS_OPTIONS,
  ALL_LABELS,
  CELEBRATION_ACCOMPLISHMENTS,
  CELEBRATION_KEYS,
  ACTIONS,
  groupsForRole,
  groupForLabel,
  keyForLabel,
  dominantGroup,
  shouldCelebrate,
} from "@/lib/possible-actions";

describe("POSSIBLE_ACTIONS (legacy flat list)", () => {
  it("still exposes the legacy 15 BYUI CAN actions for back-compat", () => {
    expect(POSSIBLE_ACTIONS).toContain("Explore Careers, Companies, Industries");
    expect(POSSIBLE_ACTIONS).toHaveLength(15);
  });
});

describe("ACTIONS stable-key catalog", () => {
  it("has 19 actions across the three groups", () => {
    expect(ACTIONS).toHaveLength(19);
    expect(new Set(ACTIONS.map((a) => a.key)).size).toBe(19);
  });

  it("every action has both a mentee and a mentor label", () => {
    for (const a of ACTIONS) {
      expect(a.menteeLabel.length).toBeGreaterThan(0);
      expect(a.mentorLabel.length).toBeGreaterThan(0);
      expect(a.menteeLabel).not.toBe(a.mentorLabel);
    }
  });

  it("group sizes match the spec (13 / 3 / 3)", () => {
    expect(ACTIONS.filter((a) => a.group === "career_tasks")).toHaveLength(13);
    expect(ACTIONS.filter((a) => a.group === "industry_experiences")).toHaveLength(3);
    expect(ACTIONS.filter((a) => a.group === "career_chats")).toHaveLength(3);
  });

  it("CAREER_TASKS_OPTIONS legacy alias has 13 items", () => {
    expect(CAREER_TASKS_OPTIONS).toHaveLength(13);
  });

  it("INDUSTRY + CAREER chat legacy aliases keep their counts", () => {
    expect(INDUSTRY_EXPERIENCES_OPTIONS).toHaveLength(3);
    expect(CAREER_CHATS_OPTIONS).toHaveLength(3);
  });
});

describe("CELEBRATION", () => {
  it("celebrates the three industry offers", () => {
    expect(CELEBRATION_KEYS).toEqual([
      "internship_offer",
      "part_time_offer",
      "full_time_offer",
    ]);
    expect(CELEBRATION_ACCOMPLISHMENTS).toContain("I got an internship offer");
    expect(CELEBRATION_ACCOMPLISHMENTS).toContain(
      "My mentee got an internship offer"
    );
  });

  it("shouldCelebrate fires on either role's wording", () => {
    expect(shouldCelebrate(["I got an internship offer"])).toBe(true);
    expect(shouldCelebrate(["My mentee got an internship offer"])).toBe(true);
    expect(shouldCelebrate(["Worked on my resume"])).toBe(false);
  });
});

describe("groupsForRole", () => {
  it("returns mentee-side labels for mode=mentee", () => {
    const groups = groupsForRole("mentee");
    expect(groups.map((g) => g.key)).toEqual([
      "career_tasks",
      "industry_experiences",
      "career_chats",
    ]);
    expect(groups[0].options).toContain("Worked on my resume");
    expect(groups[0].options).not.toContain("Helped with resumes");
    expect(groups[1].options).toContain("I got an internship offer");
    expect(groups[2].options).toContain(
      "Completed an informational interview or career chat"
    );
  });

  it("returns mentor-side labels for mode=mentor", () => {
    const groups = groupsForRole("mentor");
    expect(groups[0].options).toContain("Helped with resumes");
    expect(groups[0].options).not.toContain("Worked on my resume");
    expect(groups[1].options).toContain("My mentee got an internship offer");
    expect(groups[2].options).toContain(
      "Helped with informational interview preparation"
    );
  });
});

describe("groupForLabel + keyForLabel", () => {
  it("resolves both mentee and mentor labels to the same key + group", () => {
    expect(keyForLabel("Worked on my resume")).toBe("resume_work");
    expect(keyForLabel("Helped with resumes")).toBe("resume_work");
    expect(groupForLabel("Worked on my resume")).toBe("career_tasks");
    expect(groupForLabel("Helped with resumes")).toBe("career_tasks");
  });

  it("still resolves legacy labels (pre-refactor saved rows)", () => {
    expect(groupForLabel("Work on Resumes")).toBe("career_tasks");
    expect(groupForLabel("Help with Informational Interview preparation")).toBe(
      "career_chats"
    );
  });

  it("returns null for unknown strings", () => {
    expect(groupForLabel("Something else")).toBeNull();
    expect(keyForLabel("Something else")).toBeNull();
  });
});

describe("dominantGroup", () => {
  it("picks industry > chats > tasks regardless of role labels", () => {
    expect(
      dominantGroup([
        "Worked on my resume",
        "Built or strengthened a professional connection",
        "I got an internship offer",
      ])
    ).toBe("industry_experiences");
    expect(
      dominantGroup([
        "Helped with resumes",
        "Helped with informational interview preparation",
      ])
    ).toBe("career_chats");
    expect(dominantGroup(["Worked on my resume"])).toBe("career_tasks");
    expect(dominantGroup([])).toBeNull();
  });
});

describe("ALL_LABELS validation set", () => {
  it("contains every mentee + mentor label plus the legacy strings", () => {
    expect(ALL_LABELS).toContain("Worked on my resume");
    expect(ALL_LABELS).toContain("Helped with resumes");
    expect(ALL_LABELS).toContain("Work on Resumes"); // legacy
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
