// Minimal Resend wrapper. Reuses the same env vars as the magic-link auth
// flow (AUTH_RESEND_KEY, EMAIL_FROM) so there's only one transactional
// sender to keep configured.

const RESEND_KEY = process.env.AUTH_RESEND_KEY ?? "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "ICAN <noreply@icareeradvancementnetwork.com>";

// True when this environment must never deliver email (Playwright runs).
// Production builds ignore it.
export function emailDeliveryDisabled(): boolean {
  return process.env.EMAIL_TRANSPORT === "log" && process.env.NODE_ENV !== "production";
}

export type SendEmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail({
  to,
  subject,
  html,
  text,
  refId,
  replyTo,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  refId?: string;
  replyTo?: string;
  // Resend drops a repeat send with the same key for 24h, so a retry after a
  // crash between "Resend accepted it" and "we recorded it" can't duplicate.
  idempotencyKey?: string;
}): Promise<SendEmailResult> {
  // Test environments (Playwright) set EMAIL_TRANSPORT=log so nothing is
  // ever delivered. Ignored in production builds so a stray env var can't
  // silently stop real email.
  if (emailDeliveryDisabled()) {
    console.info(`[email:log] to=${to.replace(/(.).*@/, "$1***@")} subject=${JSON.stringify(subject)}`);
    return { ok: true };
  }
  if (!RESEND_KEY) {
    return { ok: false, error: "Email service is not configured (AUTH_RESEND_KEY missing)" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
      reply_to: replyTo,
      headers: refId ? { "X-Entity-Ref-ID": refId } : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend error: ${body || res.statusText}` };
  }
  return { ok: true };
}
