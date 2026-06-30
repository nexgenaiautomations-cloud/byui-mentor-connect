import { NextResponse } from "next/server";
import { z } from "zod";
import { passwordIssues } from "@/lib/password";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { auditEvent } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(16).max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = body ? schema.safeParse(body) : null;
  if (!parsed || !parsed.success) {
    return NextResponse.json(
      { error: "Invalid reset link or password" },
      { status: 400 }
    );
  }
  const { token, password } = parsed.data;

  const pwIssues = passwordIssues(password);
  if (pwIssues.length) {
    return NextResponse.json({ error: pwIssues[0] }, { status: 400 });
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.ok) {
    const msg =
      result.reason === "expired"
        ? "This reset link has expired. Request a new one."
        : "This reset link is invalid or already used. Request a new one.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Audit the completion, then bounce the user to /login with a banner.
  // We intentionally do NOT attach a session cookie here: a reset link in
  // the wrong hands would otherwise be equivalent to a logged-in session.
  // Requiring re-authentication with the new password forces the user
  // through rate-limit gates and gives any anomaly signals one more
  // chance to fire.
  await auditEvent({
    actorUserId: result.userId,
    targetUserId: result.userId,
    eventType: "PASSWORD_RESET_COMPLETED",
    severity: "info",
    request: req,
  });
  return NextResponse.json({
    ok: true,
    redirectTo: "/login?reset=ok",
  });
}
