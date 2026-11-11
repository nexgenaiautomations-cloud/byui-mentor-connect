import { describe, expect, it } from "vitest";
import { diffAssignments, groupSizes, suggestBalance } from "@/lib/stewardship";

const sizes = (a: Record<string, string | null>, execs: string[]) => groupSizes(a, execs);

describe("suggestBalance", () => {
  it("splits unassigned mentors as evenly as possible", () => {
    const result = suggestBalance(["e1", "e2"], ["m1", "m2", "m3", "m4", "m5"], {});
    const s = sizes(result, ["e1", "e2"]);
    expect(Math.max(...Object.values(s)) - Math.min(...Object.values(s))).toBeLessThanOrEqual(1);
    expect(Object.values(result).every((e) => e === "e1" || e === "e2")).toBe(true);
  });

  it("keeps existing assignments that already fit", () => {
    const current = { m1: "e1", m2: "e2" };
    const result = suggestBalance(["e1", "e2"], ["m1", "m2", "m3", "m4"], current);
    expect(result.m1).toBe("e1");
    expect(result.m2).toBe("e2");
    expect(sizes(result, ["e1", "e2"])).toEqual({ e1: 2, e2: 2 });
  });

  it("moves as few mentors as possible off an overloaded executive", () => {
    const current = { m1: "e1", m2: "e1", m3: "e1", m4: "e1" };
    const result = suggestBalance(["e1", "e2"], ["m1", "m2", "m3", "m4"], current);
    expect(sizes(result, ["e1", "e2"])).toEqual({ e1: 2, e2: 2 });
    expect(diffAssignments(current, result)).toHaveLength(2);
  });

  it("reassigns mentors whose executive no longer exists", () => {
    const result = suggestBalance(["e2"], ["m1"], { m1: "gone" });
    expect(result.m1).toBe("e2");
  });

  it("leaves everyone unassigned when there are no executives", () => {
    expect(suggestBalance([], ["m1"], { m1: "e1" })).toEqual({ m1: null });
  });
});

describe("diffAssignments", () => {
  it("lists mentors whose executive changed", () => {
    expect(diffAssignments({ m1: "e1", m2: "e1" }, { m1: "e1", m2: "e2", m3: "e1" })).toEqual([
      { mentorId: "m2", from: "e1", to: "e2" },
      { mentorId: "m3", from: null, to: "e1" },
    ]);
  });
});
