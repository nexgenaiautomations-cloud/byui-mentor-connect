import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { matches, meetingLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import {
  ALL_ACCOMPLISHMENTS,
  dominantGroup,
} from "@/lib/possible-actions";
import { evaluateAchievementsForStudent } from "@/lib/achievements";

const patchSchema = z.object({
  meetingDate: z.coerce.date().optional(),
  activityDate: z.coerce.date().optional(),
  meetingType: z
    .enum(["in_person", "video", "phone", "other"])
    .optional()
    .nullable(),
  durationMinutes: z.number().int().min(1).max(600).optional().nullable(),
  accomplishments: z.array(z.string()).optional(),
  otherAccomplishment: z.string().max(500).optional().nullable(),
  actionItems: z.string().max(2000).optional().nullable(),
  nextMeetingDate: z.coerce.date().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [log] = await db
    .select()
    .from(meetingLogs)
    .where(eq(meetingLogs.id, id))
    .limit(1);
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // System logs are read-only — they're an authoritative record of when a
  // KPI threshold was crossed.
  if (log.isSystemGenerated) {
    return NextResponse.json(
      { error: "System-generated logs cannot be edited" },
      { status: 403 }
    );
  }

  // Authorization:
  //   - admin: always
  //   - mentor: if log.mentorId === me.id OR they're the active mentor for
  //     log.studentId on any match
  //   - student: if log.studentId === me.id AND createdBy === 'mentee'
  let allowed = me.isAdmin;
  if (!allowed && log.mentorId === me.id) allowed = true;
  if (!allowed && log.studentId === me.id && log.createdBy === "mentee") {
    allowed = true;
  }
  if (!allowed && log.studentId) {
    // Mentor edits for any of their current mentees.
    const [m] = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.menteeId, log.studentId),
          eq(matches.mentorId, me.id),
          eq(matches.status, "active")
        )
      )
      .limit(1);
    if (m) allowed = true;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date(), lastEditedBy: me.id };

  const when = data.activityDate ?? data.meetingDate;
  if (when) updates.meetingDate = when;
  if (data.meetingType !== undefined) updates.meetingType = data.meetingType ?? "other";
  if (data.durationMinutes !== undefined) updates.durationMinutes = data.durationMinutes;
  if (data.actionItems !== undefined) updates.actionItems = data.actionItems;
  if (data.nextMeetingDate !== undefined) updates.nextMeetingDate = data.nextMeetingDate;

  if (data.accomplishments) {
    const valid = data.accomplishments.filter((a) =>
      (ALL_ACCOMPLISHMENTS as readonly string[]).includes(a)
    );
    if (valid.length === 0) {
      return NextResponse.json(
        { error: { formErrors: ["No valid accomplishments"] } },
        { status: 400 }
      );
    }
    const parts = [...valid];
    if (data.otherAccomplishment && data.otherAccomplishment.trim()) {
      parts.push(`Other: ${data.otherAccomplishment.trim()}`);
    }
    updates.topicsDiscussed = parts.join(" · ");
    updates.accomplishmentGroup = dominantGroup(valid);
  }

  const [updated] = await db
    .update(meetingLogs)
    .set(updates)
    .where(eq(meetingLogs.id, id))
    .returning();

  // Re-evaluate achievements — edits can change earned state (e.g. swapping
  // a tasks log for a chats log). Failure is non-fatal.
  if (updated.studentId) {
    try {
      await evaluateAchievementsForStudent(updated.studentId);
    } catch (e) {
      console.error("achievement re-evaluation failed:", e);
    }
  }

  return NextResponse.json({ log: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [log] = await db
    .select()
    .from(meetingLogs)
    .where(eq(meetingLogs.id, id))
    .limit(1);
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (log.isSystemGenerated) {
    return NextResponse.json(
      { error: "System logs cannot be deleted via this endpoint" },
      { status: 403 }
    );
  }

  const allowed =
    me.isAdmin ||
    log.mentorId === me.id ||
    (log.studentId === me.id && log.createdBy === "mentee");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(meetingLogs).where(eq(meetingLogs.id, id));
  return NextResponse.json({ ok: true });
}
