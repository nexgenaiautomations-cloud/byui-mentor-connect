import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listAchievementsForStudent } from "@/lib/achievements";

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Mentors can read a specific mentee's achievements via ?studentId=...,
  // but only if there's an active match. Otherwise default to self.
  const url = new URL(req.url);
  const targetId = url.searchParams.get("studentId") ?? me.id;

  if (targetId !== me.id) {
    // Authorization handled inline rather than in the lib so the lib stays
    // pure DB and reusable from server components.
    if (!me.isMentor && !me.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Mentor must be matched (or admin).
    if (!me.isAdmin) {
      const { db } = await import("@/db/client");
      const { matches } = await import("@/db/schema");
      const { and, eq } = await import("drizzle-orm");
      const [m] = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.menteeId, targetId),
            eq(matches.mentorId, me.id),
            eq(matches.status, "active")
          )
        )
        .limit(1);
      if (!m) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const achievements = await listAchievementsForStudent(targetId);
  return NextResponse.json({ achievements });
}
