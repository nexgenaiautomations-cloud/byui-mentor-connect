import { notifyWaitingMentees } from "@/lib/mentor-waitlist-server";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { matches } from "@/db/schema";
import { crossSchoolDenied, emailForUser, requireAdminScope } from "@/lib/admin-scope-server";
import { emailInScopeJs } from "@/lib/admin-scope";
import { auditEvent } from "@/lib/audit";

// DELETE /api/admin/matches/[id]
// Breaks an active match: transitions status to "cancelled" and stamps
// endedAt. We keep the row so historical analytics, meeting logs, and
// feedback continue to resolve. TOCTOU guard ensures we only transition
// from "active" — concurrent calls from two admins won't double-end.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminScope(req);
  if (auth instanceof Response) return auth;
  const { admin, scope } = auth;
  const { id } = await params;

  const [existing] = await db
    .select({ menteeId: matches.menteeId })
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Match not found or no longer active" }, { status: 409 });
  if (!emailInScopeJs(await emailForUser(existing.menteeId), scope)) {
    return crossSchoolDenied(admin, req, { route: "admin/matches", matchId: id });
  }

  const updated = await db
    .update(matches)
    .set({ status: "cancelled", endedAt: new Date() })
    .where(and(eq(matches.id, id), eq(matches.status, "active")))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "Match not found or no longer active" },
      { status: 409 }
    );
  }

  await auditEvent({
    actorUserId: admin.id,
    targetUserId: updated[0].menteeId,
    eventType: "ADMIN_REMOVED_MATCH",
    severity: "warning",
    request: req,
    metadata: { matchId: updated[0].id, mentorId: updated[0].mentorId },
  });

  // The mentor now has a free spot for someone on the waitlist.
  await notifyWaitingMentees();

  return NextResponse.json({ match: updated[0] });
}
