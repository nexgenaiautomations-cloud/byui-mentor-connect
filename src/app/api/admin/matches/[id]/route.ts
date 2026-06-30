import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { matches } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
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
  const adminOrResp = await requireAdmin(req);
  if (adminOrResp instanceof Response) return adminOrResp;
  const admin = adminOrResp;
  const { id } = await params;

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

  return NextResponse.json({ match: updated[0] });
}
