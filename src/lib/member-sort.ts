// Sorting for the admin Members table. Pure so it can be unit tested.
// Blank values always sort last, whichever direction is chosen.
import { SEMESTER_LEVELS } from "@/lib/careers";

export const MEMBER_SORT_KEYS = [
  "name",
  "major",
  "semesterLevel",
  "expectedGraduation",
  "role",
  "activeMatches",
  "achievementsEarned",
  "createdAt",
] as const;
export type MemberSortKey = (typeof MEMBER_SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const MEMBER_SORT_LABEL: Record<MemberSortKey, string> = {
  name: "Member",
  major: "Major",
  semesterLevel: "Semester",
  expectedGraduation: "Expected grad",
  role: "Role",
  activeMatches: "Active",
  achievementsEarned: "Trophies",
  createdAt: "Joined",
};

// Numbers sort high-first and dates newest-first on the first click.
export const DEFAULT_DIR: Record<MemberSortKey, SortDir> = {
  name: "asc",
  major: "asc",
  semesterLevel: "asc",
  expectedGraduation: "asc",
  role: "desc",
  activeMatches: "desc",
  achievementsEarned: "desc",
  createdAt: "desc",
};

export type SortableMember = {
  name: string | null;
  email: string;
  major: string | null;
  semesterLevel: string | null;
  expectedGraduation: string | null;
  isMentor: boolean;
  isExecutiveMentor: boolean;
  isAdmin: boolean;
  isHeadAdmin: boolean;
  removedAt: string | null;
  activeMatches: number;
  achievementsEarned: number;
  createdAt: string;
};

const TERM_ORDER: Record<string, number> = { winter: 0, spring: 1, summer: 2, fall: 3 };

// "Spring 2027" → a sortable number; unparseable text sorts after real terms.
export function graduationRank(value: string | null): number | null {
  if (!value || !value.trim()) return null;
  const m = /^(winter|spring|summer|fall)\s+(\d{4})$/i.exec(value.trim());
  if (m) return Number(m[2]) * 10 + TERM_ORDER[m[1].toLowerCase()];
  const year = /(\d{4})/.exec(value);
  return year ? Number(year[1]) * 10 + 9 : null;
}

// Removed < member < mentor < executive mentor < admin < head admin.
export function roleRank(u: SortableMember): number {
  if (u.removedAt) return 0;
  if (u.isHeadAdmin) return 5;
  if (u.isAdmin) return 4;
  if (u.isExecutiveMentor) return 3;
  if (u.isMentor) return 2;
  return 1;
}

function keyValue(u: SortableMember, key: MemberSortKey): string | number | null {
  switch (key) {
    case "name":
      return (u.name?.trim() || u.email).toLowerCase();
    case "major":
      return u.major?.trim() ? u.major.trim().toLowerCase() : null;
    case "semesterLevel": {
      const i = u.semesterLevel ? (SEMESTER_LEVELS as readonly string[]).indexOf(u.semesterLevel) : -1;
      return i >= 0 ? i : u.semesterLevel ? 99 : null;
    }
    case "expectedGraduation":
      return graduationRank(u.expectedGraduation);
    case "role":
      return roleRank(u);
    case "activeMatches":
      return u.activeMatches;
    case "achievementsEarned":
      return u.achievementsEarned;
    case "createdAt":
      return new Date(u.createdAt).getTime();
  }
}

export function sortMembers<T extends SortableMember>(rows: T[], key: MemberSortKey, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, v: keyValue(row, key) }))
    .sort((a, b) => {
      if (a.v === null && b.v === null) return a.index - b.index;
      if (a.v === null) return 1; // blanks last in both directions
      if (b.v === null) return -1;
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v), undefined, { numeric: true });
      return c !== 0 ? c * sign : a.index - b.index; // stable
    })
    .map((x) => x.row);
}
