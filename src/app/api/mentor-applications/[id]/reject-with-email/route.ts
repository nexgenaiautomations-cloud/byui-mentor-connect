import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorApplications, users } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { buildRejectionEmail } from "@/lib/rejection-email";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminOrResp = await requireAdmin(req);
  if (adminOrResp instanceof Response) return adminOrResp;
  const admin = adminOrResp;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [app] = await db
    .select({
      id: mentorApplications.id,
      status: mentorApplications.status,
      userId: mentorApplications.userId,
      applicantEmail: users.email,
    })
    .from(mentorApplications)
    .innerJoin(users, eq(users.id, mentorApplications.userId))
    .where(eq(mentorApplications.id, id))
    .limit(1);

  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (app.status !== "pending") {
    return NextResponse.json(
      { error: `Application is already ${app.status}` },
      { status: 409 }
    );
  }

  const { html, text } = buildRejectionEmail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });

  // Send the email first. If the send fails, the application stays pending so
  // the admin can retry. We don't want to silently reject without telling the
  // applicant.
  const send = await sendEmail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    html,
    text,
    refId: `byuican-mentor-rejection-${id}`,
  });
  if (!send.ok) {
    return NextResponse.json({ error: send.error }, { status: 502 });
  }

  // Mark as rejected with TOCTOU guard so two admins reviewing in parallel
  // can't both transition the same pending row.
  const updated = await db
    .update(mentorApplications)
    .set({
      status: "rejected",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    })
    .where(and(eq(mentorApplications.id, id), eq(mentorApplications.status, "pending")))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "Application is no longer pending" },
      { status: 409 }
    );
  }

  return NextResponse.json({ application: updated[0], emailSent: true });
}
