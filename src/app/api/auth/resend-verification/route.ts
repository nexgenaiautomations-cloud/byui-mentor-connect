import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationEmail } from "@/lib/send-verification";
import { limitPasswordReset } from "@/lib/rate-limit";

const BYUI_DOMAIN = "@byui.edu";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
});

// Same neutral response whether the address exists, is already verified,
// or just got a fresh token — keeps signup status non-leaky.
const NEUTRAL = {
  ok: true,
  message:
    "If an unverified account exists for this email, a fresh verification link is on its way.",
};

export async function POST(req: Request) {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;

  const body = await req.json().catch(() => null);
  const parsed = body ? schema.safeParse(body) : null;
  if (!parsed || !parsed.success) {
    return NextResponse.json(NEUTRAL);
  }
  const email = parsed.data.email;
  if (!email.endsWith(BYUI_DOMAIN)) {
    return NextResponse.json(NEUTRAL);
  }

  // Reuse the password-reset rate limiter — same shape (per-email +
  // per-IP, 3/hr by email) and the same intent: don't let one form
  // hammer a single inbox.
  const rl = await limitPasswordReset(email, ip);
  if (!rl.ok) {
    return NextResponse.json(NEUTRAL);
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || user.emailVerified) {
    return NextResponse.json(NEUTRAL);
  }

  const origin = new URL(req.url).origin;
  const send = await sendVerificationEmail({ email: user.email, origin });
  if (!send.ok) {
    console.error("resend verification failed:", send.error);
  }
  return NextResponse.json(NEUTRAL);
}
