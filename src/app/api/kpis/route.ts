import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getStudentKpis } from "@/lib/kpis";

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const targetId = url.searchParams.get("studentId") ?? me.id;

  if (targetId !== me.id) {
    if (!me.isMentor && !me.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

  const kpis = await getStudentKpis(targetId);
  return NextResponse.json({ kpis });
}
