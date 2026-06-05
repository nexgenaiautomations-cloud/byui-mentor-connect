import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { MatchmakerBoard, type MenteeCard, type MentorCard } from "./board";

// Score how well a mentor fits a mentee. Higher = better. Returns null when
// the mentor has zero remaining slots — those are filtered out.
function suggestionScore(mentee: MenteeCard, mentor: MentorCard): number | null {
  if (mentor.slotsLeft <= 0) return null;
  let score = 0;
  if (mentee.major && mentor.major && mentee.major === mentor.major) {
    score += 100;
  }
  const interests = new Set((mentee.careerInterests ?? []).map((s) => s.toLowerCase()));
  const topics = new Set(mentor.topics.map((s) => s.toLowerCase()));
  for (const t of topics) {
    if (interests.has(t)) score += 10;
  }
  // Tiny tiebreaker — prefer mentors with more remaining capacity so we
  // spread the load instead of stuffing the first slot.
  score += Math.min(mentor.slotsLeft, 5) * 0.1;
  return score;
}

// Greedy seed: walk mentees in stable order; for each, pick the highest-
// scoring mentor that still has a tentative slot left after earlier picks.
// Deterministic so refreshing the page doesn't shuffle the board.
function seedAssignments(
  mentees: MenteeCard[],
  mentors: MentorCard[]
): Record<string, string> {
  const remaining = new Map<string, number>();
  for (const m of mentors) remaining.set(m.id, m.slotsLeft);
  const assignments: Record<string, string> = {};

  for (const mentee of mentees) {
    let bestId: string | null = null;
    let bestScore = -Infinity;
    for (const mentor of mentors) {
      if ((remaining.get(mentor.id) ?? 0) <= 0) continue;
      const s = suggestionScore(mentee, mentor);
      if (s === null) continue;
      if (s <= 0) continue; // skip pairs with no signal at all
      if (s > bestScore) {
        bestScore = s;
        bestId = mentor.id;
      }
    }
    if (bestId) {
      assignments[mentee.id] = bestId;
      remaining.set(bestId, (remaining.get(bestId) ?? 0) - 1);
    }
  }
  return assignments;
}

export default async function AdminMatchmakerPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

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

  const initialAssignments = seedAssignments(mentees, mentors);

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
          We pre-suggest matches by major and career interest — adjust by drag, then Match.
        </p>
      </header>

      <MatchmakerBoard
        mentees={mentees}
        mentors={mentors}
        initialAssignments={initialAssignments}
      />
    </div>
  );
}
