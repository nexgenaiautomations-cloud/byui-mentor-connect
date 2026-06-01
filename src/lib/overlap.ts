// Pure helpers for computing what a mentor + mentee have in common. Used by
// the mentor's incoming-request review card so accept/decline isn't a guess.

export type OverlapInput = {
  mentor: {
    major: string | null;
    minor: string | null;
    semesterLevel: string | null;
    careerInterests: string[] | null;
    mentorTopics: string[] | null;
  };
  mentee: {
    major: string | null;
    minor: string | null;
    semesterLevel: string | null;
    careerInterests: string[] | null;
  };
};

export type Overlap = {
  sameMajor: boolean;
  sameMinor: boolean;
  sharedInterests: string[];
  topicsHittingInterests: string[];
  score: number;
};

const SEMESTER_ORDER = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

function semesterGap(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ia = SEMESTER_ORDER.indexOf(a);
  const ib = SEMESTER_ORDER.indexOf(b);
  if (ia === -1 || ib === -1) return null;
  return Math.abs(ia - ib);
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

export function computeOverlap({ mentor, mentee }: OverlapInput): Overlap {
  const sameMajor =
    !!mentor.major && !!mentee.major && mentor.major === mentee.major;
  const sameMinor =
    !!mentor.minor && !!mentee.minor && mentor.minor === mentee.minor;

  const mentorInterests = new Set(
    (mentor.careerInterests ?? []).map((s) => s.toLowerCase())
  );
  const menteeInterests = mentee.careerInterests ?? [];
  const sharedInterests = dedupeCaseInsensitive(
    menteeInterests.filter((i) => mentorInterests.has(i.toLowerCase()))
  );

  // Mentor topics aren't career interests, but a mentor whose topics match
  // what a mentee cares about is still meaningful overlap. Match against the
  // mentee's interests by case-insensitive substring either direction so
  // "Internship apps" hits "Internship prep" etc.
  const mentorTopics = mentor.mentorTopics ?? [];
  const topicsHittingInterests = dedupeCaseInsensitive(
    mentorTopics.filter((t) => {
      const lo = t.toLowerCase();
      return menteeInterests.some((i) => {
        const il = i.toLowerCase();
        return il.includes(lo) || lo.includes(il);
      });
    })
  );

  // Crude relevance score for sorting incoming requests later. Major is the
  // strongest signal, then interest overlap, then mentor-topic relevance,
  // then a small bump for similar semester (within 1).
  let score = 0;
  if (sameMajor) score += 5;
  if (sameMinor) score += 2;
  score += sharedInterests.length * 2;
  score += topicsHittingInterests.length;
  const gap = semesterGap(mentor.semesterLevel, mentee.semesterLevel);
  if (gap !== null && gap <= 1) score += 1;

  return { sameMajor, sameMinor, sharedInterests, topicsHittingInterests, score };
}
