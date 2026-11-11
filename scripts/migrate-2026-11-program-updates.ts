// One-off, idempotent migration for the November 2026 program updates
// requested by Shaun Franklin (ICAN App chat, 2026-11-09):
//   * user.is_executive_mentor, user.deactivated_* (admin role controls / remove)
//   * mentor_stewardship (executive mentor oversight)
//   * user.pledge_* (321 pledge signature)
//   * pod + user.pod_id (team leaderboards)
//   * audit_event_type values
//   * grants the runtime app_user role CRUD on the new tables
// Additive only: no drops, no rewrites of existing rows. Safe to re-run.
//
// Run: npx tsx scripts/migrate-2026-11-program-updates.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";

const AUDIT_VALUES = [
  "ADMIN_CHANGED_ROLE",
  "ADMIN_REMOVED_USER",
  "ADMIN_RESTORED_USER",
  "USER_SIGNED_PLEDGE",
  "ADMIN_SET_STEWARDSHIP",
  "ADMIN_CHANGED_POD",
];

const STATEMENTS = [
  ...AUDIT_VALUES.map((v) => `ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS '${v}'`),
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_executive_mentor" boolean DEFAULT false NOT NULL`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deactivated_by_id" text`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deactivation_reason" text`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pledge_signed_name" text`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pledge_signed_at" timestamp`,
  `CREATE TABLE IF NOT EXISTS "mentor_stewardship" (
     "mentor_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
     "executive_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
     "assigned_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "assigned_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS "mentor_stewardship_executive_idx" ON "mentor_stewardship" ("executive_id")`,
  `CREATE TABLE IF NOT EXISTS "pod" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "name" text NOT NULL,
     "major" text,
     "created_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "created_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "pod_name_uniq" ON "pod" (lower("name"))`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pod_id" uuid REFERENCES "pod"("id") ON DELETE SET NULL`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
       GRANT SELECT, INSERT, UPDATE, DELETE ON "mentor_stewardship", "pod" TO app_user;
     END IF;
   END $$`,
];

async function main() {
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_OWNER (or DATABASE_URL) not set — check .env.local");
  const sql = neon(url);
  for (const stmt of STATEMENTS) {
    console.log("[migrate]", stmt.split("\n")[0].slice(0, 90));
    await sql(stmt);
  }
  console.log("[migrate] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
