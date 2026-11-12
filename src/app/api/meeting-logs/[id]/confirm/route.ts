import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { matches, meetingLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { isInteraction } from "@/lib/engagement";

// Either participant confirms that a logged meeting/touchpoint happened.
// A meeting is "verified" once both sides have confirmed.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [log] = await db.select().from(meetingLogs).where(eq(meetingLogs.id, id)).limit(1);
  if (!log || !log.matchId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isInteraction(log.eventKind)) {
    return NextResponse.json({ error: "Only meetings and touchpoints can be confirmed" }, { status: 400 });
  }
  const [match] = await db
    .select({ mentorId: matches.mentorId, menteeId: matches.menteeId })
    .from(matches)
    .where(eq(matches.id, log.matchId))
    .limit(1);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let set: { mentorConfirmed?: boolean; menteeConfirmed?: boolean };
  if (match.mentorId === me.id) set = { mentorConfirmed: true };
  else if (match.menteeId === me.id) set = { menteeConfirmed: true };
  else return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [updated] = await db
    .update(meetingLogs)
    .set(set)
    .where(eq(meetingLogs.id, id))
    .returning({
      id: meetingLogs.id,
      mentorConfirmed: meetingLogs.mentorConfirmed,
      menteeConfirmed: meetingLogs.menteeConfirmed,
    });
  return NextResponse.json({ log: updated });
}
