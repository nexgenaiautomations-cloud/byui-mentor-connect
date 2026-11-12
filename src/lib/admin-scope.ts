// The ONE school boundary for every admin surface (old pages, new pages, APIs,
// exports). A school is the domain of a user's verified school email
// (src/lib/school-scope.ts) — email can't be changed in-app and sign-up is
// limited to registered school domains, so the domain is a stable boundary.
// Program admins see only their own school; platform admins
// (PLATFORM_ADMIN_EMAILS, checked server-side) may pick one school or all.
// A school value supplied by the client is ONLY honoured for platform admins.
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

// Email-domain match for a user email in JS.
export function emailInScopeJs(email: string | null | undefined, scope: AdminScope): boolean {
  if (scope.school === null) return true;
  return !!email && schoolInScope(schoolOf(email), scope);
}

// SQL condition: `idColumn` (a user id) belongs to a user in scope. Works
// for any table that references "user".id (match.mentee_id,
// meeting_log.student_id, request.mentee_id, mentor_application.user_id...).
export function userIdInScope(idColumn: AnyColumn | SQL, scope: AdminScope): SQL {
  if (scope.school === null) return sql`true`;
  return sql`${idColumn} in (select "id" from "user" where lower(split_part("email", '@', 2)) = ${scope.school})`;
}

// Audit events belong to a school when the actor or the target does.
// Anonymous events (no actor and no target, e.g. CSP reports, failed logins
// for unknown emails) are platform-wide and only platform admins see them.
export function auditEventInScope(
  actorIdColumn: AnyColumn | SQL,
  targetIdColumn: AnyColumn | SQL,
  scope: AdminScope
): SQL {
  if (scope.school === null) return sql`true`;
  return sql`(${userIdInScope(actorIdColumn, scope)} or ${userIdInScope(targetIdColumn, scope)})`;
}

// Same idea for raw SQL strings that alias columns by name.
export function rawUserIdInScope(column: string, scope: AdminScope): SQL {
  return userIdInScope(sql.raw(column), scope);
}
