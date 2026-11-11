import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { auditEvent } from "@/lib/audit";
import { pledgeNameMatches } from "@/lib/pledge";

const bodySchema = z.object({ name: z.string().trim().min(2).max(120) });

// POST /api/me/pledge { name } — sign the 3-2-1 pledge by typing your name.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Type your full name to sign." }, { status: 400 });
  }
  const name = parsed.data.name.replace(/\s+/g, " ");
  if (!pledgeNameMatches(name, me)) {
    return NextResponse.json(
      { error: "Please sign with the first and last name on your profile." },
      { status: 400 }
    );
  }

  if (!me.pledgeSignedAt) {
    await db
      .update(users)
      .set({ pledgeSignedName: name, pledgeSignedAt: new Date() })
      .where(eq(users.id, me.id));
    await auditEvent({
      actorUserId: me.id,
      targetUserId: me.id,
      eventType: "USER_SIGNED_PLEDGE",
      request: req,
    });
  }
  return NextResponse.json({ ok: true });
}
