// Mentor recommendation scoring shared by Find a Mentor and the sign-up
// "choose your mentor" step: shared career interests weigh most, then the
// same major, then having an open slot.

export const RECOMMENDED_MIN_SCORE = 3;

type MentorFit = {
  major: string | null;
  careerInterests: string[] | null;
  mentorCapacity: number | null;
  activeCount: number | null;
};

export function rankMentors<M extends MentorFit>(
  me: { major: string | null; careerInterests: string[] | null },
  mentors: M[]
) {
  const myInterests = new Set(me.careerInterests ?? []);
  const myMajor = me.major?.toLowerCase().trim() ?? "";
  return mentors
    .map((m) => {
      const overlap = (m.careerInterests ?? []).filter((c) => myInterests.has(c)).length;
      const sameMajor = myMajor && m.major && m.major.toLowerCase().trim() === myMajor ? 1 : 0;
      const slotsLeft = Math.max(0, (m.mentorCapacity ?? 0) - (m.activeCount ?? 0));
      const score = overlap * 3 + sameMajor * 2 + (slotsLeft > 0 ? 1 : 0);
      return { ...m, overlap, sameMajor, slotsLeft, score };
    })
    .sort((a, b) => b.score - a.score || b.slotsLeft - a.slotsLeft);
}
