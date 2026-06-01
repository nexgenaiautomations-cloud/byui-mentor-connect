import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { matches, requests, users } from "@/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

const requestSchema = z.object({
  mentorId: z.string().min(1),
  message: z.string().max(1000).optional().nullable(),
});

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(requests)
    .where(or(eq(requests.mentorId, me.id), eq(requests.menteeId, me.id)));
  return NextResponse.json({ requests: rows });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Mentors don't request other mentors.
  if (me.isMentor) {
    return NextResponse.json({ error: "Mentors cannot request mentors" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.mentorId === me.id) {
    return NextResponse.json({ error: "Cannot request yourself" }, { status: 400 });
  }

  const [mentor] = await db.select().from(users).where(eq(users.id, parsed.data.mentorId)).limit(1);
  if (!mentor || !mentor.isMentor) {
    return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
  }

  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(requests)
    .where(
      and(
        eq(requests.mentorId, mentor.id),
        eq(requests.menteeId, me.id),
        eq(requests.status, "pending")
      )
    );
  if (existing && existing.count > 0) {
    return NextResponse.json({ error: "Already requested" }, { status: 409 });
  }

  const [created] = await db
    .insert(requests)
    .values({
      mentorId: mentor.id,
      menteeId: me.id,
      message: parsed.data.message ?? null,
    })
    .returning();

  return NextResponse.json({ request: created }, { status: 201 });
}
