// Platform admins run ICAN itself (adding schools), as opposed to a school's
// program admins (isAdmin / isHeadAdmin), who manage members and matches.
// Set PLATFORM_ADMIN_EMAILS to a comma-separated list of account emails.

export function parsePlatformAdminEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email: string, allowed: readonly string[]): boolean {
  return allowed.includes(email.trim().toLowerCase());
}

export function isPlatformAdmin(user: { email: string } | null | undefined): boolean {
  if (!user) return false;
  return isPlatformAdminEmail(user.email, parsePlatformAdminEmails(process.env.PLATFORM_ADMIN_EMAILS));
}
