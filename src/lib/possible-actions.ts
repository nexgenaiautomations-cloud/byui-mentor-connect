// "Possible Actions" — concrete things a mentor + mentee can do together.
// Surfaces on each mentee card so the mentor has a menu of obvious next steps.
// Source: BYUI CAN program.
//
// The Log an Activity form groups accomplishments into three sections:
//   1. Career Tasks — weekly       (cadence: 1+/week, drives weekly streak)
//   2. Industry Experiences        (offers received — celebrate)
//   3. Career Chats                (cadence: 3+/month, drives monthly KPI)
// Each group is also persisted on the meeting_log row so KPI queries can
// count rows without string-parsing topics_discussed.

export const CAREER_TASKS_OPTIONS = [
  "Work on Resumes",
  "Work on Cover Letters",
  "Work on Interviewing Skills",
  "Role Play Interviewing",
  "Work on Elevator Pitch",
  "Help apply to an internship or job",
  "Help with LinkedIn or Other Platforms",
  "Course planning",
  "Help with Grad School Preparation/Application",
  "Go to a Career Fair or other Career Event together",
  "Go to a Society Meeting together",
  "Go do something else awesome together",
  "Explore Careers, Companies, Industries",
] as const;

export const INDUSTRY_EXPERIENCES_OPTIONS = [
  "My mentee got an internship offer",
  "My mentee got a career-related, part-time job offer",
  "My mentee got a career-related, full-time job offer",
] as const;

export const CAREER_CHATS_OPTIONS = [
  "Help with Informational Interview preparation",
  "Share professional connections and relationships",
] as const;

export type AccomplishmentGroupKey =
  | "career_tasks"
  | "industry_experiences"
  | "career_chats";

export const ACCOMPLISHMENT_GROUPS: ReadonlyArray<{
  key: AccomplishmentGroupKey;
  heading: string;
  options: readonly string[];
}> = [
  {
    key: "career_tasks",
    heading: "1. Career Tasks — weekly",
    options: CAREER_TASKS_OPTIONS,
  },
  {
    key: "industry_experiences",
    heading: "2. Industry Experiences",
    options: INDUSTRY_EXPERIENCES_OPTIONS,
  },
  {
    key: "career_chats",
    heading: "3. Career Chats",
    options: CAREER_CHATS_OPTIONS,
  },
];

// Convenience: every valid accomplishment string, in display order.
export const ALL_ACCOMPLISHMENTS: readonly string[] = [
  ...CAREER_TASKS_OPTIONS,
  ...INDUSTRY_EXPERIENCES_OPTIONS,
  ...CAREER_CHATS_OPTIONS,
];

// Items that should trigger confetti when logged.
export const CELEBRATION_ACCOMPLISHMENTS: readonly string[] = [
  ...INDUSTRY_EXPERIENCES_OPTIONS,
];

// Reverse lookup — given an accomplishment string, return its group key.
const ACCOMPLISHMENT_TO_GROUP: Record<string, AccomplishmentGroupKey> = (() => {
  const map: Record<string, AccomplishmentGroupKey> = {};
  for (const g of ACCOMPLISHMENT_GROUPS) {
    for (const opt of g.options) map[opt] = g.key;
  }
  return map;
})();

export function groupForAccomplishment(
  a: string
): AccomplishmentGroupKey | null {
  return ACCOMPLISHMENT_TO_GROUP[a] ?? null;
}

// Given a set of checked accomplishments, return the dominant group. If items
// span multiple groups (unusual but possible if the UI ever allows it), pick
// the highest-priority one for KPI attribution:
//   industry_experiences > career_chats > career_tasks
export function dominantGroup(
  accomplishments: readonly string[]
): AccomplishmentGroupKey | null {
  const groups = new Set<AccomplishmentGroupKey>();
  for (const a of accomplishments) {
    const g = groupForAccomplishment(a);
    if (g) groups.add(g);
  }
  if (groups.has("industry_experiences")) return "industry_experiences";
  if (groups.has("career_chats")) return "career_chats";
  if (groups.has("career_tasks")) return "career_tasks";
  return null;
}

// ---- Legacy compatibility ----
// Older code still imports these. Keep them so existing tests + cards work.
export const POSSIBLE_ACTIONS = [
  "Explore Careers, Companies, Industries",
  "Share professional connections and relationships",
  "Help with Informational Interview preparation",
  "Go to a Career Fair or other Career Event together",
  "Go to a Society Meeting together",
  "Go do something else awesome together",
  "Help with LinkedIn or Other Platforms",
  "Work on Resumes",
  "Work on Cover Letters",
  "Work on Interviewing Skills",
  "Role Play Interviewing",
  "Work on Elevator Pitch",
  "Help apply to an internship or job",
  "Help with Grad School Preparation/Application",
  "Course planning",
] as const;

// "Other" sentinel — the new grouped form does not surface this option, but
// older meeting_log rows persisted "Other: …" strings. Code paths that read
// historical topics_discussed still recognize this prefix.
export const OTHER_ACCOMPLISHMENT = "Other";

// Older form's full flat list, retained so any importer keeps compiling.
export const LOG_ACCOMPLISHMENT_OPTIONS = [
  ...POSSIBLE_ACTIONS,
  ...INDUSTRY_EXPERIENCES_OPTIONS,
  OTHER_ACCOMPLISHMENT,
] as const;

// BYUI CAN program cadence — "1 Career Task weekly · 2 Internships before
// senior year · 3 Career Chats each month".
export const CAN_CADENCE = [
  { n: 1, label: "Career Task", cadence: "weekly" },
  { n: 2, label: "Internships / Industry Experiences", cadence: "before senior year" },
  { n: 3, label: "Career Chats", cadence: "each month" },
];

// Activity thresholds
export const INACTIVITY_WARN_DAYS = 30;
export const INACTIVITY_DISCONNECT_DAYS = 180;
