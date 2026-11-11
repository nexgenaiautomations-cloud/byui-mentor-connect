import { sameSchool } from "@/lib/school-scope";

// Members with no mentor available wait on a list; when a mentor in their
// major (same school) has an open spot we tell them. Spec:
// docs/specs/mentor-waitlist.md.

export const WAITLIST_RENOTIFY_MS = 7 * 24 * 60 * 60 * 1000;

export type WaitingMember = {
  id: string;
  email: string;
  major: string | null;
  waitlistedAt: Date;
  notifiedAt: Date | null;
};

export type OpenMentor = { email: string; major: string | null };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function majorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a);
  return x !== "" && x === norm(b);
}

export function membersToNotify<T extends WaitingMember>(
  waiting: T[],
  openMentors: OpenMentor[],
  now: Date = new Date()
): T[] {
  return waiting.filter((w) => {
    const due =
      !w.notifiedAt ||
      w.notifiedAt < w.waitlistedAt ||
      now.getTime() - w.notifiedAt.getTime() >= WAITLIST_RENOTIFY_MS;
    return due && openMentors.some((m) => majorsMatch(w.major, m.major) && sameSchool(w.email, m.email));
  });
}
