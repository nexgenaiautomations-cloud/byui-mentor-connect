import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { matches, requests, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

const responseSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [r] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action } = parsed.data;

  // ---------- Cancel (mentee only) ----------
  if (action === "cancel") {
    if (r.menteeId !== me.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Only transition from pending → cancelled. The WHERE clause guards TOCTOU:
    // if another flow has already accepted/declined, RETURNING yields nothing.
    const updated = await db
      .update(requests)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(and(eq(requests.id, id), eq(requests.status, "pending")))
      .returning();
    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Request is no longer pending" },
        { status: 409 }
      );
    }
    return NextResponse.json({ request: updated[0] });
  }

  // ---------- Accept / Decline (mentor only) ----------
  if (r.mentorId !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";
  const updated = await db
    .update(requests)
    .set({ status: newStatus, respondedAt: new Date() })
    .where(and(eq(requests.id, id), eq(requests.status, "pending")))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "Request is no longer pending" },
      { status: 409 }
    );
  }

  if (newStatus === "accepted") {
    // Insert the match.
    const [newMatch] = await db
      .insert(matches)
      .values({
        mentorId: r.mentorId,
        menteeId: r.menteeId,
        requestId: r.id,
      })
      .returning();

    // Detect capacity overrun: if a concurrent accept also inserted, total
    // active matches may now exceed the mentor's capacity. Roll back ours.
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(eq(matches.mentorId, r.mentorId), eq(matches.status, "active")));

    const [mentor] = await db
      .select()
      .from(users)
      .where(eq(users.id, r.mentorId))
      .limit(1);
    const cap = mentor?.mentorCapacity ?? 5;

    if (count > cap) {
      // Roll back: delete our match and revert request to pending.
      await db.delete(matches).where(eq(matches.id, newMatch.id));
      await db
        .update(requests)
        .set({ status: "pending", respondedAt: null })
        .where(eq(requests.id, id));
      return NextResponse.json(
        { error: "Mentor reached capacity — try again or pick another mentor" },
        { status: 409 }
      );
    }

    // At capacity (not over) → flip mentorAvailable off so they stop appearing
    // in new browses.
    if (count >= cap) {
      await db
        .update(users)
        .set({ mentorAvailable: false })
        .where(eq(users.id, r.mentorId));
    }
  }

  return NextResponse.json({ request: updated[0] });
}
