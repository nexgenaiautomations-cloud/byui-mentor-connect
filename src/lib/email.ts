// Minimal Resend wrapper. Reuses the same env vars as the magic-link auth
// flow (AUTH_RESEND_KEY, EMAIL_FROM) so there's only one transactional
// sender to keep configured.

const RESEND_KEY = process.env.AUTH_RESEND_KEY ?? "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "BYUI CAN Mentor Connect <noreply@byuican.com>";

export type SendEmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail({
  to,
  subject,
  html,
  text,
  refId,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  refId?: string;
}): Promise<SendEmailResult> {
  if (!RESEND_KEY) {
    return { ok: false, error: "Email service is not configured (AUTH_RESEND_KEY missing)" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
      headers: refId ? { "X-Entity-Ref-ID": refId } : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend error: ${body || res.statusText}` };
  }
  return { ok: true };
}
