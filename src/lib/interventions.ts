// Intervention Center — pure risk rules + status machine.
// docs/specs/accountability-upgrade.md §5.
import { daysBetween, interactionReference } from "@/lib/engagement";
import type { Thresholds } from "@/lib/program-settings";

export const RISK_REASONS = [
  "no_first_meeting",
  "interaction_gap",
  "missed_meeting",
  "unanswered_reminders",
  "low_satisfaction",
  "stalled_actions",
] as const;
export type RiskReason = (typeof RISK_REASONS)[number];

export const RISK_LABEL: Record<RiskReason, string> = {
  no_first_meeting: "No first meeting yet",
  interaction_gap: "Long gap since last interaction",
  missed_meeting: "Missed a scheduled meeting",
  unanswered_reminders: "Reminders not answered",
  low_satisfaction: "Low satisfaction rating",
  stalled_actions: "Action items stalled",
};

export type MatchRiskFacts = {
  startedAt: Date;
  firstMeetingAt: Date | null;
  lastInteractionAt: Date | null;
  // Scheduled meetings marked missed since the last interaction.
  missedSinceInteraction: number;
  // Reminder emails delivered since the last interaction.
  remindersSinceInteraction: number;
  // Most recent monthly rating submitted by the mentee (1-5), if any.
  latestMenteeRating: number | null;
  // Oldest meeting whose action items are still not marked done.
  oldestOpenActionItemsAt: Date | null;
};

export function assessRisk(f: MatchRiskFacts, t: Thresholds, now: Date): RiskReason[] {
  const out: RiskReason[] = [];
  const ref = interactionReference(f);
  if (!f.firstMeetingAt && daysBetween(f.startedAt, now) >= t.noFirstMeetingRiskDays) {
    out.push("no_first_meeting");
  }
  if (daysBetween(ref, now) >= t.adminAttentionDays) out.push("interaction_gap");
  if (f.missedSinceInteraction > 0) out.push("missed_meeting");
  if (f.remindersSinceInteraction >= t.unansweredReminders) out.push("unanswered_reminders");
  if (f.latestMenteeRating !== null && f.latestMenteeRating <= t.lowRatingMax) {
    out.push("low_satisfaction");
  }
  if (
    f.oldestOpenActionItemsAt &&
    daysBetween(f.oldestOpenActionItemsAt, now) >= t.stalledActionDays &&
    (!f.lastInteractionAt || f.lastInteractionAt <= f.oldestOpenActionItemsAt)
  ) {
    out.push("stalled_actions");
  }
  return out;
}

// ---- Status machine ----

export const INTERVENTION_STATUSES = [
  "new",
  "reviewing",
  "contacted",
  "awaiting_response",
  "resolved",
  "closed",
] as const;
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

export const STATUS_LABEL: Record<InterventionStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  contacted: "Contacted",
  awaiting_response: "Awaiting response",
  resolved: "Resolved",
  closed: "Closed",
};

export const OPEN_STATUSES: readonly InterventionStatus[] = ["new", "reviewing", "contacted", "awaiting_response"];

export function isOpen(s: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(s);
}

export function isInterventionStatus(v: unknown): v is InterventionStatus {
  return typeof v === "string" && (INTERVENTION_STATUSES as readonly string[]).includes(v);
}

// Open cases move freely between open states and can be resolved/closed.
// Finished cases can only be reopened to "reviewing". Nothing returns to "new".
export function canTransition(from: InterventionStatus, to: InterventionStatus): boolean {
  if (from === to) return false;
  if (to === "new") return false;
  if (isOpen(from)) return true;
  return to === "reviewing";
}

// Another admin recorded outreach recently → warn before a duplicate contact.
export const OUTREACH_COOLDOWN_HOURS = 48;

export function duplicateOutreachWarning(
  c: { lastOutreachAt: Date | null; lastOutreachById: string | null },
  actorId: string,
  now: Date
): boolean {
  if (!c.lastOutreachAt || !c.lastOutreachById || c.lastOutreachById === actorId) return false;
  return now.getTime() - c.lastOutreachAt.getTime() < OUTREACH_COOLDOWN_HOURS * 60 * 60 * 1000;
}
