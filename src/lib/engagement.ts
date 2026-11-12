// Event classification + engagement timestamps for mentorship matches.
// Pure module (no DB) — see docs/specs/accountability-upgrade.md §1–2.
//
// The rule that matters everywhere: only `mentor_meeting` and `touchpoint`
// rows are evidence that a mentor and mentee interacted. Independent student
// activity, system auto-logs and unclassifiable legacy rows are not.

export const EVENT_KINDS = [
  "mentor_meeting",
  "touchpoint",
  "independent_activity",
  "system_event",
  "unverified",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  mentor_meeting: "Mentor meeting",
  touchpoint: "Touchpoint",
  independent_activity: "Independent activity",
  system_event: "System",
  unverified: "Unverified (legacy)",
};

export function isInteraction(kind: EventKind | null | undefined): boolean {
  return kind === "mentor_meeting" || kind === "touchpoint";
}

export function isMeeting(kind: EventKind | null | undefined): boolean {
  return kind === "mentor_meeting";
}

export function countsTowardMeetings(row: { eventKind: EventKind | null }): boolean {
  return isMeeting(row.eventKind);
}

// ---- Legacy backfill ----

export type LegacyLogShape = {
  isSystemGenerated: boolean;
  createdBy: "mentee" | "mentor" | "admin" | "system" | null;
  matchId: string | null;
  meetingType: "in_person" | "video" | "phone" | "other" | null;
};

// Mirrors the SQL backfill in scripts/migrate-2026-11-accountability.ts —
// keep the two in lockstep. Anything we can't classify honestly is
// "unverified", never a meeting.
export function classifyLegacyLog(row: LegacyLogShape): EventKind {
  if (row.isSystemGenerated || row.createdBy === "system") return "system_event";
  if ((row.createdBy === "mentor" || row.createdBy === "admin") && row.matchId) {
    return "mentor_meeting";
  }
  if (row.createdBy === "mentee" && !row.matchId) return "independent_activity";
  if (row.createdBy === "mentee" && row.meetingType === "other") {
    return "independent_activity";
  }
  return "unverified";
}

// ---- New logs ----

// `path` is which side of POST /api/meeting-logs created the row: the mentor
// logging for a specific match, or a member logging for themselves.
export function resolveEventKind(input: {
  path: "mentor" | "self";
  requested: string | null | undefined;
  hasMatch: boolean;
}): EventKind {
  if (input.path === "mentor") {
    return input.requested === "touchpoint" ? "touchpoint" : "mentor_meeting";
  }
  if (input.hasMatch && (input.requested === "mentor_meeting" || input.requested === "touchpoint")) {
    return input.requested;
  }
  return "independent_activity";
}

// ---- Match timestamps ----

export type MatchTimestamps = {
  firstMeetingAt: Date | null;
  lastMeetingAt: Date | null;
  lastInteractionAt: Date | null;
  lastStudentActivityAt: Date | null;
};

export function computeMatchTimestamps(
  logs: { eventKind: EventKind | null; meetingDate: Date; studentId: string | null }[],
  menteeId: string
): MatchTimestamps {
  let firstMeetingAt: Date | null = null;
  let lastMeetingAt: Date | null = null;
  let lastInteractionAt: Date | null = null;
  let lastStudentActivityAt: Date | null = null;
  for (const l of logs) {
    const t = l.meetingDate;
    if (isMeeting(l.eventKind)) {
      if (!firstMeetingAt || t < firstMeetingAt) firstMeetingAt = t;
      if (!lastMeetingAt || t > lastMeetingAt) lastMeetingAt = t;
    }
    if (isInteraction(l.eventKind)) {
      if (!lastInteractionAt || t > lastInteractionAt) lastInteractionAt = t;
    }
    if (l.eventKind === "independent_activity" && l.studentId === menteeId) {
      if (!lastStudentActivityAt || t > lastStudentActivityAt) lastStudentActivityAt = t;
    }
  }
  return { firstMeetingAt, lastMeetingAt, lastInteractionAt, lastStudentActivityAt };
}

// The instant inactivity is measured from: last real interaction, or the
// match start if the pair has never interacted.
export function interactionReference(m: { lastInteractionAt: Date | null; startedAt: Date }): Date {
  return m.lastInteractionAt ?? m.startedAt;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}
