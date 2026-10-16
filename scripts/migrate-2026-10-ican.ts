// One-off, idempotent migration for the ICAN rebrand (2026-10-16):
//   * user.terms_accepted_version / terms_accepted_at  (disclaimer consent)
//   * school_domain   — which schools' email domains may register
//   * school_inquiry  — "bring ICAN to your school" requests
//   * two audit_event_type values
//   * seeds byui.edu so sign-in keeps working
//   * grants the runtime app_user role CRUD on the new tables
// Additive only: no drops, no rewrites of existing rows. Safe to re-run.
//
// Run: npx tsx scripts/migrate-2026-10-ican.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";

const STATEMENTS = [
  `ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'USER_ACCEPTED_TERMS'`,
  `ALTER TYPE "audit_event_type" ADD VALUE IF NOT EXISTS 'SCHOOL_DOMAIN_CHANGED'`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "terms_accepted_version" text`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp`,
  `CREATE TABLE IF NOT EXISTS "school_domain" (
     "domain" text PRIMARY KEY NOT NULL,
     "school_name" text NOT NULL,
     "active" boolean DEFAULT true NOT NULL,
     "created_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
     "created_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS "school_inquiry" (
     "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
     "contact_name" text NOT NULL,
     "contact_email" text NOT NULL,
     "school_name" text NOT NULL,
     "role" text,
     "email_domain" text,
     "message" text,
     "status" text DEFAULT 'new' NOT NULL,
     "created_at" timestamp DEFAULT now() NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS "school_inquiry_created_idx" ON "school_inquiry" ("created_at")`,
  `INSERT INTO "school_domain" ("domain", "school_name")
     VALUES ('byui.edu', 'Brigham Young University–Idaho')
     ON CONFLICT ("domain") DO NOTHING`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
       GRANT SELECT, INSERT, UPDATE, DELETE ON "school_domain", "school_inquiry" TO app_user;
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
  const [{ count }] = (await sql(`SELECT count(*)::int AS count FROM "school_domain" WHERE active`)) as {
    count: number;
  }[];
  console.log(`[migrate] done — ${count} active school domain(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
