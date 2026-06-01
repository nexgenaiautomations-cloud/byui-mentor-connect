// Branded magic-link email for BYUI CAN Mentor Connect. Returns the HTML
// body, plain-text fallback, and subject. Inlined styles so it renders the
// same in Gmail, Outlook, BYU-I's Microsoft tenant, and Apple Mail.

const BRAND_BLUE = "#006EB6";
const BRAND_DARK = "#214491";
const BRAND_LIGHT = "#A0D4ED";
const BRAND_TEXT = "#0f172a";
const BRAND_MUTED = "#5d6b85";
const BRAND_BORDER = "#e2e8f0";

const LOGO_URL = "https://www.byuican.com/byuican-icon.png";

export function buildMagicLinkEmail({
  url,
  email,
  host,
  expiresMinutes,
}: {
  url: string;
  email: string;
  host: string;
  expiresMinutes: number;
}) {
  const subject = "Your BYUI CAN sign-in link";
  const preheader = `Click the button to sign in to BYUI CAN Mentor Connect. Link expires in ${expiresMinutes} minutes.`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_TEXT};">
    <div style="display:none;font-size:1px;color:#f3f6fb;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f6fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND_BORDER};">

            <!-- Header band -->
            <tr>
              <td style="background:${BRAND_DARK};padding:24px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${LOGO_URL}" width="44" height="44" alt="BYUI CAN"
                        style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none;border-radius:8px;background:#ffffff;" />
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <div style="font-size:14px;font-weight:800;color:#ffffff;letter-spacing:0.2px;line-height:1.1;">BYUI CAN</div>
                      <div style="font-size:11px;font-weight:600;color:${BRAND_LIGHT};letter-spacing:0.6px;text-transform:uppercase;line-height:1.1;margin-top:2px;">Career Advancement Network</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.25;font-weight:800;color:${BRAND_TEXT};">
                  Sign in to Mentor Connect
                </h1>
                <p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;color:${BRAND_MUTED};">
                  Tap the button below to sign in as
                  <strong style="color:${BRAND_TEXT};">${escapeHtml(email)}</strong>.
                  The link expires in ${expiresMinutes} minutes and can only be used once.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius:10px;background:${BRAND_BLUE};">
                      <a href="${url}"
                        style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background:${BRAND_BLUE};line-height:1;">
                        Sign in to Mentor Connect →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:24px 0 8px 0;font-size:13px;color:${BRAND_MUTED};">
                  Button not working? Paste this URL into your browser:
                </p>
                <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;color:${BRAND_DARK};">
                  <a href="${url}" style="color:${BRAND_DARK};text-decoration:underline;">${url}</a>
                </p>
              </td>
            </tr>

            <!-- Divider + safety line -->
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <div style="border-top:1px solid ${BRAND_BORDER};margin:0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px 32px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND_MUTED};">
                  Didn't request this? You can safely ignore the email — your account stays untouched.
                  Only <strong>@byui.edu</strong> addresses can sign in to Mentor Connect.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f7f9fc;padding:18px 32px;text-align:center;">
                <div style="font-size:11px;line-height:1.5;color:${BRAND_MUTED};">
                  BYUI CAN — Career Advancement Network · BYU-Idaho<br />
                  Sent to ${escapeHtml(email)} from ${escapeHtml(host)}
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "Sign in to BYUI CAN Mentor Connect",
    "",
    `Hi — to sign in as ${email}, open this link in your browser:`,
    url,
    "",
    `The link expires in ${expiresMinutes} minutes and can only be used once.`,
    "Didn't request this? Ignore the email; your account stays untouched.",
    "Only @byui.edu addresses can sign in.",
    "",
    "— BYUI CAN, Career Advancement Network, BYU-Idaho",
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
