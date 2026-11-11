// Which profile fields a user must fill in before ICAN stops nagging them
// (Shaun Franklin, 2026-11-09: "if a user's profile fields are blank, open
// the profile, and be a little forceful for them to complete it").

type ProfileFields = {
  firstName: string | null;
  lastName: string | null;
  major: string | null;
  semesterLevel: string | null;
  expectedGraduation: string | null;
  careerInterests: string[] | null;
  preferredContactMethod: string | null;
};

const REQUIRED: { key: keyof ProfileFields; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "major", label: "Major" },
  { key: "semesterLevel", label: "Year in school" },
  { key: "expectedGraduation", label: "Expected graduation" },
  { key: "careerInterests", label: "Career interests" },
  { key: "preferredContactMethod", label: "Preferred contact method" },
];

export function missingProfileFields(u: ProfileFields): string[] {
  return REQUIRED.filter(({ key }) => {
    const v = u[key];
    if (Array.isArray(v)) return v.length === 0;
    return !v || !v.trim();
  }).map((r) => r.label);
}

// "Not now" hides the reminder briefly; it comes back after this.
export const PROFILE_SNOOZE_MS = 10 * 60 * 1000;

// The profile editor lives at /settings (/profile redirects there).
const EXEMPT_PATHS = ["/profile", "/settings", "/onboarding"];

export function shouldNagProfile(pathname: string, snoozedAt: number | null, now: number): boolean {
  if (EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  if (snoozedAt !== null && now - snoozedAt < PROFILE_SNOOZE_MS) return false;
  return true;
}
