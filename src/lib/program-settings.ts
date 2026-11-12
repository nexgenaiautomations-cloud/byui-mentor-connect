// Program configuration: accountability thresholds and ROI assumptions.
// Stored per school in program_setting (school "*" = default for everyone).
// Pure module — parsing + defaults; the DB layer is program-settings-server.ts.
import { z } from "zod";

export const thresholdsSchema = z.object({
  // Reminders (emails to the pair)
  firstMeetingNudgeDays: z.number().int().min(1).max(90),
  checkInNudgeDays: z.number().int().min(1).max(180),
  concernNudgeDays: z.number().int().min(1).max(365),
  // Intervention Center risk rules
  adminAttentionDays: z.number().int().min(1).max(365),
  noFirstMeetingRiskDays: z.number().int().min(1).max(180),
  unansweredReminders: z.number().int().min(1).max(20),
  lowRatingMax: z.number().int().min(1).max(4),
  stalledActionDays: z.number().int().min(1).max(180),
  // Expected meeting cadence used by "meeting their expected cadence"
  expectedMeetingIntervalDays: z.number().int().min(1).max(120),
});
export type Thresholds = z.infer<typeof thresholdsSchema>;

export const DEFAULT_THRESHOLDS: Thresholds = {
  firstMeetingNudgeDays: 7,
  checkInNudgeDays: 14,
  concernNudgeDays: 30,
  adminAttentionDays: 60,
  noFirstMeetingRiskDays: 21,
  unansweredReminders: 3,
  lowRatingMax: 2,
  stalledActionDays: 21,
  expectedMeetingIntervalDays: 30,
};

export const roiSchema = z.object({
  minutesPerReminder: z.number().min(0).max(240),
  minutesPerFollowUp: z.number().min(0).max(240),
  minutesPerIntervention: z.number().min(0).max(600),
  staffHourlyCost: z.number().min(0).max(1000),
  // Optional: a dollar value per mentorship hour. 0 = don't show.
  mentorHourValue: z.number().min(0).max(1000),
});
export type RoiAssumptions = z.infer<typeof roiSchema>;

export const DEFAULT_ROI: RoiAssumptions = {
  minutesPerReminder: 3,
  minutesPerFollowUp: 5,
  minutesPerIntervention: 20,
  staffHourlyCost: 25,
  mentorHourValue: 0,
};

// Merge a stored JSON blob over defaults. Unknown keys are dropped and a
// malformed blob falls back to defaults, so a bad row can't break the app.
function merge<T extends object>(schema: z.ZodType<T>, defaults: T, ...layers: (string | null | undefined)[]): T {
  let out: T = { ...defaults };
  for (const raw of layers) {
    if (!raw) continue;
    try {
      const candidate = { ...out, ...JSON.parse(raw) };
      const parsed = schema.safeParse(candidate);
      if (parsed.success) out = parsed.data;
    } catch {
      // ignore malformed layer
    }
  }
  return out;
}

export function resolveThresholds(...layers: (string | null | undefined)[]): Thresholds {
  return merge(thresholdsSchema, DEFAULT_THRESHOLDS, ...layers);
}

export function resolveRoi(...layers: (string | null | undefined)[]): RoiAssumptions {
  return merge(roiSchema, DEFAULT_ROI, ...layers);
}

// Reminder thresholds must escalate in order or the job would send a
// "concern" email before the "check-in" one.
export function thresholdOrderError(t: Thresholds): string | null {
  if (!(t.checkInNudgeDays < t.concernNudgeDays && t.concernNudgeDays < t.adminAttentionDays)) {
    return "Check-in, concern and admin-attention days must increase in that order.";
  }
  return null;
}

export const SETTING_KEYS = {
  thresholds: "thresholds",
  roi: "roi",
  notificationsLiveSince: "notifications_live_since",
} as const;
