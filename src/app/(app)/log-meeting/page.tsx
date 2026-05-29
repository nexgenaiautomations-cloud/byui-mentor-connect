import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users, meetingLogs } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { LogMeetingForm } from "./form";

export default async function LogMeetingPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");
  if (!me.isMentor) redirect("/dashboard");

  const mentee = alias(users, "mentee_u");
  const myMatches = await db
    .select({
      id: matches.id,
      menteeId: matches.menteeId,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      startedAt: matches.startedAt,
    })
    .from(matches)
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(and(eq(matches.mentorId, me.id), eq(matches.status, "active")));

  const recent = await db
    .select()
    .from(meetingLogs)
    .where(eq(meetingLogs.mentorId, me.id))
    .orderBy(desc(meetingLogs.createdAt))
    .limit(5);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mentor tools</p>
        <h1 className="mt-1 font-display text-3xl font-black text-navy-800">Log a meeting</h1>
        <p className="mt-1 text-sm text-slate-600">
          After every session, capture what happened. Logs flow to the admin dashboard — your private notes stay private.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          {myMatches.length === 0 ? (
            <p className="text-sm text-slate-500">
              You don&apos;t have any active matches yet. Once a mentee&apos;s request is accepted, log meetings here.
            </p>
          ) : (
            <LogMeetingForm matches={myMatches} />
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-800">Recent logs</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No meetings logged yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recent.map((l) => (
                <li key={l.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy-800">
                      {new Date(l.meetingDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                    <span className="pill capitalize">{l.meetingType.replace("_", " ")}</span>
                  </div>
                  {l.topicsDiscussed && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{l.topicsDiscussed}</p>
                  )}
                  {l.durationMinutes && (
                    <p className="mt-1 text-[11px] text-slate-400">{l.durationMinutes} minutes</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
