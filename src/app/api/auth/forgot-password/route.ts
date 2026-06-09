import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { issueResetToken, RESET_TOKEN_TTL_MS } from "@/lib/password-reset";
import { limitPasswordReset } from "@/lib/rate-limit";
import { buildResetPasswordEmail } from "@/lib/reset-password-email";

const BYUI_DOMAIN = "@byui.edu";
const TTL_MIN = Math.round(RESET_TOKEN_TTL_MS / 60000);

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
});

export async function POST(req: Request) {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;

  const body = await req.json().catch(() => null);
  const parsed = body ? schema.safeParse(body) : null;
  // The response below intentionally doesn't tell the caller whether the
  // email was valid — prevents enumeration. We do still bail on a missing
  // body to surface obvious client bugs.
  if (!parsed) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for this email, we just sent you a reset link.",
    });
  }

  const email = parsed.data.email;

  // Only @byui.edu accounts exist — block other emails up front to save
  // both the DB lookup and a Resend send.
  if (!email.endsWith(BYUI_DOMAIN)) {
    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for this email, we just sent you a reset link.",
    });
  }

  const rl = await limitPasswordReset(email, ip);
  if (!rl.ok) {
    // Same neutral message — don't differentiate rate-limited vs not found.
    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for this email, we just sent you a reset link.",
    });
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // No user? Silently succeed — never leak enumeration.
  if (!user) {
    return NextResponse.json({
      ok: true,
      message:
        "If an account exists for this email, we just sent you a reset link.",
    });
  }

  const rawToken = await issueResetToken(user.id);
  const origin = new URL(req.url).origin;
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;

  // Send email — non-fatal if it fails. The token is already stored; the user
  // can hit "Resend" or contact support. We don't surface the failure to the
  // caller (would also leak enumeration).
  try {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (apiKey) {
      const { subject, html, text } = buildResetPasswordEmail({
        url: resetUrl,
        email: user.email,
        host: new URL(req.url).host,
        expiresMinutes: TTL_MIN,
      });
      const from =
        process.env.EMAIL_FROM ?? "BYUI CAN <noreply@byuican.com>";
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: user.email,
          subject,
          html,
          text,
          headers: { "X-Entity-Ref-ID": "byuican-password-reset" },
        }),
      });
    } else {
      // Dev convenience: log the link so a tester can click it without Resend.
      console.log("[dev] password reset link:", resetUrl);
    }
  } catch (e) {
    console.error("password reset email failed:", e);
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for this email, we just sent you a reset link.",
  });
}
