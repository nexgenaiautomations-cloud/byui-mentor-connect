import { auth } from "../../auth";
import { db } from "@/db/client";
import { users, type User } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auditEvent } from "@/lib/audit";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  return user ?? null;
}

// requireUser / requireAdmin return the user when authorized, or a `Response`
// when not. Throwing a Response from a Next 16 route handler is caught as an
// error and produces 500, so we hand the Response back to the caller to
// return. Use:
//
//   const result = await requireAdmin(req);
//   if (result instanceof Response) return result;
//   const admin = result;
export async function requireUser(): Promise<User | Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  return user;
}

// requireAdmin optionally takes the incoming Request so unauthorized attempts
// can be audited with IP/user-agent context.
export async function requireAdmin(req?: Request): Promise<User | Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.isAdmin) {
    // Fire-and-forget audit. We don't await so the 403 path isn't delayed
    // by a DB hiccup; auditEvent itself never throws.
    void auditEvent({
      actorUserId: user.id,
      eventType: "UNAUTHORIZED_ADMIN_ATTEMPT",
      severity: "critical",
      request: req,
      metadata: { isMentor: user.isMentor },
    });
    return new Response("Forbidden", { status: 403 });
  }
  return user;
}
