import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { CheckInForm } from "./form";

export default async function CheckInPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");
  const rows = await db
    .select({
      id: matches.id,
      mentorId: matches.mentorId,
      menteeId: matches.menteeId,
      mentorName: mentor.name,
      menteeName: mentee.name,
    })
    .from(matches)
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(
      and(
        or(eq(matches.mentorId, me.id), eq(matches.menteeId, me.id)),
        eq(matches.status, "active")
      )
    );

  const myMatches = rows.map((m) => {
    const iAmMentor = m.mentorId === me.id;
    return {
      id: m.id,
      role: iAmMentor ? ("mentor" as const) : ("mentee" as const),
      counterpart: iAmMentor ? m.menteeName : m.mentorName,
    };
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Once a month</p>
        <h1 className="mt-1 font-display text-3xl font-black text-navy-800">Monthly check-in</h1>
        <p className="mt-1 text-sm text-slate-600">
          A two-minute pulse so admins know who needs help. Both mentor and mentee answer separately.
        </p>
      </header>

      <div className="card">
        {myMatches.length === 0 ? (
          <p className="text-sm text-slate-500">
            You don&apos;t have a mentor yet. Check-ins appear here once you do.
          </p>
        ) : (
          <CheckInForm matches={myMatches} />
        )}
      </div>
    </div>
  );
}
