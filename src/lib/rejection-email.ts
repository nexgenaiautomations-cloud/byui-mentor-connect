// Pre-filled email shown to admins before they reject a mentor application.
// The plain-text body is the single source of truth — the admin can edit it
// in the modal, and the HTML body is rendered from the same text on submit.

export const REJECTION_EMAIL_SUBJECT = "BYUI CAN Mentor Application Update";

export const REJECTION_EMAIL_BODY = `Thank you for applying. We would love to have you; however, we haven't accepted your application yet.

We require our mentors to consistently uphold the standards before acceptance as a mentor. Once you consistently uphold the CAN career standards for the next few months, please reply.

1. Career Task — weekly
One focused action every week: resume edit, alumni outreach, internship app, mock interview.

2. Internships/Industry Experiences — before senior year
Two real-world experiences, such as internships, shadowing, or projects, before senior year so the resume tells a story.

3. Career Chats — monthly
Three Career Chats a month with mentors, alumni, or peers. Networking that compounds.`;

const BRAND_BLUE = "#006EB6";
const BRAND_DARK = "#214491";
const BRAND_LIGHT = "#A0D4ED";
const BRAND_TEXT = "#0f172a";
const BRAND_MUTED = "#5d6b85";
const BRAND_BORDER = "#e2e8f0";

const LOGO_URL = "https://www.byuican.com/byuican-icon.png";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Render the plain-text body as semantic HTML: keep paragraphs and the three
// numbered standards (each is two lines — heading then description).
export function rejectionBodyToHtml(text: string) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const m = block.match(/^(\d+\.\s.+?)\n([\s\S]+)$/);
      if (m) {
        return `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;color:${BRAND_TEXT};"><strong style="color:${BRAND_DARK};">${escapeHtml(
          m[1]
        )}</strong><br />${escapeHtml(m[2]).replace(/\n/g, "<br />")}</p>`;
      }
      return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:${BRAND_TEXT};">${escapeHtml(
        block
      ).replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");
}

export function buildRejectionEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND_TEXT};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f6fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BRAND_BORDER};">
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
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;font-weight:800;color:${BRAND_TEXT};">
                  ${escapeHtml(subject)}
                </h1>
                ${rejectionBodyToHtml(body)}
              </td>
            </tr>
            <tr>
              <td style="background:#f7f9fc;padding:18px 32px;text-align:center;">
                <div style="font-size:11px;line-height:1.5;color:${BRAND_MUTED};">
                  BYUI CAN — Career Advancement Network · BYU-Idaho<br />
                  Sent to ${escapeHtml(to)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { html, text: body };
}
