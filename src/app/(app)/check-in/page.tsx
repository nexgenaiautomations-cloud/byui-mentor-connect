import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, monthlyFeedback, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { readActiveRole } from "@/lib/roles-server";
import { CheckInForm } from "./form";

export default async function CheckInPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");
  if (me.isAdmin && !me.isMentor) redirect("/admin");
  // Monthly Check-in is mentee-only now — mentors viewing this page get
  // bounced back to their dashboard. The page still serves mentees who
  // submit feedback on their mentor.
  const activeRole = await readActiveRole(me);
  if (activeRole === "mentor") redirect("/dashboard");

  const mentee = alias(users, "mentee_u");
  const mentor = alias(users, "mentor_u");

  const myMatches = await db
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
      and(eq(matches.menteeId, me.id), eq(matches.status, "active"))
    );

  // Which matches already have feedback from me this month?
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const matchIds = myMatches.map((m) => m.id);
  const alreadySubmitted = matchIds.length
    ? await db
        .select({ matchId: monthlyFeedback.matchId })
        .from(monthlyFeedback)
        .where(
          and(
            inArray(monthlyFeedback.matchId, matchIds),
            eq(monthlyFeedback.submittedByUserId, me.id),
            eq(monthlyFeedback.month, month),
            eq(monthlyFeedback.year, year)
          )
        )
    : [];
  const submittedSet = new Set(alreadySubmitted.map((s) => s.matchId));

  const options = myMatches.map((m) => ({
    id: m.id,
    counterpart: m.mentorName,
    alreadySubmitted: submittedSet.has(m.id),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-byui-blue-dark">
          Monthly Check-in
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Quick pulse on how mentoring is going. Submit once per match per month.
        </p>
      </header>

      {options.length === 0 ? (
        <div className="card">
          <p className="text-sm text-slate-600">
            You don&apos;t have an active match yet. Once you do, check-ins appear here.
          </p>
        </div>
      ) : (
        <CheckInForm
          options={options}
          month={month}
          year={year}
        />
      )}
    </div>
  );
}
