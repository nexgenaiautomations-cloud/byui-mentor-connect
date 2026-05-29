import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { matches } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db
    .select()
    .from(matches)
    .where(or(eq(matches.mentorId, me.id), eq(matches.menteeId, me.id)));
  return NextResponse.json({ matches: rows });
}
