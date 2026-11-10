// One-off, idempotent migration for admin issue acknowledgement (2026-11):
//   * issue_report.status / addressed_at / addressed_by_id / resolution_note
//   * issue_report_receipt (one row per admin per issue they acknowledged)
//   * three audit_event_type values
//   * grants the runtime app_user role CRUD on the new table
// Additive only: no drops, no rewrites of existing rows. Safe to re-run.
// Existing issues start "open" with no receipts, so every admin will be asked
// to acknowledge them on next sign-in.
//
// Run: npx tsx scripts/migrate-2026-11-issue-reports.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";

const STATEMENTS = [
  `ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'ISSUE_REPORTED'`,
  `ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'ADMIN_ACKNOWLEDGED_ISSUE'`,
  `ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'ADMIN_ADDRESSED_ISSUE'`,
  `ALTER TABLE "issue_report" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'open' NOT NULL`,
  `ALTER TABLE "issue_report" ADD COLUMN IF NOT EXISTS "addressed_at" timestamp`,
  `ALTER TABLE "issue_report" ADD COLUMN IF NOT EXISTS "addressed_by_id" text REFERENCES "user"("id") ON DELETE SET NULL`,
  `ALTER TABLE "issue_report" ADD COLUMN IF NOT EXISTS "resolution_note" text`,
  `CREATE TABLE IF NOT EXISTS "issue_report_receipt" (
     "issue_id" uuid NOT NULL REFERENCES "issue_report"("id") ON DELETE CASCADE,
     "admin_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
     "seen_at" timestamp DEFAULT now() NOT NULL,
     CONSTRAINT "issue_report_receipt_issue_id_admin_id_pk" PRIMARY KEY ("issue_id", "admin_id")
   )`,
  `CREATE INDEX IF NOT EXISTS "issue_report_receipt_admin_idx" ON "issue_report_receipt" ("admin_id")`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
       GRANT SELECT, INSERT, UPDATE, DELETE ON "issue_report_receipt" TO app_user;
       GRANT SELECT, INSERT, UPDATE ON "issue_report" TO app_user;
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
  const [{ count }] = (await sql(`SELECT count(*)::int AS count FROM "issue_report"`)) as {
    count: number;
  }[];
  console.log(`[migrate] done — ${count} existing issue report(s) now require acknowledgement`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
