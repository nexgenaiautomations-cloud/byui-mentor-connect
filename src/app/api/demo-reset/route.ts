import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { matches, requests } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { seedDemo } from "@/db/seed";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.DEMO_ENABLED !== "true") {
    return NextResponse.json({ error: "Demo reset disabled" }, { status: 403 });
  }

  try {
    await seedDemo();
  } catch (e) {
    console.error("demo-reset failed", e);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }

  // Return Morgan's post-seed counts so the UI (and humans debugging the demo)
  // can verify the reset took effect. If Morgan is missing for any reason,
  // skip the verification block instead of failing the whole reset.
  const [morgan] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "mentor.demo@byui.edu"))
    .limit(1);

  if (!morgan) return NextResponse.json({ ok: true });

  const [activeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(and(eq(matches.mentorId, morgan.id), eq(matches.status, "active")));
  const [pendingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(requests)
    .where(and(eq(requests.mentorId, morgan.id), eq(requests.status, "pending")));

  return NextResponse.json({
    ok: true,
    mentorDemo: {
      activeMatches: activeRow?.count ?? 0,
      pendingRequests: pendingRow?.count ?? 0,
    },
  });
}
