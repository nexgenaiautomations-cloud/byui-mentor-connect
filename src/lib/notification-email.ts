// Reminder email content. Deliberately minimal: no meeting notes, action
// item text, ratings or feedback ever go in an email — only "you have
// something to do in ICAN" and a plain link with no tokens in it.
import type { NotificationKind } from "@/lib/notifications";

const BRAND_DARK = "#4C1D95";
const BRAND = "#6D28D9";
const BRAND_LIGHT = "#C4B5FD";
const TEXT = "#0f172a";
const MUTED = "#6b5f85";
const BORDER = "#e2e8f0";
const LOGO_URL = "https://www.icareeradvancementnetwork.com/ican-icon.png";

export type EmailContext = {
  appUrl: string;
  recipientFirstName: string | null;
  otherFirstName: string | null; // the other person in the pair
  recipientRole: "mentor" | "mentee";
  // Human date/time already formatted in the meeting's timezone.
  when?: string | null;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function content(kind: NotificationKind, c: EmailContext): { subject: string; lines: string[]; cta: string; path: string } {
  const other = c.otherFirstName || (c.recipientRole === "mentor" ? "your mentee" : "your mentor");
  switch (kind) {
    case "meeting_24h":
      return {
        subject: `Reminder: you're meeting ${other} ${c.when ? "on " + c.when : "soon"}`,
        lines: [`This is a friendly reminder that you have an ICAN meeting with ${other}${c.when ? " on " + c.when : ""}.`],
        cta: "Open ICAN",
        path: "/matches",
      };
    case "meeting_1h":
      return {
        subject: `Your meeting with ${other} starts in about an hour`,
        lines: [`Your ICAN meeting with ${other} starts in about an hour${c.when ? " (" + c.when + ")" : ""}.`],
        cta: "Open ICAN",
        path: "/matches",
      };
    case "log_followup":
      return {
        subject: `How did your meeting with ${other} go?`,
        lines: [
          `Your meeting with ${other}${c.when ? " on " + c.when : ""} has passed. If it happened, please log it — it takes under a minute.`,
          "If it didn't happen, no problem — just schedule a new time.",
        ],
        cta: "Log the meeting",
        path: "/log-meeting",
      };
    case "confirm_meeting":
      return {
        subject: `Please confirm your meeting with ${other}`,
        lines: [`${other} logged a meeting with you. Please take a second to confirm it happened.`],
        cta: "Confirm in ICAN",
        path: "/matches",
      };
    case "action_items":
      return {
        subject: "You have follow-up items from your mentor meeting",
        lines: [
          "You have action items from a recent mentor meeting. When they're done, mark them complete in ICAN so your mentor can see your progress.",
        ],
        cta: "View my action items",
        path: "/matches",
      };
    case "inactivity_first_meeting":
      return {
        subject: `Time to set up your first meeting with ${other}`,
        lines: [
          `You and ${other} were matched about a week ago. A short first conversation is the best way to get started — even 20 minutes helps.`,
        ],
        cta: "Get started",
        path: "/matches",
      };
    case "inactivity_checkin":
      return {
        subject: `Checking in: it's been a couple of weeks since you connected with ${other}`,
        lines: [`It's been about two weeks since you and ${other} last connected. A quick message or call keeps things moving.`],
        cta: "Reach out",
        path: "/matches",
      };
    case "inactivity_concern":
      return {
        subject: `It's been a month since you connected with ${other}`,
        lines: [
          `It's been about a month since you and ${other} last connected. If something's getting in the way, you can reply to this email or use "Report an issue" in ICAN and a program admin will help.`,
        ],
        cta: "Open ICAN",
        path: "/matches",
      };
  }
}

export function buildNotificationEmail(kind: NotificationKind, c: EmailContext, to: string) {
  const { subject, lines, cta, path } = content(kind, c);
  const url = `${c.appUrl.replace(/\/$/, "")}${path}`;
  const greeting = c.recipientFirstName ? `Hi ${c.recipientFirstName},` : "Hi,";
  const prefs = `${c.appUrl.replace(/\/$/, "")}/settings`;
  const text = [
    greeting,
    "",
    ...lines,
    "",
    `${cta}: ${url}`,
    "",
    `You can change which reminders you get in Settings: ${prefs}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f2fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f2fc;padding:32px 16px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
<tr><td style="background:${BRAND_DARK};padding:20px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${LOGO_URL}" width="40" height="40" alt="ICAN" style="display:block;border:0;border-radius:8px;background:#ffffff;" /></td>
<td style="vertical-align:middle;padding-left:12px;"><div style="font-size:14px;font-weight:800;color:#ffffff;">ICAN</div><div style="font-size:11px;font-weight:600;color:${BRAND_LIGHT};text-transform:uppercase;letter-spacing:0.6px;">Career Advancement Network</div></td>
</tr></table></td></tr>
<tr><td style="padding:28px 32px 8px 32px;">
<p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;">${escapeHtml(greeting)}</p>
${lines.map((l) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;">${escapeHtml(l)}</p>`).join("\n")}
<p style="margin:20px 0 24px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">${escapeHtml(cta)}</a></p>
</td></tr>
<tr><td style="background:#f8f6fc;padding:18px 32px;text-align:center;font-size:11px;line-height:1.5;color:${MUTED};">
You're getting this because you're part of an ICAN mentorship. <a href="${escapeHtml(prefs)}" style="color:${BRAND};">Change reminder settings</a>.<br />Sent to ${escapeHtml(to)}
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
