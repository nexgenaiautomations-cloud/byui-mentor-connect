// School boundary for the accountability features. A school is the domain of
// a user's email (src/lib/school-scope.ts). Program admins see their own
// school; platform admins (PLATFORM_ADMIN_EMAILS) may pick any school or all.
import { sql, type SQL, type AnyColumn } from "drizzle-orm";
import { schoolOf } from "@/lib/school-scope";
import { isPlatformAdmin } from "@/lib/platform-admin";

export type AdminScope = { school: string | null; platform: boolean };

// `requested` lets a platform admin narrow to one school ("" = all).
export function adminScopeFor(
  user: { email: string; isAdmin: boolean },
  requested?: string | null,
  platform: boolean = isPlatformAdmin(user)
): AdminScope | null {
  if (!user.isAdmin) return null;
  if (platform) {
    const r = requested?.trim().toLowerCase();
    return { school: r ? r : null, platform: true };
  }
  const own = schoolOf(user.email);
  // An admin without a parseable school sees nothing rather than everything.
  return { school: own ?? "\u0000no-school", platform: false };
}

// SQL condition: the email column belongs to the scoped school (or true).
export function emailInScope(emailColumn: AnyColumn | SQL, scope: AdminScope): SQL {
  if (scope.school === null) return sql`true`;
  return sql`lower(split_part(${emailColumn}, '@', 2)) = ${scope.school}`;
}

export function schoolInScope(school: string | null | undefined, scope: AdminScope): boolean {
  if (scope.school === null) return true;
  return !!school && school.toLowerCase() === scope.school;
}
