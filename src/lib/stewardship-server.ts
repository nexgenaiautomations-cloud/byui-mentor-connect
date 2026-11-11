import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorStewardship, users } from "@/db/schema";
import { auditEvent } from "@/lib/audit";
import { diffAssignments, type Assignments } from "@/lib/stewardship";
// Remove stewardship links involving this user: as the executive overseeing
// others and/or as the mentor being overseen.
export async function clearStewardshipFor(
  userId: string,
  opts: { asExecutive: boolean; asMentor: boolean }
) {
  if (opts.asExecutive) {
    await db.delete(mentorStewardship).where(eq(mentorStewardship.executiveId, userId));
  }
  if (opts.asMentor) {
    await db.delete(mentorStewardship).where(eq(mentorStewardship.mentorId, userId));
  }
}


export async function loadStewardship() {
  const [executives, mentors, rows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image, major: users.major })
      .from(users)
      .where(and(eq(users.isExecutiveMentor, true), eq(users.isMentor, true), isNull(users.deactivatedAt)))
      .orderBy(users.name),
    db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image, major: users.major })
      .from(users)
      .where(and(eq(users.isMentor, true), eq(users.isExecutiveMentor, false), isNull(users.deactivatedAt)))
      .orderBy(users.name),
    db.select({ mentorId: mentorStewardship.mentorId, executiveId: mentorStewardship.executiveId }).from(mentorStewardship),
  ]);
  const current: Assignments = Object.fromEntries(mentors.map((m) => [m.id, null]));
  for (const r of rows) if (r.mentorId in current) current[r.mentorId] = r.executiveId;
  return { executives, mentors, current };
}

// Save the admin-approved assignment for every mentor in `next`. Ids that
// aren't current mentors / executive mentors are rejected.
export async function saveStewardship(
  adminId: string,
  next: Assignments,
  request?: Request
): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
  const { executives, current } = await loadStewardship();
  const execIds = new Set(executives.map((e) => e.id));
  for (const [mentorId, execId] of Object.entries(next)) {
    if (!(mentorId in current)) return { ok: false, error: "One of those people is no longer a mentor. Reload and try again." };
    if (execId !== null && !execIds.has(execId)) {
      return { ok: false, error: "One of those executive mentors no longer has that role. Reload and try again." };
    }
  }
  const changes = diffAssignments(current, { ...current, ...next });
  for (const c of changes) {
    if (c.to === null) {
      await db.delete(mentorStewardship).where(eq(mentorStewardship.mentorId, c.mentorId));
    } else {
      await db
        .insert(mentorStewardship)
        .values({ mentorId: c.mentorId, executiveId: c.to, assignedById: adminId, assignedAt: new Date() })
        .onConflictDoUpdate({
          target: mentorStewardship.mentorId,
          set: { executiveId: c.to, assignedById: adminId, assignedAt: new Date() },
        });
    }
  }
  if (changes.length) {
    await auditEvent({
      actorUserId: adminId,
      eventType: "ADMIN_SET_STEWARDSHIP",
      request,
      metadata: { changed: changes.length },
    });
  }
  return { ok: true, changed: changes.length };
}
