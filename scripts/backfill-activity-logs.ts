// One-off backfill for meeting_log rows created before the mentee-first
// activity-logging model landed. Idempotent: safe to run multiple times.
//
// Run with: `npx tsx scripts/backfill-activity-logs.ts`
//
// What it does:
// 1. Copies mentee_id into student_id where student_id is null. Existing rows
//    were all authored by the mentor for a specific mentee, so the mentee
//    *is* the student.
// 2. Sets created_by to "mentor" where it's null. Old rows had no concept of
//    authorship — but only mentors could create them.
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";

async function main() {
  const studentResult = await db.execute(sql`
    UPDATE meeting_log
    SET student_id = mentee_id
    WHERE student_id IS NULL AND mentee_id IS NOT NULL
  `);
  const createdByResult = await db.execute(sql`
    UPDATE meeting_log
    SET created_by = 'mentor'
    WHERE created_by IS NULL
  `);
  // Reports row counts so the dev knows the migration actually moved data.
  console.log("backfilled student_id rows:", studentResult.rowCount ?? "?");
  console.log("backfilled created_by rows:", createdByResult.rowCount ?? "?");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
