import { describe, it, expect } from "vitest";
import {
  POSSIBLE_ACTIONS,
  CAN_CADENCE,
  INACTIVITY_WARN_DAYS,
  INACTIVITY_DISCONNECT_DAYS,
} from "@/lib/possible-actions";

describe("POSSIBLE_ACTIONS", () => {
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
