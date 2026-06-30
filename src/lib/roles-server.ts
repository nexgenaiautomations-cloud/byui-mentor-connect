// Server-only role helper. Lives in its own file so client components can
// safely import the pure pieces of lib/roles without dragging next/headers
// into the browser bundle.
import "server-only";
import { cookies } from "next/headers";
import type { User } from "@/db/schema";
import {
  ACTIVE_ROLE_COOKIE,
  availableRoles,
  defaultRole,
  type ActiveRole,
} from "./roles";
import { auditEvent } from "./audit";

// Read the active role cookie, validate against the user's actual roles,
// fall back to defaultRole if missing or stale.
//
// When a cookie value is present but rejected (user was demoted, tampered
// cookie, etc.) we fire a ROLE_COOKIE_REJECTED audit event so the rejection
// is visible to admins. Fire-and-forget so the read path stays fast.
export async function readActiveRole(user: User): Promise<ActiveRole> {
  const store = await cookies();
  const raw = store.get(ACTIVE_ROLE_COOKIE)?.value;
  const allowed = availableRoles(user);
  if (raw && (allowed as string[]).includes(raw)) return raw as ActiveRole;
  if (raw) {
    // The cookie carried a value that the user is no longer allowed to
    // assume. Could be benign (demotion) or hostile (cookie tampering).
    void auditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: "ROLE_COOKIE_REJECTED",
      severity: "warning",
      metadata: { attempted: raw, allowed: allowed as string[] },
    });
  }
  return defaultRole(user);
}
