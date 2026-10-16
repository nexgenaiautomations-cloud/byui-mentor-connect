import { sql, type SQL } from "drizzle-orm";
import { users } from "@/db/schema";
import { emailDomain } from "@/lib/school-domains";

// Mentoring stays within each school. A member's school is the domain of
// their verified school email, so no extra column is needed.

export function schoolOf(email: string): string | null {
  return emailDomain(email);
}

export function sameSchool(a: string, b: string): boolean {
  const da = schoolOf(a);
  return da !== null && da === schoolOf(b);
}

// SQL condition: the `user` row is at the same school as `email`.
export function sameSchoolAs(email: string): SQL {
  const domain = schoolOf(email) ?? "\u0000no-school";
  return sql`lower(split_part(${users.email}, '@', 2)) = ${domain}`;
}
