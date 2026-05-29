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

  if (action === "cancel") {
    if (r.menteeId !== me.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [updated] = await db
      .update(requests)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(eq(requests.id, id))
      .returning();
    return NextResponse.json({ request: updated });
  }

  if (r.mentorId !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = action === "accept" ? "accepted" : "declined";
  const [updated] = await db
    .update(requests)
    .set({ status, respondedAt: new Date() })
    .where(eq(requests.id, id))
    .returning();

  if (status === "accepted") {
    await db.insert(matches).values({
      mentorId: r.mentorId,
      menteeId: r.menteeId,
      requestId: r.id,
    });

    // Enforce capacity — if mentor now at capacity, flip mentorAvailable off.
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(eq(matches.mentorId, r.mentorId), eq(matches.status, "active")));

    const [mentor] = await db.select().from(users).where(eq(users.id, r.mentorId)).limit(1);
    if (mentor && mentor.mentorCapacity && count >= mentor.mentorCapacity) {
      await db.update(users).set({ mentorAvailable: false }).where(eq(users.id, r.mentorId));
    }
  }

  return NextResponse.json({ request: updated });
}
