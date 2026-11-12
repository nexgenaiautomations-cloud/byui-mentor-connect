import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { interventionEvents, interventions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { adminScopeFor, schoolInScope } from "@/lib/admin-scope";
import { auditEvent } from "@/lib/audit";
import { schoolOf } from "@/lib/school-scope";
import {
  canTransition,
  duplicateOutreachWarning,
  isInterventionStatus,
  isOpen,
  type InterventionStatus,
} from "@/lib/interventions";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.string(), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("assign"), assigneeId: z.string().max(100).nullable() }),
  z.object({ action: z.literal("note"), note: z.string().trim().min(1).max(1000) }),
  z.object({
    action: z.literal("outreach"),
    note: z.string().max(1000).optional(),
    force: z.boolean().optional(),
  }),
  z.object({ action: z.literal("follow_up"), followUpOn: z.coerce.date().nullable() }),
  z.object({ action: z.literal("reassign_recommended"), note: z.string().max(1000).optional() }),
]);

// Executive mentors may work cases assigned to them, but only these actions.
const EXEC_ACTIONS = new Set(["note", "outreach", "status", "follow_up"]);
const EXEC_STATUSES = new Set<InterventionStatus>(["contacted", "awaiting_response", "resolved"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  const [c] = await db.select().from(interventions).where(eq(interventions.id, id)).limit(1);
  const scope = adminScopeFor(me);
  const asAdmin = !!c && !!scope && schoolInScope(c.school, scope);
  const asAssignedExec = !!c && !asAdmin && me.isExecutiveMentor && c.assignedToId === me.id;
  // Anything the caller can't act on is indistinguishable from not found.
  if (!c || (!asAdmin && !asAssignedExec)) {
    if (!me.isAdmin && !me.isExecutiveMentor) {
      void auditEvent({ actorUserId: me.id, eventType: "UNAUTHORIZED_ADMIN_ATTEMPT", severity: "critical", request: req, metadata: { route: "interventions" } });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (asAssignedExec && !EXEC_ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "Only an admin can do that" }, { status: 403 });
  }

  const now = new Date();
  const set: Partial<typeof interventions.$inferInsert> = { updatedAt: now };
  const event: typeof interventionEvents.$inferInsert = { interventionId: id, actorId: me.id, action: body.action };

  switch (body.action) {
    case "status": {
      if (!isInterventionStatus(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
      const from = c.status as InterventionStatus;
      if (!canTransition(from, body.status)) {
        return NextResponse.json({ error: `Can't move a case from ${from} to ${body.status}` }, { status: 409 });
      }
      if (asAssignedExec && !EXEC_STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Only an admin can do that" }, { status: 403 });
      }
      set.status = body.status;
      set.resolvedAt = isOpen(body.status) ? null : now;
      event.fromStatus = from;
      event.toStatus = body.status;
      event.note = body.note?.trim() || null;
      break;
    }
    case "assign": {
      if (body.assigneeId) {
        const [who] = await db.select().from(users).where(eq(users.id, body.assigneeId)).limit(1);
        // Same school, and an admin or executive mentor.
        if (!who || who.deactivatedAt || !(who.isAdmin || who.isExecutiveMentor) || schoolOf(who.email) !== c.school) {
          return NextResponse.json({ error: "That person can't be assigned to this case" }, { status: 400 });
        }
        event.note = who.name ?? who.email;
      }
      set.assignedToId = body.assigneeId;
      if (c.status === "new" && body.assigneeId) {
        set.status = "reviewing";
        event.fromStatus = "new";
        event.toStatus = "reviewing";
      }
      break;
    }
    case "note":
      event.note = body.note;
      break;
    case "outreach": {
      if (!body.force && duplicateOutreachWarning(c, me.id, now)) {
        const [who] = c.lastOutreachById
          ? await db.select({ name: users.name }).from(users).where(eq(users.id, c.lastOutreachById)).limit(1)
          : [];
        return NextResponse.json(
          {
            error: "duplicate_outreach",
            message: `${who?.name ?? "Another admin"} already reached out ${c.lastOutreachAt!.toLocaleString()}. Record yours anyway?`,
          },
          { status: 409 }
        );
      }
      set.lastOutreachAt = now;
      set.lastOutreachById = me.id;
      if (c.status === "new" || c.status === "reviewing") {
        set.status = "contacted";
        event.fromStatus = c.status;
        event.toStatus = "contacted";
      }
      event.note = body.note?.trim() || null;
      break;
    }
    case "follow_up":
      set.followUpOn = body.followUpOn;
      event.note = body.followUpOn ? body.followUpOn.toISOString().slice(0, 10) : "cleared";
      break;
    case "reassign_recommended":
      event.note = body.note?.trim() || null;
      break;
  }

  await db.update(interventions).set(set).where(eq(interventions.id, id));
  await db.insert(interventionEvents).values(event);
  void auditEvent({
    actorUserId: me.id,
    targetUserId: c.studentId,
    eventType: "ADMIN_UPDATED_INTERVENTION",
    request: req,
    metadata: { interventionId: id, action: body.action, toStatus: event.toStatus ?? null },
  });
  return NextResponse.json({ ok: true });
}
