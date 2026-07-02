import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { matches, requests, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { isUniqueViolation } from "@/lib/db-errors";

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

  const { action } = parsed.data;

  // ---------- Cancel (mentee only) ----------
  if (action === "cancel") {
    // Single statement: TOCTOU + ownership check in the WHERE.
    const updated = await db
      .update(requests)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(
        and(
          eq(requests.id, id),
          eq(requests.menteeId, me.id),
          eq(requests.status, "pending")
        )
      )
      .returning({ id: requests.id });
    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Request not found, not yours, or no longer pending" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ---------- Accept / Decline (mentor only) ----------
  const newStatus = action === "accept" ? "accepted" : "declined";

  // Single statement: TOCTOU + ownership check + return the IDs we need next.
  const [updated] = await db
    .update(requests)
    .set({ status: newStatus, respondedAt: new Date() })
    .where(
      and(
        eq(requests.id, id),
        eq(requests.mentorId, me.id),
        eq(requests.status, "pending")
      )
    )
    .returning({
      id: requests.id,
      mentorId: requests.mentorId,
      menteeId: requests.menteeId,
    });

  if (!updated) {
    return NextResponse.json(
      { error: "Request not found, not yours, or no longer pending" },
      { status: 409 }
    );
  }

  if (newStatus !== "accepted") {
    return NextResponse.json({ ok: true });
  }

  // Parallel: read mentor capacity + check the mentee's existing matches.
  // A mentee may only ever hold ONE active match — enforced here and by the
  // partial unique index match_mentee_active_uniq (scripts/apply-security-indexes.ts),
  // so two mentors accepting the same student concurrently can't both win.
  const [mentorRow, menteeActive] = await Promise.all([
    db
      .select({ mentorCapacity: users.mentorCapacity })
      .from(users)
      .where(eq(users.id, updated.mentorId))
      .limit(1),
    db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(eq(matches.menteeId, updated.menteeId), eq(matches.status, "active"))
      )
      .limit(1),
  ]);

  const menteeAlreadyMatched = async () => {
    // The student found a mentor elsewhere while this request sat pending.
    // The request can never be accepted now — cancel it instead of leaving
    // it stuck in "accepted" with no match behind it.
    await db
      .update(requests)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(eq(requests.id, updated.id));
    return NextResponse.json(
      { error: "This student already has an active mentor" },
      { status: 409 }
    );
  };

  if (menteeActive.length > 0) return menteeAlreadyMatched();

  let newMatchId: string;
  try {
    const [ins] = await db
      .insert(matches)
      .values({
        mentorId: updated.mentorId,
        menteeId: updated.menteeId,
        requestId: updated.id,
      })
      .returning({ id: matches.id });
    newMatchId = ins.id;
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Lost the race on match_mentee_active_uniq — another mentor's accept
      // landed between our check and insert.
      return menteeAlreadyMatched();
    }
    // Unknown insert failure — revert the request so it isn't stuck accepted.
    await db
      .update(requests)
      .set({ status: "pending", respondedAt: null })
      .where(eq(requests.id, updated.id));
    throw e;
  }

  const cap = mentorRow[0]?.mentorCapacity ?? 5;

  // Re-count active matches after insert to detect a concurrent accept.
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(
      and(eq(matches.mentorId, updated.mentorId), eq(matches.status, "active"))
    );

  if (count > cap) {
    // Concurrent overrun — roll back. Sequential, request first: if we die
    // between the two statements the request is pending while the match still
    // exists, which self-heals on the next accept (the mentee-active guard
    // cancels the request). The reverse order could leave a request stuck in
    // "accepted" with no match and no recovery path.
    await db
      .update(requests)
      .set({ status: "pending", respondedAt: null })
      .where(eq(requests.id, updated.id));
    await db.delete(matches).where(eq(matches.id, newMatchId));
    return NextResponse.json(
      { error: "Mentor just hit capacity — try another mentor" },
      { status: 409 }
    );
  }

  if (count >= cap) {
    // Now exactly at capacity → stop showing in browses.
    await db
      .update(users)
      .set({ mentorAvailable: false })
      .where(eq(users.id, updated.mentorId));
  }

  return NextResponse.json({ ok: true });
}
