import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { pods } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { auditEvent } from "@/lib/audit";
import { joinPod } from "@/lib/pods-server";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), podId: z.string().uuid() }),
  z.object({ action: z.literal("create"), name: z.string().trim().min(2).max(60) }),
]);

// POST /api/pods — join a pod (anyone), or create one (admins).
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  if (body.action === "join") {
    const ok = await joinPod(me.id, body.podId);
    if (!ok) return NextResponse.json({ error: "Pod not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (!me.isAdmin) return NextResponse.json({ error: "Only admins can create pods." }, { status: 403 });
  const [existing] = await db
    .select({ id: pods.id })
    .from(pods)
    .where(sql`lower(${pods.name}) = lower(${body.name})`)
    .limit(1);
  if (existing) return NextResponse.json({ error: "A pod with that name already exists." }, { status: 409 });
  const [pod] = await db.insert(pods).values({ name: body.name, createdById: me.id }).returning({ id: pods.id });
  await auditEvent({
    actorUserId: me.id,
    eventType: "ADMIN_CHANGED_POD",
    request: req,
    metadata: { podId: pod.id, action: "create" },
  });
  return NextResponse.json({ ok: true, id: pod.id });
}
