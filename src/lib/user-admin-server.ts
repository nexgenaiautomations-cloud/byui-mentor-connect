import "server-only";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { matches, requests, users, type User } from "@/db/schema";
import { auditEvent } from "@/lib/audit";
import { notifyWaitingMentees } from "@/lib/mentor-waitlist-server";
import {
  checkRemoval,
  checkRestore,
  checkRoleChange,
  currentRole,
  type ManagedRole,
} from "@/lib/user-admin";
import { clearStewardshipFor } from "@/lib/stewardship-server";

export type AdminActionResult = { ok: true } | { ok: false; status: number; error: string };

async function loadTarget(id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

// End this person's active mentor-side matches and decline pending requests
// sent to them. Used when someone stops being a mentor or is removed.
async function endMentoring(userId: string) {
  const now = new Date();
  await db
    .update(matches)
    .set({ status: "cancelled", endedAt: now })
    .where(and(eq(matches.mentorId, userId), eq(matches.status, "active")));
  await db
    .update(requests)
    .set({ status: "declined", respondedAt: now })
    .where(and(eq(requests.mentorId, userId), eq(requests.status, "pending")));
}

export async function changeRole(
  actor: User,
  targetId: string,
  role: ManagedRole,
  request?: Request
): Promise<AdminActionResult> {
  const target = await loadTarget(targetId);
  if (!target) return { ok: false, status: 404, error: "Member not found." };
  const err = checkRoleChange(actor, target, role);
  if (err) return { ok: false, status: 403, error: err };

  const from = currentRole(target);
  if (role === "member") {
    await db
      .update(users)
      .set({ isMentor: false, isExecutiveMentor: false, mentorAvailable: false })
      .where(eq(users.id, target.id));
    await endMentoring(target.id);
  } else {
    await db
      .update(users)
      .set({
        isMentor: true,
        isExecutiveMentor: role === "executive_mentor",
        mentorAvailable: from === "member" ? true : target.mentorAvailable,
      })
      .where(eq(users.id, target.id));
  }
  // Stewardship links executive mentors to the mentors they oversee. Drop
  // links that no longer fit the new role.
  await clearStewardshipFor(target.id, {
    asExecutive: role !== "executive_mentor",
    asMentor: role !== "mentor",
  });

  await auditEvent({
    actorUserId: actor.id,
    targetUserId: target.id,
    eventType: "ADMIN_CHANGED_ROLE",
    request,
    metadata: { from, to: role },
  });
  if (from === "member" && role !== "member") await notifyWaitingMentees();
  return { ok: true };
}

export async function removeUser(
  actor: User,
  targetId: string,
  reason: string | null,
  request?: Request
): Promise<AdminActionResult> {
  const target = await loadTarget(targetId);
  if (!target) return { ok: false, status: 404, error: "Member not found." };
  const err = checkRemoval(actor, target);
  if (err) return { ok: false, status: 403, error: err };

  const now = new Date();
  await db
    .update(users)
    .set({
      deactivatedAt: now,
      deactivatedById: actor.id,
      deactivationReason: reason,
      isMentor: false,
      isExecutiveMentor: false,
      mentorAvailable: false,
      isAdmin: false,
    })
    .where(eq(users.id, target.id));
  await endMentoring(target.id);
  await db
    .update(matches)
    .set({ status: "cancelled", endedAt: now })
    .where(and(eq(matches.menteeId, target.id), eq(matches.status, "active")));
  await db
    .update(requests)
    .set({ status: "cancelled", respondedAt: now })
    .where(
      and(
        or(eq(requests.menteeId, target.id), eq(requests.mentorId, target.id)),
        eq(requests.status, "pending")
      )
    );
  await clearStewardshipFor(target.id, { asExecutive: true, asMentor: true });

  await auditEvent({
    actorUserId: actor.id,
    targetUserId: target.id,
    eventType: "ADMIN_REMOVED_USER",
    severity: "warning",
    request,
    metadata: { previousRole: currentRole(target), wasAdmin: target.isAdmin },
  });
  return { ok: true };
}

export async function restoreUser(
  actor: User,
  targetId: string,
  request?: Request
): Promise<AdminActionResult> {
  const target = await loadTarget(targetId);
  if (!target) return { ok: false, status: 404, error: "Member not found." };
  const err = checkRestore(actor, target);
  if (err) return { ok: false, status: 403, error: err };

  // Restored as a plain member; an admin can re-promote afterwards.
  await db
    .update(users)
    .set({ deactivatedAt: null, deactivatedById: null, deactivationReason: null })
    .where(eq(users.id, target.id));
  await auditEvent({
    actorUserId: actor.id,
    targetUserId: target.id,
    eventType: "ADMIN_RESTORED_USER",
    request,
  });
  return { ok: true };
}
