// One-off, idempotent migration for the accountability upgrade
// (docs/specs/accountability-upgrade.md):
//   * meeting_log.event_kind (+ legacy backfill), confirmations, meeting time
//     + timezone, action_items_done_at
//   * match.first_meeting_at / last_meeting_at / last_interaction_at /
//     last_student_activity_at (+ backfill from classified logs)
//   * notification_preference, scheduled_meeting, notification_delivery,
//     program_setting, career_milestone, intervention, intervention_event
//   * career_milestone backfill from existing offer accomplishments
//   * audit_event_type values, app_user grants
// Additive only: no drops, no renames, no rewrites of existing values except
// filling the NEW columns. last_activity_at is never touched. Safe to re-run.
//
// Run:  npx tsx scripts/migrate-2026-11-accountability.ts
// Plan: DRY_RUN=1 npx tsx scripts/migrate-2026-11-accountability.ts
//
// Deploy order: run this BEFORE deploying the app code (the new code reads the
// new columns). It sends no email; reminders stay off until
// NOTIFICATIONS_MODE is set.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";
import { offersInTopics } from "../src/lib/career";

const AUDIT_VALUES = [
  "ADMIN_UPDATED_INTERVENTION",
  "ADMIN_UPDATED_PROGRAM_SETTINGS",
  "ADMIN_VERIFIED_CAREER_MILESTONE",
  "RETENTION_RUN",
];

const DDL = [
  ...AUDIT_VALUES.map((v) => `ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS '${v}'`),
  `DO $$ BEGIN
     CREATE TYPE "log_event_kind" AS ENUM ('mentor_meeting','touchpoint','independent_activity','system_event','unverified');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // meeting_log
  `ALTER TABLE "meeting_log" ADD COLUMN IF NOT EXISTS "event_kind" "log_event_kind"`,
  `ALTER TABLE "meeting_log" ADD COLUMN IF NOT EXISTS "mentor_confirmed" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE "meeting_log" ADD COLUMN IF NOT EXISTS "next_meeting_time" text`,
  `ALTER TABLE "meeting_log" ADD COLUMN IF NOT EXISTS "next_meeting_timezone" text`,
  `ALTER TABLE "meeting_log" ADD COLUMN IF NOT EXISTS "action_items_done_at" timestamp`,
  `CREATE INDEX IF NOT EXISTS "meeting_log_match_kind_date_idx" ON "meeting_log" ("match_id", "event_kind", "meeting_date")`,
  `CREATE INDEX IF NOT EXISTS "meeting_log_kind_date_idx" ON "meeting_log" ("event_kind", "meeting_date")`,

  // match
  `ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "first_meeting_at" timestamp`,
  `ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "last_meeting_at" timestamp`,
  `ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "last_interaction_at" timestamp`,
  `ALTER TABLE "match" ADD COLUMN IF NOT EXISTS "last_student_activity_at" timestamp`,

  // notifications
  `CREATE TABLE IF NOT EXISTS "notification_preference" (
     "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
     "meeting_reminders" boolean DEFAULT true NOT NULL,
     "follow_ups" boolean DEFAULT true NOT NULL,
     "inactivity_nudges" boolean DEFAULT true NOT NULL,
     "timezone" text DEFAULT 'America/Denver' NOT NULL,
     "updated_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS "scheduled_meeting" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "match_id" uuid NOT NULL REFERENCES "match"("id") ON DELETE CASCADE,
     "source_log_id" uuid REFERENCES "meeting_log"("id") ON DELETE SET NULL,
     "scheduled_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "scheduled_date" text NOT NULL,
     "scheduled_time" text,
     "timezone" text DEFAULT 'America/Denver' NOT NULL,
     "starts_at" timestamp NOT NULL,
     "status" text DEFAULT 'scheduled' NOT NULL,
     "completed_log_id" uuid REFERENCES "meeting_log"("id") ON DELETE SET NULL,
     "created_at" timestamp DEFAULT now() NOT NULL,
     "updated_at" timestamp
   )`,
  `CREATE INDEX IF NOT EXISTS "scheduled_meeting_match_idx" ON "scheduled_meeting" ("match_id")`,
  `CREATE INDEX IF NOT EXISTS "scheduled_meeting_status_starts_idx" ON "scheduled_meeting" ("status", "starts_at")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_meeting_source_log_uniq" ON "scheduled_meeting" ("source_log_id")`,
  `CREATE TABLE IF NOT EXISTS "notification_delivery" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "dedupe_key" text NOT NULL,
     "user_id" text REFERENCES "user"("id") ON DELETE CASCADE,
     "kind" text NOT NULL,
     "match_id" uuid REFERENCES "match"("id") ON DELETE SET NULL,
     "scheduled_meeting_id" uuid REFERENCES "scheduled_meeting"("id") ON DELETE SET NULL,
     "status" text DEFAULT 'pending' NOT NULL,
     "attempts" integer DEFAULT 0 NOT NULL,
     "last_error" text,
     "created_at" timestamp DEFAULT now() NOT NULL,
     "sent_at" timestamp
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "notification_delivery_dedupe_uniq" ON "notification_delivery" ("dedupe_key")`,
  `CREATE INDEX IF NOT EXISTS "notification_delivery_user_created_idx" ON "notification_delivery" ("user_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "notification_delivery_match_idx" ON "notification_delivery" ("match_id", "created_at")`,
  `CREATE TABLE IF NOT EXISTS "program_setting" (
     "school" text DEFAULT '*' NOT NULL,
     "key" text NOT NULL,
     "value_json" text NOT NULL,
     "updated_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "updated_at" timestamp DEFAULT now() NOT NULL,
     PRIMARY KEY ("school", "key")
   )`,

  // career
  `CREATE TABLE IF NOT EXISTS "career_milestone" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "student_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
     "stage" text NOT NULL,
     "opportunity_type" text,
     "career_field" text,
     "employer" text,
     "position_title" text,
     "occurred_on" timestamp DEFAULT now() NOT NULL,
     "source" text DEFAULT 'self_reported' NOT NULL,
     "source_log_id" uuid REFERENCES "meeting_log"("id") ON DELETE CASCADE,
     "related_milestone_id" uuid,
     "verification" text DEFAULT 'self_reported' NOT NULL,
     "verified_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "verified_at" timestamp,
     "created_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS "career_milestone_student_idx" ON "career_milestone" ("student_id", "occurred_on")`,
  `CREATE INDEX IF NOT EXISTS "career_milestone_stage_idx" ON "career_milestone" ("stage")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "career_milestone_source_log_uniq" ON "career_milestone" ("source_log_id", "opportunity_type")`,

  // interventions
  `CREATE TABLE IF NOT EXISTS "intervention" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "match_id" uuid NOT NULL REFERENCES "match"("id") ON DELETE CASCADE,
     "student_id" text REFERENCES "user"("id") ON DELETE CASCADE,
     "mentor_id" text REFERENCES "user"("id") ON DELETE CASCADE,
     "school" text NOT NULL,
     "reasons" text[] NOT NULL,
     "status" text DEFAULT 'new' NOT NULL,
     "assigned_to_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "follow_up_on" timestamp,
     "last_outreach_at" timestamp,
     "last_outreach_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "opened_at" timestamp DEFAULT now() NOT NULL,
     "last_detected_at" timestamp DEFAULT now() NOT NULL,
     "resolved_at" timestamp,
     "updated_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS "intervention_school_status_idx" ON "intervention" ("school", "status")`,
  `CREATE INDEX IF NOT EXISTS "intervention_match_idx" ON "intervention" ("match_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "intervention_open_match_uniq" ON "intervention" ("match_id") WHERE status NOT IN ('resolved','closed')`,
  `CREATE TABLE IF NOT EXISTS "intervention_event" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "intervention_id" uuid NOT NULL REFERENCES "intervention"("id") ON DELETE CASCADE,
     "actor_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "action" text NOT NULL,
     "from_status" text,
     "to_status" text,
     "note" text,
     "created_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS "intervention_event_case_idx" ON "intervention_event" ("intervention_id", "created_at")`,

  // Legal / investigation holds honoured by the retention job. user_id is
  // deliberately not a foreign key: a hold must survive account deletion.
  `CREATE TABLE IF NOT EXISTS "retention_hold" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "user_id" text NOT NULL,
     "reason" text NOT NULL,
     "created_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "created_at" timestamp DEFAULT now() NOT NULL,
     "released_at" timestamp
   )`,
  `CREATE INDEX IF NOT EXISTS "retention_hold_user_idx" ON "retention_hold" ("user_id")`,

  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
       GRANT SELECT, INSERT, UPDATE, DELETE ON
         "notification_preference", "scheduled_meeting", "notification_delivery",
         "program_setting", "career_milestone", "intervention", "intervention_event"
       TO app_user;
       -- The app may read holds; only operators (owner role) create/release
       -- them. Revoke explicitly: default privileges would otherwise grant
       -- app_user full write access to a new table.
       GRANT SELECT ON "retention_hold" TO app_user;
       REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "retention_hold" FROM app_user;
     END IF;
   END $$`,
];

// Mirrors classifyLegacyLog() in src/lib/engagement.ts. Only rows still NULL
// are touched, so re-running never re-classifies a row the app wrote.
const BACKFILL_KIND = `
  UPDATE "meeting_log" SET event_kind = CASE
    WHEN is_system_generated OR created_by = 'system' THEN 'system_event'
    WHEN created_by IN ('mentor','admin') AND match_id IS NOT NULL THEN 'mentor_meeting'
    WHEN created_by = 'mentee' AND match_id IS NULL THEN 'independent_activity'
    WHEN created_by = 'mentee' AND meeting_type = 'other' THEN 'independent_activity'
    ELSE 'unverified'
  END::log_event_kind
  WHERE event_kind IS NULL`;

// Confirmation flags for legacy rows: the logger's own side.
const BACKFILL_CONFIRM = `
  UPDATE "meeting_log" SET mentor_confirmed = true
  WHERE created_by IN ('mentor','admin') AND mentor_confirmed = false
    AND event_kind = 'mentor_meeting'`;

// Mirrors computeMatchTimestamps(). Recomputes only the four NEW columns.
const BACKFILL_MATCH = `
  UPDATE "match" m SET
    first_meeting_at = s.first_meeting,
    last_meeting_at = s.last_meeting,
    last_interaction_at = s.last_interaction,
    last_student_activity_at = s.last_student
  FROM (
    SELECT l.match_id,
      min(l.meeting_date) FILTER (WHERE l.event_kind = 'mentor_meeting') AS first_meeting,
      max(l.meeting_date) FILTER (WHERE l.event_kind = 'mentor_meeting') AS last_meeting,
      max(l.meeting_date) FILTER (WHERE l.event_kind IN ('mentor_meeting','touchpoint')) AS last_interaction,
      max(l.meeting_date) FILTER (WHERE l.event_kind = 'independent_activity' AND l.student_id = mm.mentee_id) AS last_student
    FROM "meeting_log" l JOIN "match" mm ON mm.id = l.match_id
    GROUP BY l.match_id
  ) s
  WHERE m.id = s.match_id`;

async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_OWNER (or DATABASE_URL) not set — check .env.local");
  const sql = neon(url);
  const host = new URL(url).host;
  console.log(`[migrate] target ${host}${dryRun ? " (DRY RUN — nothing will be written)" : ""}`);

  for (const stmt of [...DDL, BACKFILL_KIND, BACKFILL_CONFIRM, BACKFILL_MATCH]) {
    console.log("[migrate]", stmt.trim().split("\n")[0].slice(0, 100));
    if (!dryRun) await sql(stmt);
  }
  if (dryRun) {
    console.log("[migrate] dry run complete");
    return;
  }

  // Career milestones from existing offer accomplishments. One milestone per
  // (log, offer type); the unique index makes this re-runnable.
  const offerLogs = (await sql(
    `SELECT id, student_id, topics_discussed, meeting_date FROM "meeting_log"
      WHERE accomplishment_group = 'industry_experiences' AND student_id IS NOT NULL
        AND NOT is_system_generated`
  )) as { id: string; student_id: string; topics_discussed: string | null; meeting_date: string }[];
  let milestones = 0;
  for (const l of offerLogs) {
    for (const type of offersInTopics(l.topics_discussed)) {
      const r = (await sql(
        `INSERT INTO "career_milestone" (student_id, stage, opportunity_type, occurred_on, source, source_log_id)
         VALUES ($1, 'offer_received', $2, $3, 'activity_log', $4)
         ON CONFLICT (source_log_id, opportunity_type) DO NOTHING RETURNING id`,
        [l.student_id, type, l.meeting_date, l.id]
      )) as unknown[];
      milestones += r.length;
    }
  }

  const summary = await sql(
    `SELECT coalesce(event_kind::text,'(null)') AS kind, count(*)::int AS n FROM "meeting_log" GROUP BY 1 ORDER BY 1`
  );
  console.log("[migrate] meeting_log by event_kind:", summary);
  console.log(`[migrate] career milestones created from offer logs: ${milestones}`);
  console.log("[migrate] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
