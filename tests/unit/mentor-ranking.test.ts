import { describe, expect, it } from "vitest";
import { rankMentors, RECOMMENDED_MIN_SCORE } from "@/lib/mentor-ranking";

const mentor = (id: string, over: Partial<{ major: string | null; careerInterests: string[] | null; mentorCapacity: number | null; activeCount: number }> = {}) => ({
  id,
  major: null as string | null,
  careerInterests: [] as string[] | null,
  mentorCapacity: 5 as number | null,
  activeCount: 0,
  ...over,
});

describe("rankMentors", () => {
  const me = { major: "Accounting", careerInterests: ["Audit", "Tax"] };

  it("puts shared interests and major first", () => {
    const ranked = rankMentors(me, [
      mentor("none"),
      mentor("major", { major: "accounting " }),
      mentor("interest", { careerInterests: ["Tax"] }),
      mentor("both", { major: "Accounting", careerInterests: ["Audit", "Tax"] }),
    ]);
    expect(ranked.map((m) => m.id)).toEqual(["both", "interest", "major", "none"]);
  });

  it("scores open slots and flags recommendations", () => {
    const [top] = rankMentors(me, [mentor("x", { careerInterests: ["Audit"] })]);
    expect(top.slotsLeft).toBe(5);
    expect(top.score).toBe(3 + 1);
    expect(top.score >= RECOMMENDED_MIN_SCORE).toBe(true);
  });

  it("ranks full mentors below open ones with the same fit", () => {
    const ranked = rankMentors(me, [
      mentor("full", { major: "Accounting", mentorCapacity: 1, activeCount: 1 }),
      mentor("open", { major: "Accounting" }),
    ]);
    expect(ranked.map((m) => m.id)).toEqual(["open", "full"]);
    expect(ranked[1].slotsLeft).toBe(0);
  });
});
