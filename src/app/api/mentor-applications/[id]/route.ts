import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { mentorApplications, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/session";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [app] = await db
    .select()
    .from(mentorApplications)
    .where(eq(mentorApplications.id, id))
    .limit(1);
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = parsed.data.action === "approve" ? "approved" : "rejected";
  const [updated] = await db
    .update(mentorApplications)
    .set({
      status,
      reviewedBy: admin.id,
      reviewNotes: parsed.data.notes ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(mentorApplications.id, id))
    .returning();

  if (status === "approved") {
    await db
      .update(users)
      .set({
        isMentor: true,
        mentorCapacity: app.capacity,
        mentorTopics: app.topics,
      })
      .where(eq(users.id, app.userId));
  }

  return NextResponse.json({ application: updated });
}
