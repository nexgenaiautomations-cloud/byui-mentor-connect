// The ICAN 3-2-1 pledge every user signs (by typing their name) before using
// the app. Shaun Franklin, 2026-11-09. Copy matches the landing page.

export const PLEDGE_ITEMS = [
  {
    count: 3,
    title: "Career Chats — monthly",
    body: "Three Career Chats a month with mentors, alumni, or peers. Networking that compounds.",
  },
  {
    count: 2,
    title: "Industry Experiences — before senior year",
    body: "Two real-world experiences (internships, shadowing, projects) before senior year so the resume tells a story.",
  },
  {
    count: 1,
    title: "Career Task — weekly",
    body: "One focused action every week: resume edit, alumni outreach, internship app, mock interview.",
  },
] as const;

function words(s: string | null | undefined): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// The typed signature must be the person's name: first word = first name and
// last word = last name (middle names/initials allowed in between).
export function pledgeNameMatches(
  typed: string,
  who: { firstName: string | null; lastName: string | null; name: string | null }
): boolean {
  const t = words(typed);
  if (t.length < 2) return false;
  const first = words(who.firstName)[0] ?? words(who.name)[0];
  const lastParts = words(who.lastName);
  const last = lastParts.length ? lastParts[lastParts.length - 1] : words(who.name).slice(1).pop();
  if (!first || !last) return true; // no name on file: any full name signs
  return t[0] === first && t[t.length - 1] === last;
}

// Everyone signs once: students and mentors after their profile exists,
// admins on their next visit (they may never have onboarded). Admins are not
// exempt (client decision, 2026-11-11).
export function needsPledge(u: {
  onboardedAt: Date | null;
  pledgeSignedAt: Date | null;
  isAdmin: boolean;
}): boolean {
  return !u.pledgeSignedAt && (u.isAdmin || !!u.onboardedAt);
}
