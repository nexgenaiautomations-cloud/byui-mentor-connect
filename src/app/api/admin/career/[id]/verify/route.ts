import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { careerMilestones, users } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { adminScopeFor, schoolInScope } from "@/lib/admin-scope";
import { schoolOf } from "@/lib/school-scope";
import { auditEvent } from "@/lib/audit";

const schema = z.object({ verified: z.boolean() });

// Mark a reported outcome verified (e.g. confirmed with the employer or the
// career center). Reports always keep self-reported and verified apart.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const scope = adminScopeFor(admin)!;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const [row] = await db
    .select({ id: careerMilestones.id, studentId: careerMilestones.studentId, email: users.email })
    .from(careerMilestones)
    .innerJoin(users, eq(users.id, careerMilestones.studentId))
    .where(eq(careerMilestones.id, id))
    .limit(1);
  // Out-of-school rows look exactly like missing rows.
  if (!row || !schoolInScope(schoolOf(row.email), scope)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const verified = parsed.data.verified;
  await db
    .update(careerMilestones)
    .set({
      verification: verified ? "verified" : "self_reported",
      verifiedById: verified ? admin.id : null,
      verifiedAt: verified ? new Date() : null,
    })
    .where(eq(careerMilestones.id, id));
  void auditEvent({
    actorUserId: admin.id,
    targetUserId: row.studentId,
    eventType: "ADMIN_VERIFIED_CAREER_MILESTONE",
    request: req,
    metadata: { milestoneId: id, verified },
  });
  return NextResponse.json({ ok: true });
}
