import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db/client";
import { matches } from "@/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { INACTIVITY_DISCONNECT_DAYS } from "@/lib/possible-actions";

// Daily job: auto-disconnect matches with no activity for 180+ days.
// Protected by CRON_SECRET — Vercel adds Authorization: Bearer $CRON_SECRET
// when triggering scheduled runs (see vercel.json).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Verify the request came from Vercel Cron (or someone with the secret).
  // Constant-time compare to avoid leaking the secret via response timing.
  if (!process.env.CRON_SECRET) {
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

  const result = await db
    .update(matches)
    .set({ status: "cancelled", endedAt: new Date() })
    .where(and(eq(matches.status, "active"), lt(matches.lastActivityAt, cutoff)))
    .returning({ id: matches.id });

  return NextResponse.json({
    ok: true,
    cutoff: cutoff.toISOString(),
    disconnectedCount: result.length,
    disconnected: result.map((r) => r.id),
  });
}
