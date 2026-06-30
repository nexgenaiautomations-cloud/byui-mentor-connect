// One-off destructive cleanup. Deletes every user EXCEPT the canonical
// program accounts (Harrelld and the three named students). All other
// rows in the system came from the prior demo dataset and are wiped via
// cascade.
//
// Run:
//   npx tsx scripts/cleanup-accounts.ts            # dry-run summary
//   npx tsx scripts/cleanup-accounts.ts --apply    # actually delete
//
// FK cascade behavior on the user table:
//   accounts, sessions, mentor_applications, requests, matches,
//   password_reset_tokens, achievements → cascade
//   meeting_log.{mentor,mentee,student}_id → NO cascade
//   monthly_feedback.submitted_by_user_id → NO cascade
// So we delete those two tables' offending rows first, then delete the
// users (which cascades the rest).
import { config as loadEnv } from "dotenv";
// Pull DATABASE_URL from .env.local (Next.js's primary env file) before
// importing the db client. ES imports hoist, so the db client must be
// dynamically imported after the env is loaded.
loadEnv({ path: ".env.local" });
loadEnv();
import { sql } from "drizzle-orm";

type DbModule = typeof import("../src/db/client");
let db!: DbModule["db"];

const KEEP_EMAILS = [
  "harrelld@byui.edu",
  "fra25004@byui.edu",
  "gub20004@byui.edu",
  "cic21001@byui.edu",
] as const;

async function main() {
  const apply = process.argv.includes("--apply");
  ({ db } = await import("../src/db/client"));

  const keepRows = await db.execute(sql`
    SELECT id, email, is_admin, is_head_admin, is_mentor
    FROM "user"
    WHERE lower(email) IN (${sql.join(
      KEEP_EMAILS.map((e) => sql`${e.toLowerCase()}`),
      sql`, `
    )})
  `);
  const keepIds = keepRows.rows.map((r) => (r as { id: string }).id);
  const foundEmails = new Set(
    keepRows.rows.map((r) => (r as { email: string }).email.toLowerCase())
  );

  console.log("Keep list:");
  for (const e of KEEP_EMAILS) {
    const present = foundEmails.has(e);
    console.log(`  ${present ? "✓" : "✗"} ${e}`);
  }
  if (!foundEmails.has("harrelld@byui.edu")) {
    console.error(
      "\nAborting: harrelld@byui.edu is not in the database. The head admin must exist before wiping everyone else."
    );
    process.exit(1);
  }
  if (keepIds.length === 0) {
    console.error("Aborting: no keep-emails matched the database.");
    process.exit(1);
  }

  const keepList = sql.join(
    keepIds.map((id) => sql`${id}`),
    sql`, `
  );

  const tally = await db.execute(sql`
    SELECT
      (select count(*)::int from "user" where id NOT IN (${keepList})) as users,
      (select count(*)::int from "match"
        where mentor_id NOT IN (${keepList}) OR mentee_id NOT IN (${keepList})) as matches,
      (select count(*)::int from "request"
        where mentor_id NOT IN (${keepList}) OR mentee_id NOT IN (${keepList})) as requests,
      (select count(*)::int from "meeting_log"
        where coalesce(mentor_id, '') NOT IN ('', ${keepList})
           OR coalesce(mentee_id, '') NOT IN ('', ${keepList})
           OR coalesce(student_id, '') NOT IN ('', ${keepList})) as meeting_logs,
      (select count(*)::int from "monthly_feedback"
        where submitted_by_user_id NOT IN (${keepList})) as monthly_feedback,
      (select count(*)::int from "mentor_application"
        where user_id NOT IN (${keepList})) as applications,
      (select count(*)::int from "achievement"
        where student_id NOT IN (${keepList})) as achievements,
      (select count(*)::int from "issue_report"
        where user_id IS NOT NULL AND user_id NOT IN (${keepList})) as issue_reports
  `);
  console.log("\nWill delete (or null-out for issue_report):");
  console.log(tally.rows[0]);

  if (!apply) {
    console.log("\n[dry-run] pass --apply to execute.");
    return;
  }

  // Order: drop the non-cascading rows first, then delete users (which
  // cascades sessions, accounts, requests, matches, applications,
  // achievements, password_reset_tokens via FK).
  console.log("\nDeleting non-cascading rows that reference deleted users…");
  const mf = await db.execute(sql`
    DELETE FROM "monthly_feedback"
    WHERE submitted_by_user_id NOT IN (${keepList})
  `);
  console.log(`  monthly_feedback: ${mf.rowCount ?? "?"}`);

  const ml = await db.execute(sql`
    DELETE FROM "meeting_log"
    WHERE coalesce(mentor_id, '') NOT IN ('', ${keepList})
       OR coalesce(mentee_id, '') NOT IN ('', ${keepList})
       OR coalesce(student_id, '') NOT IN ('', ${keepList})
  `);
  console.log(`  meeting_log:      ${ml.rowCount ?? "?"}`);

  // Null out non-cascading references that survive on rows owned by the
  // keep-list users. mentor_application.reviewed_by has no cascade, so
  // applications still owned by a keep user but reviewed by an outgoing
  // admin would block the user delete. Same shape for meeting_log
  // .last_edited_by on any logs we didn't already remove above.
  console.log("\nClearing orphan references on retained rows…");
  const a = await db.execute(sql`
    UPDATE "mentor_application"
    SET reviewed_by = NULL
    WHERE reviewed_by IS NOT NULL AND reviewed_by NOT IN (${keepList})
  `);
  console.log(`  mentor_application.reviewed_by → NULL: ${a.rowCount ?? "?"}`);

  const le = await db.execute(sql`
    UPDATE "meeting_log"
    SET last_edited_by = NULL
    WHERE last_edited_by IS NOT NULL AND last_edited_by NOT IN (${keepList})
  `);
  console.log(`  meeting_log.last_edited_by → NULL:     ${le.rowCount ?? "?"}`);

  console.log("\nDeleting users (cascades sessions/accounts/matches/etc.)…");
  const u = await db.execute(sql`
    DELETE FROM "user" WHERE id NOT IN (${keepList})
  `);
  console.log(`  user:             ${u.rowCount ?? "?"}`);

  // Audit the bulk cleanup. One row covers the whole batch — we record the
  // counts (not individual user IDs), since those rows are gone and
  // auditing N IDs would balloon the table.
  const { auditEvent } = await import("../src/lib/audit");
  await auditEvent({
    eventType: "ADMIN_CLEANED_USER_DATA",
    severity: "critical",
    metadata: {
      script: "scripts/cleanup-accounts.ts",
      users_deleted: u.rowCount ?? 0,
      meeting_logs_deleted: ml.rowCount ?? 0,
      monthly_feedback_deleted: mf.rowCount ?? 0,
      retained_emails: [...KEEP_EMAILS],
    },
  });

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
