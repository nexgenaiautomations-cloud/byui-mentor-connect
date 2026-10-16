import { z } from "zod";

// "Bring ICAN to your school" — public form, so everything here is
// untrusted input. `website` is a hidden honeypot field; humans leave it
// empty.
export const schoolInquirySchema = z.object({
  contactName: z.string().trim().min(1, "Please enter your name.").max(120),
  contactEmail: z.string().trim().toLowerCase().email("Please enter a valid email.").max(200),
  schoolName: z.string().trim().min(1, "Please enter your school.").max(200),
  role: z.string().trim().max(120).optional().default(""),
  emailDomain: z.string().trim().toLowerCase().max(120).optional().default(""),
  message: z.string().trim().max(3000).optional().default(""),
  website: z.string().max(0).optional(),
});

export type SchoolInquiryInput = z.infer<typeof schoolInquirySchema>;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Notification sent to the ICAN team when a school asks to join.
export function renderSchoolInquiryEmail(
  i: Omit<SchoolInquiryInput, "website">
): { subject: string; html: string; text: string } {
  const rows: [string, string][] = [
    ["Name", i.contactName],
    ["Email", i.contactEmail],
    ["School", i.schoolName],
    ["Role", i.role || "—"],
    ["Student email domain", i.emailDomain || "—"],
    ["Message", i.message || "—"],
  ];
  const subject = `ICAN school inquiry: ${i.schoolName}`.slice(0, 180);
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f1534;">
  <h2 style="margin:0 0 12px;color:#4C1D95;">New school inquiry</h2>
  <table cellpadding="6" style="border-collapse:collapse;">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="font-weight:600;vertical-align:top;">${k}</td><td style="white-space:pre-wrap;">${escapeHtml(v)}</td></tr>`
      )
      .join("\n    ")}
  </table>
  <p style="color:#6b5f85;font-size:13px;">Add their domain from Admin → Schools once they sign on.</p>
</div>`;
  const text = ["New ICAN school inquiry", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  return { subject, html, text };
}
