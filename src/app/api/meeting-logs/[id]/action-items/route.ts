import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { matches, meetingLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

const schema = z.object({ done: z.boolean() });

// Mark a meeting's action items done (or not). The student or their mentor
// may do this; it feeds "stalled actions" risk and ROI follow-up counts.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [log] = await db.select().from(meetingLogs).where(eq(meetingLogs.id, id)).limit(1);
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!log.actionItems || !log.actionItems.trim()) {
    return NextResponse.json({ error: "This log has no action items" }, { status: 400 });
  }

  let allowed = log.studentId === me.id;
  if (!allowed && log.matchId) {
    const [m] = await db
      .select({ mentorId: matches.mentorId })
      .from(matches)
      .where(eq(matches.id, log.matchId))
      .limit(1);
    allowed = m?.mentorId === me.id;
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [updated] = await db
    .update(meetingLogs)
    .set({ actionItemsDoneAt: parsed.data.done ? new Date() : null })
    .where(eq(meetingLogs.id, id))
    .returning({ id: meetingLogs.id, actionItemsDoneAt: meetingLogs.actionItemsDoneAt });
  return NextResponse.json({ log: updated });
}
