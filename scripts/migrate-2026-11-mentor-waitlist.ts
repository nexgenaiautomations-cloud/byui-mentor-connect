// One-off, idempotent migration for the mentor waitlist (2026-11-11):
//   * user.mentor_waitlisted_at, user.mentor_wait_notified_at
// Additive only. Safe to re-run. Spec: docs/specs/mentor-waitlist.md
//
// Run: npx tsx scripts/migrate-2026-11-mentor-waitlist.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";

const STATEMENTS = [
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mentor_waitlisted_at" timestamp`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mentor_wait_notified_at" timestamp`,
];

async function main() {
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_OWNER (or DATABASE_URL) not set — check .env.local");
  const sql = neon(url);
  for (const s of STATEMENTS) {
    await sql(s);
    console.log("ok:", s.split("\n")[0].slice(0, 90));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
