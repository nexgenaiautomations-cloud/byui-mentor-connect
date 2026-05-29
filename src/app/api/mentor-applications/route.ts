import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { mentorApplications } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

const applicationSchema = z.object({
  motivation: z.string().min(20).max(2000),
  topics: z.array(z.string().min(1).max(80)).min(1).max(10),
  capacity: z.number().int().min(1).max(10),
});

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (me.isAdmin) {
    const all = await db
      .select()
      .from(mentorApplications)
      .orderBy(desc(mentorApplications.submittedAt));
    return NextResponse.json({ applications: all });
  }

  const mine = await db
    .select()
    .from(mentorApplications)
    .where(eq(mentorApplications.userId, me.id))
    .orderBy(desc(mentorApplications.submittedAt));
  return NextResponse.json({ applications: mine });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = applicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Prevent duplicate submissions: one open or approved application per user.
  const existing = await db
    .select({ id: mentorApplications.id, status: mentorApplications.status })
    .from(mentorApplications)
    .where(
      and(
        eq(mentorApplications.userId, me.id),
        inArray(mentorApplications.status, ["pending", "approved"] as const)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: `You already have a ${existing[0].status} mentor application` },
      { status: 409 }
    );
  }

  const [app] = await db
    .insert(mentorApplications)
    .values({
      userId: me.id,
      motivation: parsed.data.motivation,
      topics: parsed.data.topics,
      capacity: parsed.data.capacity,
    })
    .returning();

  return NextResponse.json({ application: app }, { status: 201 });
}
