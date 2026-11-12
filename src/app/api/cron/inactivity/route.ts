import { notifyWaitingMentees } from "@/lib/mentor-waitlist-server";
import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { db } from "@/db/client";
import { matches, users } from "@/db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { INACTIVITY_DISCONNECT_DAYS } from "@/lib/possible-actions";

// Daily job: auto-disconnect matches with no activity for 180+ days, and
// flip mentor.mentorAvailable back to true when capacity opens up again.
// Protected by CRON_SECRET — Vercel adds Authorization: Bearer $CRON_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req, "inactivity")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INACTIVITY_DISCONNECT_DAYS);

  // 1) Auto-disconnect inactive matches. We mark with 'cancelled' since the
  //    schema has no 'inactive' state — the endedAt timestamp distinguishes
  //    auto-cancellations from voluntary ones in reporting.
  const disconnected = await db
    .update(matches)
    .set({ status: "cancelled", endedAt: new Date() })
    .where(and(eq(matches.status, "active"), lt(matches.lastActivityAt, cutoff)))
    .returning({ id: matches.id, mentorId: matches.mentorId });

  // 2) Self-heal availability: any mentor who's currently flagged as
  //    unavailable but now has open slots gets flipped back on.
  let reopenedCount = 0;
  if (disconnected.length > 0) {
    const affectedMentorIds = [...new Set(disconnected.map((d) => d.mentorId))];
    const reopened = await db
      .update(users)
      .set({ mentorAvailable: true })
      .where(
        and(
          eq(users.mentorAvailable, false),
          eq(users.isMentor, true),
          sql`${users.id} IN (${sql.join(affectedMentorIds.map((id) => sql`${id}`), sql.raw(","))})`,
          sql`(SELECT count(*)::int FROM ${matches} WHERE ${matches.mentorId} = ${users.id} AND ${matches.status} = 'active') < ${users.mentorCapacity}`
        )
      )
      .returning({ id: users.id });
    reopenedCount = reopened.length;
  }

  // 3) Daily catch-all for the mentor waitlist: email members when a mentor
  //    in their major has an open spot (throttled to once a week each).
  const waitlistNotified = await notifyWaitingMentees();

  return NextResponse.json({
    ok: true,
    waitlistNotified,
    cutoff: cutoff.toISOString(),
    disconnectedCount: disconnected.length,
    disconnected: disconnected.map((d) => d.id),
    reopenedMentors: reopenedCount,
  });
}
