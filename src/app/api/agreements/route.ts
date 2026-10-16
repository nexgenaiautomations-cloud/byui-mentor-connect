import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { agreementSchema } from "@/lib/agreements";
import { TERMS_VERSION } from "@/lib/disclaimers";
import { auditEvent } from "@/lib/audit";

// Records the user's acknowledgment of the ICAN disclaimers (independent
// site, optional use, own risk, Terms + Privacy) for the current
// TERMS_VERSION. Every box must be checked; the server re-validates.
export async function POST(req: Request) {
  const result = await requireUser();
  if (result instanceof Response) return result;
  const me = result;

  const body = await req.json().catch(() => null);
  const parsed = agreementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check every box to continue." },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ termsAcceptedVersion: TERMS_VERSION, termsAcceptedAt: new Date() })
    .where(eq(users.id, me.id));

  await auditEvent({
    actorUserId: me.id,
    targetUserId: me.id,
    eventType: "USER_ACCEPTED_TERMS",
    severity: "info",
    request: req,
    metadata: { termsVersion: TERMS_VERSION },
  });

  return NextResponse.json({ ok: true, redirectTo: me.onboardedAt ? "/dashboard" : "/onboarding" });
}
