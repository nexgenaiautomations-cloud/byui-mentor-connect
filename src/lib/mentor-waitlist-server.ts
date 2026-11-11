import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { membersToNotify, majorsMatch } from "@/lib/mentor-waitlist";
import { sameSchool } from "@/lib/school-scope";

const activeCount = sql<number>`(select count(*)::int from "match" where mentor_id = "user".id and status = 'active')`;

// Mentors who are accepting requests and have an open spot.
async function openMentors() {
  const rows = await db
    .select({ email: users.email, major: users.major, capacity: users.mentorCapacity, active: activeCount })
    .from(users)
    .where(and(eq(users.isMentor, true), eq(users.mentorAvailable, true), isNull(users.deactivatedAt)));
  return rows.filter((m) => (m.capacity ?? 0) > m.active);
}

// Put a member on the waitlist (no mentor had an open spot). Keeps the
// original time if they're already on it.
export async function joinMentorWaitlist(userId: string) {
  await db
    .update(users)
    .set({ mentorWaitlistedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.mentorWaitlistedAt)));
}

// Is a mentor in this member's major (same school) open right now?
export async function mentorOpenInMajor(me: { email: string; major: string | null }) {
  if (!me.major) return false;
  const open = await openMentors();
  return open.some((m) => majorsMatch(me.major, m.major) && sameSchool(me.email, m.email));
}

function appOrigin() {
  return (process.env.AUTH_URL ?? "https://byui-mentor-connect.vercel.app").replace(/\/$/, "");
}

// Email waitlisted members when a mentor in their major has an open spot.
// Best-effort: never throws, so callers can fire it after their own work.
export async function notifyWaitingMentees(now: Date = new Date()): Promise<number> {
  try {
    const open = await openMentors();
    if (open.length === 0) return 0;
    const waiting = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        major: users.major,
        waitlistedAt: users.mentorWaitlistedAt,
        notifiedAt: users.mentorWaitNotifiedAt,
      })
      .from(users)
      .where(
        and(
          isNotNull(users.mentorWaitlistedAt),
          eq(users.isMentor, false),
          eq(users.isAdmin, false),
          isNull(users.deactivatedAt),
          sql`not exists (select 1 from "match" where mentee_id = "user".id and status = 'active')`,
          sql`not exists (select 1 from "request" where mentee_id = "user".id and status = 'pending')`
        )
      );
    const due = membersToNotify(
      waiting.map((w) => ({ ...w, waitlistedAt: w.waitlistedAt as Date })),
      open,
      now
    );
    if (due.length === 0) return 0;

    const link = `${appOrigin()}/choose-mentor`;
    const sent: string[] = [];
    for (const m of due) {
      const res = await sendEmail({
        to: m.email,
        subject: "A mentor in your major is available on ICAN",
        text: [
          `Hi ${m.firstName || "there"},`,
          "",
          `A mentor in ${m.major} now has an open spot on ICAN.`,
          `Choose your mentor: ${link}`,
        ].join("\n"),
        html: `<p>Hi ${escapeHtml(m.firstName || "there")},</p>
          <p>A mentor in <strong>${escapeHtml(m.major ?? "")}</strong> now has an open spot on ICAN.</p>
          <p><a href="${escapeHtml(link)}">Choose your mentor</a></p>`,
        refId: `mentor-waitlist-${m.id}`,
      });
      if (res.ok) sent.push(m.id);
      else console.error("mentor waitlist email failed", m.id, res.error);
    }
    if (sent.length) {
      await db.update(users).set({ mentorWaitNotifiedAt: now }).where(inArray(users.id, sent));
    }
    return sent.length;
  } catch (e) {
    console.error("notifyWaitingMentees failed", e);
    return 0;
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
