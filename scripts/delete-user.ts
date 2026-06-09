// One-off destructive script. Use: `npx tsx scripts/delete-user.ts <email> [--dry-run]`
//
// FK cascades wipe sessions, matches, meeting_logs, mentor_applications,
// requests, achievements, password_reset_tokens, accounts automatically.
// monthly_feedback rows survive (matched on matchId, not userId) — they
// get orphaned then the match cascade deletes them.
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";

async function main() {
  const email = process.argv[2];
  const dry = process.argv.includes("--dry-run");
  if (!email) {
    console.error("Usage: tsx scripts/delete-user.ts <email> [--dry-run]");
    process.exit(1);
  }

  const found = await db.execute(
    sql`SELECT id, name, email, is_mentor, is_admin, created_at FROM "user" WHERE email = ${email}`
  );
  if (found.rows.length === 0) {
    console.log(`No user with email ${email}`);
    return;
  }
  console.log("Target:", found.rows[0]);
  const userId = (found.rows[0] as { id: string }).id;

  const tally = await db.execute(sql`
    SELECT
      (select count(*)::int from "match" where mentor_id = ${userId} or mentee_id = ${userId}) as matches,
      (select count(*)::int from "meeting_log" where student_id = ${userId} or mentor_id = ${userId} or mentee_id = ${userId}) as meeting_logs,
      (select count(*)::int from "request" where mentor_id = ${userId} or mentee_id = ${userId}) as requests,
      (select count(*)::int from "mentor_application" where user_id = ${userId}) as applications,
      (select count(*)::int from "achievement" where student_id = ${userId}) as achievements,
      (select count(*)::int from "session" where user_id = ${userId}) as sessions,
      (select count(*)::int from "password_reset_token" where user_id = ${userId}) as reset_tokens
  `);
  console.log("Will cascade-delete (or orphan-then-cascade):", tally.rows[0]);

  if (dry) {
    console.log("[dry-run] not deleting");
    return;
  }
  const res = await db.execute(sql`DELETE FROM "user" WHERE id = ${userId}`);
  console.log(`deleted rows: ${res.rowCount ?? "?"}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
