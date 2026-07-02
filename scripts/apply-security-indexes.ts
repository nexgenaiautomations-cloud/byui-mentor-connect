// Idempotent script that applies DB-level invariants that drizzle's `db:push`
// workflow can't express (partial/expression unique indexes). Run after every
// `npm run db:push`, same as `db:apply-rls`.
//
// Invariants enforced:
//   * match_mentee_active_uniq — a mentee holds at most ONE active match.
//     Backstops the application-level guard in api/requests/[id]/route.ts so
//     two mentors accepting the same student concurrently can't both create a
//     match (one insert fails with 23505 and the route cancels that request).
//   * meeting_log_weekly_auto_uniq / meeting_log_monthly_auto_uniq — at most
//     one system-generated goal log per student per ISO week / calendar month.
//     Backstops the check-then-insert dedup in src/lib/auto-logs.ts.
//
// CREATE UNIQUE INDEX will fail if existing data already violates an
// invariant; the error message names the offending index so the operator can
// clean up duplicates first.
//
// Run:
//   npx tsx scripts/apply-security-indexes.ts

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";

async function main() {
  // Index DDL requires the table owner — same setup as apply-rls.ts.
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL_OWNER (or DATABASE_URL) not set — check .env.local"
    );
  }
  const sql = neon(url);

  console.log("[idx] one active match per mentee…");
  await sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS match_mentee_active_uniq
      ON "match" (mentee_id)
      WHERE status = 'active'
  `);

  console.log("[idx] one weekly auto-log per student per ISO week…");
  await sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS meeting_log_weekly_auto_uniq
      ON "meeting_log" (student_id, date_trunc('week', meeting_date))
      WHERE is_system_generated
        AND topics_discussed = 'Weekly Career Task goal completed'
  `);

  console.log("[idx] one monthly auto-log per student per month…");
  await sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS meeting_log_monthly_auto_uniq
      ON "meeting_log" (student_id, date_trunc('month', meeting_date))
      WHERE is_system_generated
        AND topics_discussed = 'Monthly Career Chats goal completed'
  `);

  const rows = await sql(`
    SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN (
         'match_mentee_active_uniq',
         'meeting_log_weekly_auto_uniq',
         'meeting_log_monthly_auto_uniq'
       )
     ORDER BY indexname
  `);
  console.log("[idx] present:");
  for (const row of rows as Array<{ indexname: string }>) {
    console.log(`  - ${row.indexname}`);
  }
  console.log("[idx] done.");
}

main().catch((err) => {
  console.error("[idx] failed:", err);
  process.exit(1);
});
