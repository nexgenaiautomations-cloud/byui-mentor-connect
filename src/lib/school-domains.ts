// Which schools' email domains may register. The list lives in the
// `school_domain` table so new schools can be added without a deploy;
// byui.edu is the launch school and the fallback if the table can't be read.

import { isPlatformAdminEmail, parsePlatformAdminEmails } from "@/lib/platform-admin";

export const DEFAULT_SCHOOL_DOMAINS = ["byui.edu"] as const;

export const NOT_ALLOWED_MESSAGE =
  "That email isn't from a school on ICAN yet. Use your school email, or ask your school to contact us about joining.";

export function emailDomain(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.trim().slice(at + 1).toLowerCase();
  return domain.length ? domain : null;
}

// Exact match only: no suffix or subdomain matching, so look-alike domains
// (evilbyui.edu, byui.edu.attacker.com, mail.byui.edu) are rejected.
export function isAllowedDomain(email: string, domains: readonly string[]): boolean {
  const d = emailDomain(email);
  return d !== null && domains.includes(d);
}

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// Admin input → canonical domain, or null if it isn't a plausible domain.
export function normalizeDomain(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/^@/, "");
  return DOMAIN_RE.test(d) ? d : null;
}

// Active domains from the database. Falls back to the launch school if the
// table is unreachable or empty so sign-in never locks everyone out.
export async function getActiveSchoolDomains(): Promise<string[]> {
  try {
    const { db } = await import("@/db/client");
    const { schoolDomains } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select({ domain: schoolDomains.domain })
      .from(schoolDomains)
      .where(eq(schoolDomains.active, true));
    if (rows.length) return rows.map((r) => r.domain);
  } catch (err) {
    console.error("[school-domains] falling back to defaults:", err);
  }
  return [...DEFAULT_SCHOOL_DOMAINS];
}

// School emails, plus the platform admins (PLATFORM_ADMIN_EMAILS), who run
// ICAN itself and may sign in with a non-school address.
export function isAllowedSignupEmail(
  email: string,
  domains: readonly string[],
  platformAdmins: readonly string[]
): boolean {
  return isAllowedDomain(email, domains) || isPlatformAdminEmail(email, platformAdmins);
}

export async function isAllowedSchoolEmail(email: string): Promise<boolean> {
  const admins = parsePlatformAdminEmails(process.env.PLATFORM_ADMIN_EMAILS);
  if (isPlatformAdminEmail(email, admins)) return true;
  return isAllowedSignupEmail(email, await getActiveSchoolDomains(), admins);
}
