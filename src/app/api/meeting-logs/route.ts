import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { matches, meetingLogs } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { sql } from "drizzle-orm";

const logSchema = z.object({
  matchId: z.string().uuid(),
  meetingDate: z.coerce.date(),
  meetingType: z.enum(["in_person", "video", "phone", "other"]),
  durationMinutes: z.number().int().min(1).max(600).optional().nullable(),
  topicsDiscussed: z.string().max(2000).optional().nullable(),
  actionItems: z.string().max(2000).optional().nullable(),
  nextMeetingDate: z.coerce.date().optional().nullable(),
  mentorNotes: z.string().max(4000).optional().nullable(),
});

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Mentors see their own notes; mentees never see mentorNotes — project the
  // field only when the viewer is the mentor on that log.
  const rows = await db
    .select({
      id: meetingLogs.id,
      matchId: meetingLogs.matchId,
      mentorId: meetingLogs.mentorId,
      menteeId: meetingLogs.menteeId,
      meetingDate: meetingLogs.meetingDate,
      meetingType: meetingLogs.meetingType,
      durationMinutes: meetingLogs.durationMinutes,
      topicsDiscussed: meetingLogs.topicsDiscussed,
      actionItems: meetingLogs.actionItems,
      nextMeetingDate: meetingLogs.nextMeetingDate,
      menteeConfirmed: meetingLogs.menteeConfirmed,
      createdAt: meetingLogs.createdAt,
      // Conditional projection: NULL when viewer is the mentee.
      mentorNotes: sql<string | null>`CASE WHEN ${meetingLogs.mentorId} = ${me.id} THEN ${meetingLogs.mentorNotes} ELSE NULL END`,
    })
    .from(meetingLogs)
    .where(or(eq(meetingLogs.mentorId, me.id), eq(meetingLogs.menteeId, me.id)));
  return NextResponse.json({ logs: rows });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, parsed.data.matchId))
    .limit(1);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.mentorId !== me.id) {
    return NextResponse.json({ error: "Only the mentor can log meetings" }, { status: 403 });
  }

  const [log] = await db
    .insert(meetingLogs)
    .values({
      matchId: match.id,
      mentorId: match.mentorId,
      menteeId: match.menteeId,
      meetingDate: parsed.data.meetingDate,
      meetingType: parsed.data.meetingType,
      durationMinutes: parsed.data.durationMinutes ?? null,
      topicsDiscussed: parsed.data.topicsDiscussed ?? null,
      actionItems: parsed.data.actionItems ?? null,
      nextMeetingDate: parsed.data.nextMeetingDate ?? null,
      mentorNotes: parsed.data.mentorNotes ?? null,
    })
    .returning();

  await db
    .update(matches)
    .set({ lastActivityAt: new Date() })
    .where(eq(matches.id, match.id));

  return NextResponse.json({ log }, { status: 201 });
}
