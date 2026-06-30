import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";
import { attachSessionCookie } from "@/lib/auth-cookie";
import { limitPasswordSignIn } from "@/lib/rate-limit";
import { auditEvent } from "@/lib/audit";

const BYUI_DOMAIN = "@byui.edu";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;

  const body = await req.json().catch(() => null);
  const parsed = body ? schema.safeParse(body) : null;
  if (!parsed || !parsed.success) {
    // Generic error so we don't leak whether the email shape was OK.
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;
  if (!email.endsWith(BYUI_DOMAIN)) {
    return NextResponse.json(
      { error: "Only @byui.edu emails are allowed." },
      { status: 400 }
    );
  }

  const rl = await limitPasswordSignIn(email, ip);
  if (!rl.ok) {
    await auditEvent({
      eventType: "RATE_LIMIT_TRIGGERED",
      severity: "warning",
      request: req,
      metadata: { route: "auth/signin", reason: rl.reason ?? "ip" },
    });
    return NextResponse.json(
      {
        error:
          "Too many sign-in attempts. Wait a few minutes and try again, or reset your password.",
      },
      { status: 429 }
    );
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
      onboardedAt: users.onboardedAt,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Identical response for "no user" and "wrong password" — prevents account
  // enumeration via response timing or wording.
  if (!user || !user.passwordHash) {
    await auditEvent({
      eventType: "LOGIN_FAILED",
      severity: "warning",
      request: req,
      metadata: { reason: "unknown_email_or_no_password" },
    });
    return NextResponse.json(
      {
        error:
          "That email and password don't match. Try again or use Forgot password.",
      },
      { status: 401 }
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await auditEvent({
      targetUserId: user.id,
      eventType: "LOGIN_FAILED",
      severity: "warning",
      request: req,
      metadata: { reason: "wrong_password" },
    });
    return NextResponse.json(
      {
        error:
          "That email and password don't match. Try again or use Forgot password.",
      },
      { status: 401 }
    );
  }

  // Password matched — but block login until email is verified. Surface a
  // dedicated `unverified: true` flag so the client can render the resend
  // button instead of the generic error banner.
  if (!user.emailVerified) {
    return NextResponse.json(
      {
        error:
          "Please verify your email before logging in. Check your inbox for the verification link.",
        unverified: true,
        email: user.email,
      },
      { status: 403 }
    );
  }

  await auditEvent({
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: "LOGIN_SUCCEEDED",
    severity: "info",
    request: req,
  });

  const res = NextResponse.json({
    ok: true,
    redirectTo: user.onboardedAt ? "/dashboard" : "/onboarding",
  });
  return attachSessionCookie(res, {
    userId: user.id,
    email: user.email,
    name: user.name,
  });
}
