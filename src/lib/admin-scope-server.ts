import "server-only";
// Server helpers that put admin routes behind the school boundary. Anything
// outside the caller's scope is answered exactly like a missing record (404)
// so its existence isn't leaked, and the attempt is audited.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type User } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { auditEvent } from "@/lib/audit";
import { adminScopeFor, emailInScopeJs, type AdminScope } from "@/lib/admin-scope";

export type ScopedAdmin = { admin: User; scope: AdminScope };

// requireAdmin + the caller's scope. `requestedSchool` is ignored unless the
// caller is a platform admin.
export async function requireAdminScope(req?: Request, requestedSchool?: string | null): Promise<ScopedAdmin | Response> {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  return { admin, scope: adminScopeFor(admin, requestedSchool)! };
}

export function crossSchoolDenied(admin: User, req: Request | undefined, metadata: Record<string, unknown>) {
  void auditEvent({
    actorUserId: admin.id,
    eventType: "UNAUTHORIZED_ADMIN_ATTEMPT",
    severity: "warning",
    request: req,
    metadata: { reason: "cross_school", ...metadata },
  });
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Load a user only if they're inside the scope; otherwise null.
export async function userInScope(id: string, scope: AdminScope): Promise<User | null> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u && emailInScopeJs(u.email, scope) ? u : null;
}

export async function emailForUser(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  return u?.email ?? null;
}
