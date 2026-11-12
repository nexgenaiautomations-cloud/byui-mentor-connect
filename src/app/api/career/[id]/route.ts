import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { careerMilestones } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

// A student may remove an update they reported themselves. Milestones that
// came from an activity log are removed by editing/deleting that log, and
// verified milestones are kept.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const deleted = await db
    .delete(careerMilestones)
    .where(
      and(
        eq(careerMilestones.id, id),
        eq(careerMilestones.studentId, me.id),
        eq(careerMilestones.source, "self_reported"),
        eq(careerMilestones.verification, "self_reported")
      )
    )
    .returning({ id: careerMilestones.id });
  if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Acceptances that pointed at this offer stop pointing at it, so they count
  // as their own (implied) offer instead of vanishing from reports.
  await db
    .update(careerMilestones)
    .set({ relatedMilestoneId: null })
    .where(eq(careerMilestones.relatedMilestoneId, id));
  return NextResponse.json({ ok: true });
}
