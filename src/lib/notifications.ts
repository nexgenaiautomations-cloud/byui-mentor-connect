// Notification rules — pure. The scheduled job (reminder-job.ts) gathers
// facts from the DB and asks these functions what to send.
// docs/specs/accountability-upgrade.md §3.
import { DAY_MS, interactionReference } from "@/lib/engagement";
import type { Thresholds } from "@/lib/program-settings";

export const NOTIFICATION_KINDS = [
  "meeting_24h",
  "meeting_1h",
  "log_followup",
  "confirm_meeting",
  "action_items",
  "inactivity_first_meeting",
  "inactivity_checkin",
  "inactivity_concern",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type PreferenceCategory = "meetingReminders" | "followUps" | "inactivityNudges";

export const KIND_CATEGORY: Record<NotificationKind, PreferenceCategory> = {
  meeting_24h: "meetingReminders",
  meeting_1h: "meetingReminders",
  log_followup: "followUps",
  confirm_meeting: "followUps",
  action_items: "followUps",
  inactivity_first_meeting: "inactivityNudges",
  inactivity_checkin: "inactivityNudges",
  inactivity_concern: "inactivityNudges",
};

export type Preferences = Record<PreferenceCategory, boolean>;
export const DEFAULT_PREFERENCES: Preferences = {
  meetingReminders: true,
  followUps: true,
  inactivityNudges: true,
};

export function allowedByPreferences(kind: NotificationKind, prefs: Preferences | null | undefined): boolean {
  return (prefs ?? DEFAULT_PREFERENCES)[KIND_CATEGORY[kind]];
}

// ---- Mode ----

export type NotificationMode = "off" | "dry_run" | "live";

// Anything other than an explicit "live"/"dry_run" is off, so a typo can
// never start sending email.
export function notificationMode(raw: string | undefined): NotificationMode {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "live") return "live";
  if (v === "dry_run" || v === "dry-run" || v === "dryrun") return "dry_run";
  return "off";
}

export function maxPerRun(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 500) : 50;
}

export const PER_USER_DAILY_CAP = 3;
export const MAX_ATTEMPTS = 3;

// ---- Dedupe keys (one notification per key, ever) ----

export const dedupe = {
  meeting: (kind: "meeting_24h" | "meeting_1h" | "log_followup", meetingId: string, userId: string) =>
    `${kind}:${meetingId}:${userId}`,
  log: (kind: "confirm_meeting" | "action_items", logId: string, userId: string) => `${kind}:${logId}:${userId}`,
  // Keyed by the gap's reference instant: a new interaction starts a new gap,
  // so the same pair can be nudged again later — but once per threshold per gap.
  inactivity: (kind: NotificationKind, matchId: string, ref: Date, userId: string) =>
    `${kind}:${matchId}:${ref.toISOString()}:${userId}`,
};

// ---- Inactivity ----

export type InactivityFacts = {
  startedAt: Date;
  firstMeetingAt: Date | null;
  lastInteractionAt: Date | null;
};

// The single most-escalated nudge whose threshold has been crossed, or null.
// Only crossings at or after `liveSince` count, so turning notifications on
// never emails pairs that went quiet long before (the backlog guard).
export function pickInactivityNudge(
  m: InactivityFacts,
  t: Thresholds,
  now: Date,
  liveSince: Date
): { kind: NotificationKind; ref: Date; crossedAt: Date } | null {
  const ref = interactionReference(m);
  const ladder: { kind: NotificationKind; days: number; applies: boolean }[] = [
    { kind: "inactivity_concern", days: t.concernNudgeDays, applies: true },
    { kind: "inactivity_checkin", days: t.checkInNudgeDays, applies: true },
    // "Have your first meeting" only makes sense before any meeting.
    { kind: "inactivity_first_meeting", days: t.firstMeetingNudgeDays, applies: !m.firstMeetingAt },
  ];
  for (const step of ladder) {
    if (!step.applies) continue;
    const crossedAt = new Date(ref.getTime() + step.days * DAY_MS);
    if (crossedAt <= now) {
      // Most-escalated crossed step wins; if it predates the guard, nothing
      // lower is sent either (it would be even older).
      return crossedAt >= liveSince ? { kind: step.kind, ref, crossedAt } : null;
    }
  }
  return null;
}

// ---- Caps ----

export function underUserCap(sentLast24h: number): boolean {
  return sentLast24h < PER_USER_DAILY_CAP;
}
