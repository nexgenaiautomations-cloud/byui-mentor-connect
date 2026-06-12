// Glue between the verification-token store and the Resend send helper.
// Lives in its own file so both the signup route and the resend endpoint
// can call it without duplicating the email construction.
import { issueVerifyToken, VERIFY_TOKEN_TTL_MS } from "./email-verification";
import { buildVerifyEmail } from "./verification-email";

const TTL_HOURS = Math.round(VERIFY_TOKEN_TTL_MS / (60 * 60 * 1000));

export async function sendVerificationEmail({
  email,
  origin,
}: {
  email: string;
  origin: string;
}): Promise<{ ok: boolean; sent: boolean; error?: string }> {
  const rawToken = await issueVerifyToken(email);
  const verifyUrl = `${origin}/api/auth/verify-email?token=${encodeURIComponent(
    rawToken
  )}&email=${encodeURIComponent(email)}`;

  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    // Dev convenience: surface the link in the server log so testers can
    // click through without configuring Resend.
    console.log("[dev] email verification link:", verifyUrl);
    return { ok: true, sent: false };
  }

  const { subject, html, text } = buildVerifyEmail({
    url: verifyUrl,
    email,
    expiresHours: TTL_HOURS,
  });
  const from = process.env.EMAIL_FROM ?? "BYUI CAN <noreply@byuican.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject,
        html,
        text,
        headers: { "X-Entity-Ref-ID": "byuican-verify-email" },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, sent: false, error: body || res.statusText };
    }
    return { ok: true, sent: true };
  } catch (e) {
    return {
      ok: false,
      sent: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}
