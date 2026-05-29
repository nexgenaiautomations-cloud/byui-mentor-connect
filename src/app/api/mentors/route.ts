import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const major = url.searchParams.get("major");
  const semester = url.searchParams.get("semester");

  const conditions = [eq(users.isMentor, true), eq(users.mentorAvailable, true), ne(users.id, me.id)];
  if (major) conditions.push(eq(users.major, major));
  if (semester) conditions.push(eq(users.semesterLevel, semester));

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      major: users.major,
      minor: users.minor,
      semesterLevel: users.semesterLevel,
      expectedGraduation: users.expectedGraduation,
      bio: users.bio,
      careerInterests: users.careerInterests,
      mentorTopics: users.mentorTopics,
      mentorCapacity: users.mentorCapacity,
    })
    .from(users)
    .where(and(...conditions))
    .limit(100);

  return NextResponse.json({ mentors: rows });
}
