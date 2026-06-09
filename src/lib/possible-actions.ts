// Activity catalog — stable internal keys with role-specific labels.
//
// Mentees report what they did on their own; mentors report what they helped
// with in a meeting. The visible labels differ but the underlying key + group
// is shared, so KPI math (Weekly Career Task, Monthly Career Chats) stays
// stable no matter how the copy evolves.
//
// Persistence: the log form sends the LABEL the user saw (e.g. "Worked on my
// resume" for a mentee, "Helped with resumes" for a mentor). The server
// resolves that label to a group via `groupForLabel()` and stores it on the
// row. KPI queries filter by `accomplishment_group`, never by topic string,
// so renaming labels later won't break counts.

export type AccomplishmentGroupKey =
  | "career_tasks"
  | "industry_experiences"
  | "career_chats";

export type ActionDef = {
  key: string;
  group: AccomplishmentGroupKey;
  menteeLabel: string;
  mentorLabel: string;
};

// Single source of truth. Order matters — the form renders options in array
// order within each group.
export const ACTIONS: readonly ActionDef[] = [
  // ---------- Group 1: Career Tasks (weekly) ----------
  {
    key: "resume_work",
    group: "career_tasks",
    menteeLabel: "Worked on my resume",
    mentorLabel: "Helped with resumes",
  },
  {
    key: "cover_letter",
    group: "career_tasks",
    menteeLabel: "Worked on my cover letter",
    mentorLabel: "Helped with cover letters",
  },
  {
    key: "interview_skills",
    group: "career_tasks",
    menteeLabel: "Practiced interviewing skills",
    mentorLabel: "Helped with interviewing skills",
  },
  {
    key: "interview_roleplay",
    group: "career_tasks",
    menteeLabel: "Role-played interview questions",
    mentorLabel: "Role-played interviewing",
  },
  {
    key: "elevator_pitch",
    group: "career_tasks",
    menteeLabel: "Worked on my elevator pitch",
    mentorLabel: "Helped with elevator pitch",
  },
  {
    key: "apply_internship",
    group: "career_tasks",
    menteeLabel: "Applied to an internship or job",
    mentorLabel: "Helped apply to an internship or job",
  },
  {
    key: "linkedin_profile",
    group: "career_tasks",
    menteeLabel: "Updated LinkedIn or another professional platform",
    mentorLabel: "Helped with LinkedIn or other professional platforms",
  },
  {
    key: "course_planning",
    group: "career_tasks",
    menteeLabel: "Worked on course planning",
    mentorLabel: "Helped with course planning",
  },
  {
    key: "grad_school_prep",
    group: "career_tasks",
    menteeLabel: "Worked on grad school preparation/application",
    mentorLabel: "Helped with grad school preparation/application",
  },
  {
    key: "career_event",
    group: "career_tasks",
    menteeLabel: "Attended a career fair or career event",
    mentorLabel: "Went to a career fair or career event together",
  },
  {
    key: "society_meeting",
    group: "career_tasks",
    menteeLabel: "Attended a society meeting",
    mentorLabel: "Went to a society meeting together",
  },
  {
    key: "other_career_activity",
    group: "career_tasks",
    menteeLabel: "Completed another career-building activity",
    mentorLabel: "Did another career-building activity together",
  },
  {
    key: "explore_careers",
    group: "career_tasks",
    menteeLabel: "Explored careers, companies, or industries",
    mentorLabel: "Explored careers, companies, or industries together",
  },

  // ---------- Group 2: Industry Experiences ----------
  {
    key: "internship_offer",
    group: "industry_experiences",
    menteeLabel: "I got an internship offer",
    mentorLabel: "My mentee got an internship offer",
  },
  {
    key: "part_time_offer",
    group: "industry_experiences",
    menteeLabel: "I got a career-related, part-time job offer",
    mentorLabel: "My mentee got a career-related, part-time job offer",
  },
  {
    key: "full_time_offer",
    group: "industry_experiences",
    menteeLabel: "I got a career-related, full-time job offer",
    mentorLabel: "My mentee got a career-related, full-time job offer",
  },

  // ---------- Group 3: Career Chats ----------
  {
    key: "info_interview_prep",
    group: "career_chats",
    menteeLabel: "Prepared for an informational interview or career chat",
    mentorLabel: "Helped with informational interview preparation",
  },
  {
    key: "info_interview_done",
    group: "career_chats",
    // Mentor side rarely logs "completed a chat" themselves (the mentee did
    // it). Mirror the verb shape — discuss/reflect with the mentee.
    menteeLabel: "Completed an informational interview or career chat",
    mentorLabel: "Discussed or reflected on a career chat",
  },
  {
    key: "professional_connection",
    group: "career_chats",
    menteeLabel: "Built or strengthened a professional connection",
    mentorLabel: "Shared professional connections and relationships",
  },
];

// Group headings used in the log form sections.
export const GROUP_HEADINGS: Record<AccomplishmentGroupKey, string> = {
  career_tasks: "1. Career Tasks — weekly",
  industry_experiences: "2. Industry Experiences",
  career_chats: "3. Career Chats",
};

// Items that should trigger confetti when logged (any role).
export const CELEBRATION_KEYS: readonly string[] = [
  "internship_offer",
  "part_time_offer",
  "full_time_offer",
];

// ---- Role-aware groupings ----

export type RoleGroup = {
  key: AccomplishmentGroupKey;
  heading: string;
  options: readonly string[]; // labels for the given role
};

export function groupsForRole(role: "mentee" | "mentor"): RoleGroup[] {
  const groups: AccomplishmentGroupKey[] = [
    "career_tasks",
    "industry_experiences",
    "career_chats",
  ];
  return groups.map((g) => ({
    key: g,
    heading: GROUP_HEADINGS[g],
    options: ACTIONS.filter((a) => a.group === g).map((a) =>
      role === "mentee" ? a.menteeLabel : a.mentorLabel
    ),
  }));
}

// All accepted labels for server-side validation — accepts both role variants
// plus the celebration items that are identical across roles. Each label is
// listed once.
export const ALL_LABELS: readonly string[] = (() => {
  const set = new Set<string>();
  for (const a of ACTIONS) {
    set.add(a.menteeLabel);
    set.add(a.mentorLabel);
  }
  // Legacy labels written before this catalog landed — the server still
  // accepts them so old DB rows render cleanly and so any older clients
  // (caching the previous bundle) don't immediately break.
  const legacy = [
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
  ];
  for (const l of legacy) set.add(l);
  return [...set];
})();

// Reverse lookup: label (mentee, mentor, or legacy) → group.
const GROUP_BY_LABEL: Record<string, AccomplishmentGroupKey> = (() => {
  const map: Record<string, AccomplishmentGroupKey> = {};
  for (const a of ACTIONS) {
    map[a.menteeLabel] = a.group;
    map[a.mentorLabel] = a.group;
  }
  // Legacy labels mapped to their group via best-guess content match.
  const LEGACY_GROUP: Record<string, AccomplishmentGroupKey> = {
    "Explore Careers, Companies, Industries": "career_tasks",
    "Share professional connections and relationships": "career_chats",
    "Help with Informational Interview preparation": "career_chats",
    "Go to a Career Fair or other Career Event together": "career_tasks",
    "Go to a Society Meeting together": "career_tasks",
    "Go do something else awesome together": "career_tasks",
    "Help with LinkedIn or Other Platforms": "career_tasks",
    "Work on Resumes": "career_tasks",
    "Work on Cover Letters": "career_tasks",
    "Work on Interviewing Skills": "career_tasks",
    "Role Play Interviewing": "career_tasks",
    "Work on Elevator Pitch": "career_tasks",
    "Help apply to an internship or job": "career_tasks",
    "Help with Grad School Preparation/Application": "career_tasks",
    "Course planning": "career_tasks",
  };
  for (const [l, g] of Object.entries(LEGACY_GROUP)) map[l] = g;
  return map;
})();

export function groupForLabel(label: string): AccomplishmentGroupKey | null {
  return GROUP_BY_LABEL[label] ?? null;
}

// Resolve a label back to its stable key. Useful for celebration detection
// and any future feature that should react to a specific action regardless
// of the user's role.
const KEY_BY_LABEL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const a of ACTIONS) {
    map[a.menteeLabel] = a.key;
    map[a.mentorLabel] = a.key;
  }
  return map;
})();

export function keyForLabel(label: string): string | null {
  return KEY_BY_LABEL[label] ?? null;
}

// Given a set of checked accomplishments (labels), return the dominant
// group. Industry > Chats > Tasks (mirrors prior logic so KPI attribution
// stays the same).
export function dominantGroup(
  accomplishments: readonly string[]
): AccomplishmentGroupKey | null {
  const groups = new Set<AccomplishmentGroupKey>();
  for (const a of accomplishments) {
    const g = groupForLabel(a);
    if (g) groups.add(g);
  }
  if (groups.has("industry_experiences")) return "industry_experiences";
  if (groups.has("career_chats")) return "career_chats";
  if (groups.has("career_tasks")) return "career_tasks";
  return null;
}

// True if any checked label maps to a celebration-worthy key.
export function shouldCelebrate(accomplishments: readonly string[]): boolean {
  return accomplishments.some((l) => {
    const k = keyForLabel(l);
    return k != null && (CELEBRATION_KEYS as readonly string[]).includes(k);
  });
}

// ---- Back-compat exports ----
// Older imports still in the tree expect these names. Re-derived from the
// new ACTIONS catalog so they stay in sync.

export const CAREER_TASKS_OPTIONS: readonly string[] = ACTIONS.filter(
  (a) => a.group === "career_tasks"
).map((a) => a.menteeLabel);

export const INDUSTRY_EXPERIENCES_OPTIONS: readonly string[] = ACTIONS.filter(
  (a) => a.group === "industry_experiences"
).map((a) => a.mentorLabel); // mentor wording is the legacy display

export const CAREER_CHATS_OPTIONS: readonly string[] = ACTIONS.filter(
  (a) => a.group === "career_chats"
).map((a) => a.mentorLabel);

// Legacy: pre-role-aware grouped form structure. Still used by some
// importers (admin views, tests). Defaults to the mentor side.
export const ACCOMPLISHMENT_GROUPS = groupsForRole("mentor");

export const ALL_ACCOMPLISHMENTS = ALL_LABELS;
export const CELEBRATION_ACCOMPLISHMENTS: readonly string[] = ACTIONS.filter(
  (a) => (CELEBRATION_KEYS as readonly string[]).includes(a.key)
).flatMap((a) => [a.menteeLabel, a.mentorLabel]);

// Legacy alias kept so any stale imports keep compiling.
export const groupForAccomplishment = groupForLabel;

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

export const OTHER_ACCOMPLISHMENT = "Other";

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

export const INACTIVITY_WARN_DAYS = 30;
export const INACTIVITY_DISCONNECT_DAYS = 180;
