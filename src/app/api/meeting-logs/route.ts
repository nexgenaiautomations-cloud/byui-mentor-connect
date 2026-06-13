import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { matches, meetingLogs } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import {
  ALL_ACCOMPLISHMENTS,
  dominantGroup,
} from "@/lib/possible-actions";
import { evaluateAchievementsForStudent } from "@/lib/achievements";
import { maybeCreateAutoLogs } from "@/lib/auto-logs";

// One payload covers both the mentee-self-log and the mentor-on-behalf path.
// matchId optional: only the mentor path is required to pass it. The mentee
// path looks up an active match (if any) at insert time.
const logSchema = z.object({
  matchId: z.string().uuid().optional().nullable(),
  // Either `meetingDate` (legacy field name) or `activityDate` (spec wording).
  // Accept both so the form rename doesn't break older clients/tests.
  meetingDate: z.coerce.date().optional(),
  activityDate: z.coerce.date().optional(),
  meetingType: z
    .enum(["in_person", "video", "phone", "other"])
    .optional()
    .nullable(),
  durationMinutes: z.number().int().min(1).max(600).optional().nullable(),
  // Preferred new shape: list of checked accomplishment strings.
  accomplishments: z.array(z.string()).optional(),
  otherAccomplishment: z.string().max(500).optional().nullable(),
  // Legacy field — older clients posted the joined string directly.
  topicsDiscussed: z.string().max(2000).optional().nullable(),
  actionItems: z.string().max(2000).optional().nullable(),
  nextMeetingDate: z.coerce.date().optional().nullable(),
});

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: meetingLogs.id,
      matchId: meetingLogs.matchId,
      mentorId: meetingLogs.mentorId,
      menteeId: meetingLogs.menteeId,
      studentId: meetingLogs.studentId,
      createdBy: meetingLogs.createdBy,
      isSystemGenerated: meetingLogs.isSystemGenerated,
      accomplishmentGroup: meetingLogs.accomplishmentGroup,
      meetingDate: meetingLogs.meetingDate,
      meetingType: meetingLogs.meetingType,
      durationMinutes: meetingLogs.durationMinutes,
      topicsDiscussed: meetingLogs.topicsDiscussed,
      actionItems: meetingLogs.actionItems,
      nextMeetingDate: meetingLogs.nextMeetingDate,
      menteeConfirmed: meetingLogs.menteeConfirmed,
      createdAt: meetingLogs.createdAt,
    })
    .from(meetingLogs)
    .where(
      or(
        eq(meetingLogs.studentId, me.id),
        eq(meetingLogs.mentorId, me.id),
        eq(meetingLogs.menteeId, me.id)
      )
    )
    .orderBy(desc(meetingLogs.meetingDate), desc(meetingLogs.createdAt));
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
  const data = parsed.data;
  const when = data.activityDate ?? data.meetingDate;
  if (!when) {
    return NextResponse.json(
      { error: { formErrors: ["activityDate or meetingDate is required"] } },
      { status: 400 }
    );
  }

  // Build the persisted topics string. Prefer the new structured shape;
  // fall back to a raw topicsDiscussed payload for older clients.
  let topics: string;
  let group: "career_tasks" | "industry_experiences" | "career_chats" | null = null;
  if (data.accomplishments && data.accomplishments.length > 0) {
    // Reject unknown strings so logs stay queryable. "Other" is no longer a
    // valid choice on the new form, but if the client sends an otherAccomplishment
    // string we accept it appended with an "Other: " prefix for back-compat.
    const valid = data.accomplishments.filter((a) =>
      (ALL_ACCOMPLISHMENTS as readonly string[]).includes(a)
    );
    if (valid.length === 0) {
      return NextResponse.json(
        { error: { formErrors: ["No valid accomplishments selected"] } },
        { status: 400 }
      );
    }
    const parts = [...valid];
    if (data.otherAccomplishment && data.otherAccomplishment.trim()) {
      parts.push(`Other: ${data.otherAccomplishment.trim()}`);
    }
    topics = parts.join(" · ");
    group = dominantGroup(valid);
  } else if (data.topicsDiscussed && data.topicsDiscussed.trim()) {
    topics = data.topicsDiscussed.trim();
    // Try to infer the group from any embedded option strings.
    group = dominantGroup(topics.split(" · "));
  } else {
    return NextResponse.json(
      { error: { formErrors: ["At least one accomplishment is required"] } },
      { status: 400 }
    );
  }

  let studentId: string;
  let mentorId: string | null = null;
  let matchId: string | null = null;
  let createdBy: "mentee" | "mentor" | "admin";

  if (data.matchId) {
    // Mentor-on-behalf path. The mentor must own the match.
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, data.matchId))
      .limit(1);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    // Allow mentor (owner) or admin to log on behalf of the mentee.
    if (match.mentorId !== me.id && !me.isAdmin) {
      return NextResponse.json(
        { error: "Only the mentor can log activity for this match" },
        { status: 403 }
      );
    }
    studentId = match.menteeId;
    mentorId = match.mentorId;
    matchId = match.id;
    createdBy = me.isAdmin && match.mentorId !== me.id ? "admin" : "mentor";
  } else {
    // Self-log path: anyone (member, mentor, or admin) can log their own
    // activity by submitting without a matchId. The row is filed against
    // them as the student so it lands in their own Trophy Case + KPIs.
    studentId = me.id;
    createdBy = "mentee";
    // Auto-associate with the student's active match (if any) so a mentor
    // browsing their mentees still sees the log under the right thread.
    const [activeMatch] = await db
      .select()
      .from(matches)
      .where(
        and(eq(matches.menteeId, me.id), eq(matches.status, "active"))
      )
      .limit(1);
    if (activeMatch) {
      mentorId = activeMatch.mentorId;
      matchId = activeMatch.id;
    }
  }

  const [log] = await db
    .insert(meetingLogs)
    .values({
      matchId,
      mentorId,
      menteeId: studentId,
      studentId,
      createdBy,
      accomplishmentGroup: group,
      meetingDate: when,
      meetingType: data.meetingType ?? "other",
      durationMinutes: data.durationMinutes ?? null,
      topicsDiscussed: topics,
      actionItems: data.actionItems ?? null,
      nextMeetingDate: data.nextMeetingDate ?? null,
    })
    .returning();

  if (matchId) {
    await db
      .update(matches)
      .set({ lastActivityAt: new Date() })
      .where(eq(matches.id, matchId));
  }

  // Post-write side effects: evaluate achievements and possibly drop a
  // system "goal completed" auto-log. Failures here should not poison the
  // user's primary log insert — wrap in try/catch and swallow.
  let newlyEarned: { key: string; title: string; description: string }[] = [];
  let autoLogged: ("weekly" | "monthly")[] = [];
  try {
    const result = await evaluateAchievementsForStudent(studentId);
    newlyEarned = result.newlyEarned.map((a) => ({
      key: a.key,
      title: a.title,
      description: a.description,
    }));
    const auto = await maybeCreateAutoLogs(studentId);
    autoLogged = auto.created;
  } catch (e) {
    console.error("post-log side effects failed:", e);
  }

  return NextResponse.json(
    { log, newlyEarned, autoLogged },
    { status: 201 }
  );
}
