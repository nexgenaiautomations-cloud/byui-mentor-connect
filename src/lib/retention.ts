// Data-retention rules — the single registry the maintenance job reads.
// docs/security/retention-policy.md must describe exactly these rules.
//
// `enforce: true` means the job may DELETE eligible rows (and only when
// RETENTION_MODE=enforce). Every other rule is report-only: the job counts
// what would be eligible so an operator can act once the institution has
// approved the period. Nothing here ever touches active mentorships, rows
// under a legal hold, or the append-only audit log.

export type RetentionRuleId =
  | "expired_verification_tokens"
  | "expired_password_reset_tokens"
  | "notification_delivery"
  | "meeting_log_after_match"
  | "scheduled_meeting_after_match"
  | "mentor_application"
  | "closed_intervention"
  | "career_milestone_inactive"
  | "audit_event_hot"
  | "inactive_account";

export type RetentionRule = {
  id: RetentionRuleId;
  table: string;
  description: string;
  // Days after the reference date before a row becomes eligible.
  days: number;
  reference: string;
  enforce: boolean;
  // Why it isn't enforced automatically (shown to operators).
  blockedBy?: string;
};

export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    id: "expired_verification_tokens",
    table: "verification_token",
    description: "Sign-in and email-verification tokens past their expiry",
    days: 1,
    reference: "expires",
    enforce: true,
  },
  {
    id: "expired_password_reset_tokens",
    table: "password_reset_token",
    description: "Password-reset tokens past their expiry",
    days: 1,
    reference: "expires_at",
    enforce: true,
  },
  {
    id: "notification_delivery",
    table: "notification_delivery",
    description: "Reminder delivery records (no email content)",
    days: 548,
    reference: "created_at",
    enforce: false,
    blockedBy: "Proposed 18-month period awaits program sign-off; ROI history uses these rows.",
  },
  {
    id: "meeting_log_after_match",
    table: "meeting_log",
    description: "Activity logs for pairs that ended more than 2 years ago",
    days: 730,
    reference: "match.ended_at",
    enforce: false,
    blockedBy: "Deleting student activity history needs institutional approval (FERPA records schedule).",
  },
  {
    id: "scheduled_meeting_after_match",
    table: "scheduled_meeting",
    description: "Planned meetings for pairs that ended more than 2 years ago",
    days: 730,
    reference: "match.ended_at",
    enforce: false,
    blockedBy: "Follows the meeting-log decision.",
  },
  {
    id: "mentor_application",
    table: "mentor_application",
    description: "Reviewed mentor applications older than 3 years",
    days: 1095,
    reference: "reviewed_at",
    enforce: false,
    blockedBy: "Needs institutional approval.",
  },
  {
    id: "closed_intervention",
    table: "intervention",
    description: "Intervention cases resolved or closed more than 3 years ago (with their trail)",
    days: 1095,
    reference: "resolved_at",
    enforce: false,
    blockedBy: "Accountability record; needs program sign-off.",
  },
  {
    id: "career_milestone_inactive",
    table: "career_milestone",
    description: "Career milestones of accounts removed more than 2 years ago",
    days: 730,
    reference: "user.deactivated_at",
    enforce: false,
    blockedBy: "Outcome reporting; needs institutional approval.",
  },
  {
    id: "audit_event_hot",
    table: "audit_event",
    description: "Audit events older than the 365-day hot window (archive candidates)",
    days: 365,
    reference: "created_at",
    enforce: false,
    blockedBy:
      "Append-only by Row Level Security — the app cannot delete these. Requires an approved, encrypted external archive first.",
  },
  {
    id: "inactive_account",
    table: "user",
    description: "Accounts removed (deactivated) more than 1 year ago",
    days: 365,
    reference: "deactivated_at",
    enforce: false,
    blockedBy: "Account deletion follows the documented manual deletion process (scripts/delete-user.ts).",
  },
];

export type RetentionMode = "report" | "enforce";

// Anything but an explicit "enforce" only reports.
export function retentionMode(raw: string | undefined): RetentionMode {
  return (raw ?? "").trim().toLowerCase() === "enforce" ? "enforce" : "report";
}

export function cutoffFor(rule: Pick<RetentionRule, "days">, now: Date): Date {
  return new Date(now.getTime() - rule.days * 24 * 60 * 60 * 1000);
}

export const BATCH_SIZE = 500;
export const MAX_BATCHES_PER_RULE = 20;
export const LOCK_MINUTES = 15;

export type RuleResult = {
  id: RetentionRuleId;
  eligible: number;
  deleted: number;
  enforced: boolean;
  cutoff: string;
  error?: string;
};
