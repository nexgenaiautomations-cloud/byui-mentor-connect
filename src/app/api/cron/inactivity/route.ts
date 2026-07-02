import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
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
  if (!process.env.CRON_SECRET) {
    // Loud log, not just a 401 — Vercel cron retries briefly then drops the
    // invocation silently, so a missing secret would otherwise disable the
    // inactivity job with no operator-visible signal.
    console.error(
      "cron/inactivity: CRON_SECRET is not set — scheduled job cannot run"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
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

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    disconnectedCount: disconnected.length,
    disconnected: disconnected.map((d) => d.id),
    reopenedMentors: reopenedCount,
  });
}
