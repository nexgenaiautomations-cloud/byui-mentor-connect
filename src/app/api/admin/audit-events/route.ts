import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auditEvents, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { requireAdmin } from "@/lib/session";

// GET /api/admin/audit-events?eventType=...&severity=...&limit=50&cursor=<ISO>
//
// Admin-only listing of the audit log. Pagination is cursor-based on
// `createdAt` so concurrent inserts don't shift page boundaries. The cursor
// is the createdAt of the last row on the previous page; we fetch rows
// strictly older than that timestamp.
//
// The actor and target user names are joined for display so the admin page
// doesn't have to do an N+1 lookup. Raw token columns, IP addresses, and
// other PII are not exposed because they aren't stored — see lib/audit.ts.

// Validate `eventType` against the actual Postgres enum at the API edge so
// an unknown value yields a clean 400 instead of crashing the Drizzle query
// with a Postgres enum violation (which the framework would surface as 500).
const EVENT_TYPES = auditEvents.eventType.enumValues;

const querySchema = z.object({
  eventType: z.enum(EVENT_TYPES as readonly [string, ...string[]]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  actorUserId: z.string().min(1).max(100).optional(),
  targetUserId: z.string().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    eventType: url.searchParams.get("eventType") ?? undefined,
    severity: url.searchParams.get("severity") ?? undefined,
    actorUserId: url.searchParams.get("actorUserId") ?? undefined,
    targetUserId: url.searchParams.get("targetUserId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;

  const actor = alias(users, "actor_u");
  const target = alias(users, "target_u");

  const conditions = [];
  // Zod already restricted q.eventType to a member of EVENT_TYPES, so the
  // cast here is sound — Drizzle's enum-narrowed column type just doesn't
  // know that.
  if (q.eventType) {
    conditions.push(
      eq(auditEvents.eventType, q.eventType as (typeof EVENT_TYPES)[number])
    );
  }
  if (q.severity) conditions.push(eq(auditEvents.severity, q.severity));
  if (q.actorUserId) conditions.push(eq(auditEvents.actorUserId, q.actorUserId));
  if (q.targetUserId) conditions.push(eq(auditEvents.targetUserId, q.targetUserId));
  if (q.cursor) conditions.push(lt(auditEvents.createdAt, new Date(q.cursor)));

  const rows = await db
    .select({
      id: auditEvents.id,
      createdAt: auditEvents.createdAt,
      eventType: auditEvents.eventType,
      severity: auditEvents.severity,
      actorUserId: auditEvents.actorUserId,
      actorEmail: actor.email,
      actorName: actor.name,
      targetUserId: auditEvents.targetUserId,
      targetEmail: target.email,
      targetName: target.name,
      ipHash: auditEvents.ipHash,
      userAgent: auditEvents.userAgent,
      metadataJson: auditEvents.metadataJson,
    })
    .from(auditEvents)
    .leftJoin(actor, eq(actor.id, auditEvents.actorUserId))
    .leftJoin(target, eq(target.id, auditEvents.targetUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(q.limit + 1);

  // We over-fetched by 1 to detect "has next page" without a count query.
  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({
    events: page,
    nextCursor,
  });
}
