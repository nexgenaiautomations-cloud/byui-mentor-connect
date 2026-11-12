// Filterable admin report (Shaun Franklin, 2026-11-09): "date ranges and more
// filters, like QuickBooks: dept / major / year in school / mentee count /
// informational interviews". Pure helpers; data loading is in reports-server.

import { LEADERBOARD_TIME_ZONE, zonedMidnight, zonedParts } from "@/lib/pods";

export const RANGE_PRESETS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30", label: "Last 30 days" },
  { value: "last_90", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom dates" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

// Department for each College of Business and Communication major.
// Majors not listed fall under "Other". Edit here if the program's
// department grouping differs.
const DEPARTMENTS: Record<string, string> = {
  Accounting: "Accounting",
  Agribusiness: "Economics",
  Economics: "Economics",
  "Financial Economics": "Economics",
  "Business Analytics": "Business Management",
  "Business Management": "Business Management",
  Finance: "Business Management",
  Marketing: "Business Management",
  "Supply Chain Operations": "Business Management",
};

export function departmentOf(major: string | null): string {
  const m = major?.trim();
  if (!m) return "Not listed";
  if (m.startsWith("Communication")) return "Communication";
  return DEPARTMENTS[m] ?? "Other";
}

export const DEPARTMENT_OPTIONS = [
  "Accounting",
  "Business Management",
  "Communication",
  "Economics",
  "Other",
  "Not listed",
];

// --- date ranges (Mountain time, like the leaderboard) ---

const DAY = 24 * 60 * 60 * 1000;

const zoneMidnight = (y: number, m: number, d: number) => zonedMidnight(y, m, d, LEADERBOARD_TIME_ZONE);
const localParts = (d: Date) => zonedParts(d, LEADERBOARD_TIME_ZONE);

function parseDay(s: string | undefined): { y: number; m: number; d: number } | null {
  const match = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const check = new Date(Date.UTC(y, m, d));
  if (check.getUTCMonth() !== m || check.getUTCDate() !== d) return null;
  return { y, m, d };
}

export type ResolvedRange = { preset: RangePreset; start: Date; end: Date; from: string; to: string };

function isoDay(d: Date) {
  const { y, m, d: day } = localParts(d);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function resolveRange(
  input: { preset?: string; from?: string; to?: string },
  now: Date = new Date()
): ResolvedRange {
  const preset = (RANGE_PRESETS.some((p) => p.value === input.preset) ? input.preset : "last_30") as RangePreset;
  const today = localParts(now);
  let start: Date;
  let end: Date = now;
  switch (preset) {
    case "this_month":
      start = zoneMidnight(today.y, today.m, 1);
      break;
    case "last_month":
      start = zoneMidnight(today.m === 0 ? today.y - 1 : today.y, (today.m + 11) % 12, 1);
      end = zoneMidnight(today.y, today.m, 1);
      break;
    case "last_90":
      start = new Date(now.getTime() - 90 * DAY);
      break;
    case "ytd":
      start = zoneMidnight(today.y, 0, 1);
      break;
    case "last_12_months":
      start = new Date(now.getTime() - 365 * DAY);
      break;
    case "all":
      start = new Date(Date.UTC(2020, 0, 1));
      break;
    case "custom": {
      let a = parseDay(input.from);
      let b = parseDay(input.to) ?? (a ? today : null);
      if (!a || !b) return resolveRange({ preset: "last_30" }, now);
      if (Date.UTC(a.y, a.m, a.d) > Date.UTC(b.y, b.m, b.d)) [a, b] = [b, a];
      start = zoneMidnight(a.y, a.m, a.d);
      end = zoneMidnight(b.y, b.m, b.d + 1);
      break;
    }
    default:
      start = new Date(now.getTime() - 30 * DAY);
  }
  return { preset, start, end, from: isoDay(start), to: isoDay(new Date(end.getTime() - 1)) };
}

// --- per-person rows + filters ---

export type ReportRole = "member" | "mentor" | "executive_mentor" | "admin";

export type ReportRow = {
  id: string;
  name: string | null;
  email: string;
  role: ReportRole;
  major: string | null;
  department: string;
  semesterLevel: string | null;
  podName: string | null;
  activeMentees: number;
  activities: number;
  careerTasks: number;
  industryExperiences: number;
  careerChats: number; // informational interviews / career chats logged in range
  points: number;
  joinedInRange: boolean;
};

export type ReportFilters = {
  department: string | null;
  major: string | null;
  year: string | null;
  role: ReportRole | null;
  minMentees: number | null;
  minInterviews: number | null;
};

const ROLES: ReportRole[] = ["member", "mentor", "executive_mentor", "admin"];
export const COUNT_THRESHOLDS = [0, 1, 3, 5, 10];

function intOrNull(v: string | undefined) {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 1000 ? n : null;
}

export function parseFilters(p: Record<string, string | undefined>): ReportFilters {
  return {
    department: p.department?.trim() || null,
    major: p.major?.trim() || null,
    year: p.year?.trim() || null,
    role: ROLES.includes(p.role as ReportRole) ? (p.role as ReportRole) : null,
    minMentees: intOrNull(p.mentees),
    minInterviews: intOrNull(p.interviews),
  };
}

export function applyFilters(rows: ReportRow[], f: ReportFilters): ReportRow[] {
  return rows.filter(
    (r) =>
      (!f.department || r.department === f.department) &&
      (!f.major || r.major === f.major) &&
      (!f.year || r.semesterLevel === f.year) &&
      (!f.role || r.role === f.role) &&
      (f.minMentees === null || r.activeMentees >= f.minMentees) &&
      (f.minInterviews === null || r.careerChats >= f.minInterviews)
  );
}

export const ROLE_LABEL: Record<ReportRole, string> = {
  member: "Member",
  mentor: "Mentor",
  executive_mentor: "Executive mentor",
  admin: "Admin",
};

// --- CSV export ---

export function csvCell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ReportRow[]): string {
  const header = [
    "Name", "Email", "Role", "Department", "Major", "Year in school", "Pod",
    "Active mentees", "Activity logs", "Career tasks", "Industry experiences",
    "Career chats / informational interviews", "Points",
  ];
  const lines = rows.map((r) =>
    [
      r.name, r.email, ROLE_LABEL[r.role], r.department, r.major, r.semesterLevel, r.podName,
      r.activeMentees, r.activities, r.careerTasks, r.industryExperiences, r.careerChats, r.points,
    ].map(csvCell).join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
