import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { MatchmakerBoard, type MenteeCard, type MentorCard } from "./board";

export default async function AdminMatchmakerPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  // Unassigned mentees = onboarded members, not mentors, not admins, with no
  // currently active match. We don't care about their pending requests here
  // — the admin is the matchmaker.
  const menteeRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      major: users.major,
      expectedGraduation: users.expectedGraduation,
      careerInterests: users.careerInterests,
    })
    .from(users)
    .where(
      and(
        eq(users.isMentor, false),
        eq(users.isAdmin, false),
        sql`${users.onboardedAt} is not null`,
        sql`not exists (select 1 from "match" m where m.mentee_id = "user".id and m.status = 'active')`
      )
    )
    .orderBy(users.name);

  const mentorRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      major: users.major,
      mentorTopics: users.mentorTopics,
      mentorCapacity: users.mentorCapacity,
      activeCount: sql<number>`(select count(*)::int from "match" where mentor_id = "user".id and status = 'active')`,
    })
    .from(users)
    .where(and(eq(users.isMentor, true), eq(users.mentorAvailable, true)))
    .orderBy(users.name);

  const mentees: MenteeCard[] = menteeRows.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    image: m.image,
    major: m.major,
    expectedGraduation: m.expectedGraduation,
    careerInterests: m.careerInterests,
  }));

  const mentors: MentorCard[] = mentorRows.map((m) => {
    const cap = m.mentorCapacity ?? 0;
    const slotsLeft = Math.max(cap - (m.activeCount ?? 0), 0);
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      image: m.image,
      major: m.major,
      topics: m.mentorTopics ?? [],
      activeCount: m.activeCount ?? 0,
      capacity: cap,
      slotsLeft,
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Pairings
        </p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">
          Matchmaker
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {mentees.length} unassigned {mentees.length === 1 ? "mentee" : "mentees"} ·{" "}
          {mentors.length} available {mentors.length === 1 ? "mentor" : "mentors"}.
          Drag a mentor onto a mentee row, then Match — or use Match All.
        </p>
      </header>

      <MatchmakerBoard mentees={mentees} mentors={mentors} />
    </div>
  );
}
