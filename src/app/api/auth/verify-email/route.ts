import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { consumeVerifyToken } from "@/lib/email-verification";
import { auditEvent } from "@/lib/audit";

// Verification link the user clicks in their inbox. Single-use, expires
// after VERIFY_TOKEN_TTL_MS. Lands the user on the login page with a
// status query param so the form can show the right banner.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const email = url.searchParams.get("email") ?? "";
  const origin = url.origin;

  if (!token || !email) {
    return NextResponse.redirect(`${origin}/login?verify=invalid`);
  }

  const result = await consumeVerifyToken(email, token);
  if (!result.ok) {
    if (result.reason === "expired") {
      return NextResponse.redirect(`${origin}/login?verify=expired&email=${encodeURIComponent(email)}`);
    }
    return NextResponse.redirect(`${origin}/login?verify=invalid&email=${encodeURIComponent(email)}`);
  }

  // Resolve the user id for the audit row. Best-effort — if the lookup
  // fails for any reason we still complete the verification redirect.
  const [verified] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, result.email))
    .limit(1);
  await auditEvent({
    actorUserId: verified?.id ?? null,
    targetUserId: verified?.id ?? null,
    eventType: "USER_EMAIL_VERIFIED",
    severity: "info",
    request: req,
  });

  return NextResponse.redirect(
    `${origin}/login?verify=ok&email=${encodeURIComponent(result.email)}`
  );
}
