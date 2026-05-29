import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { matches, monthlyFeedback } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

const fbSchema = z.object({
  matchId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2100),
  rating: z.number().int().min(1).max(5),
  answers: z.record(z.any()).optional(),
});

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = fbSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, parsed.data.matchId))
    .limit(1);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const role = match.mentorId === me.id ? "mentor" : match.menteeId === me.id ? "mentee" : null;
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [fb] = await db
    .insert(monthlyFeedback)
    .values({
      matchId: match.id,
      submittedByUserId: me.id,
      submittedByRole: role,
      month: parsed.data.month,
      year: parsed.data.year,
      rating: parsed.data.rating,
      answers: parsed.data.answers ? JSON.stringify(parsed.data.answers) : null,
    })
    .returning();

  return NextResponse.json({ feedback: fb }, { status: 201 });
}
