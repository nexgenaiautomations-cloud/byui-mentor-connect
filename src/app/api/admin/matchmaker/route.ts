import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { matches, users } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { auditEvent } from "@/lib/audit";

const pairSchema = z.object({
  mentorId: z.string().min(1),
  menteeId: z.string().min(1),
});

const bodySchema = z.union([
  pairSchema,
  z.object({ pairs: z.array(pairSchema).min(1) }),
]);

type Pair = z.infer<typeof pairSchema>;

// POST /api/admin/matchmaker
// Body: { mentorId, menteeId } OR { pairs: [...] }
// Returns the created matches. Skips pairs that would violate either:
//   - the mentee already has an active match
//   - the mentor would exceed their declared capacity
// so a single failure inside Match All doesn't roll the whole batch back.
export async function POST(req: Request) {
  const adminOrResp = await requireAdmin(req);
  if (adminOrResp instanceof Response) return adminOrResp;
  const admin = adminOrResp;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const pairs: Pair[] = "pairs" in parsed.data ? parsed.data.pairs : [parsed.data];

  const created: { id: string; mentorId: string; menteeId: string }[] = [];
  const skipped: { mentorId: string; menteeId: string; reason: string }[] = [];

  for (const p of pairs) {
    const [mentor] = await db
      .select({
        id: users.id,
        isMentor: users.isMentor,
        capacity: users.mentorCapacity,
        active: sql<number>`(select count(*)::int from "match" where mentor_id = "user".id and status = 'active')`,
      })
      .from(users)
      .where(eq(users.id, p.mentorId))
      .limit(1);

    if (!mentor || !mentor.isMentor) {
      skipped.push({ ...p, reason: "Mentor not found" });
      continue;
    }
    const cap = mentor.capacity ?? 0;
    if (cap > 0 && mentor.active >= cap) {
      skipped.push({ ...p, reason: "Mentor is at capacity" });
      continue;
    }

    const [existing] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.menteeId, p.menteeId), eq(matches.status, "active")))
      .limit(1);
    if (existing) {
      skipped.push({ ...p, reason: "Mentee already has an active match" });
      continue;
    }

    const [row] = await db
      .insert(matches)
      .values({ mentorId: p.mentorId, menteeId: p.menteeId })
      .returning({ id: matches.id, mentorId: matches.mentorId, menteeId: matches.menteeId });
    if (row) created.push(row);
  }

  // Bulk audit at the end, in parallel. Awaiting inside the loop would have
  // added a Neon round-trip per pair (a 50-pair batch would tack on ~5s of
  // audit latency). auditEvent itself never throws, so Promise.all here is
  // safe even if a single insert fails.
  await Promise.all(
    created.map((row) =>
      auditEvent({
        actorUserId: admin.id,
        targetUserId: row.menteeId,
        eventType: "ADMIN_CREATED_MATCH",
        severity: "info",
        request: req,
        metadata: { matchId: row.id, mentorId: row.mentorId },
      })
    )
  );

  return NextResponse.json({ created, skipped });
}
