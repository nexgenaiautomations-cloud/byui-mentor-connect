import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users, meetingLogs } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { LogMeetingForm } from "./form";

export default async function LogMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ matchId?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");
  if (!me.isMentor) redirect("/dashboard");
  const { matchId: preselectMatchId } = await searchParams;

  const mentee = alias(users, "mentee_u");
  const myMatches = await db
    .select({
      id: matches.id,
      menteeId: matches.menteeId,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      menteeMajor: mentee.major,
      startedAt: matches.startedAt,
    })
    .from(matches)
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(and(eq(matches.mentorId, me.id), eq(matches.status, "active")));

  const recentMentee = alias(users, "recent_mentee_u");
  const recent = await db
    .select({
      id: meetingLogs.id,
      meetingDate: meetingLogs.meetingDate,
      meetingType: meetingLogs.meetingType,
      durationMinutes: meetingLogs.durationMinutes,
      topicsDiscussed: meetingLogs.topicsDiscussed,
      menteeName: recentMentee.name,
    })
    .from(meetingLogs)
    .innerJoin(recentMentee, eq(recentMentee.id, meetingLogs.menteeId))
    .where(eq(meetingLogs.mentorId, me.id))
    .orderBy(desc(meetingLogs.meetingDate), desc(meetingLogs.createdAt))
    .limit(5);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mentor tools</p>
        <h1 className="mt-1 font-display text-3xl font-black text-byui-blue-dark">Log an activity</h1>
        <p className="mt-1 text-sm text-slate-600">
          After every meeting, call, or career event together, capture what happened.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          {myMatches.length === 0 ? (
            <p className="text-sm text-slate-500">
              You don&apos;t have any active mentees yet. Once a mentee&apos;s request is accepted, log activities here.
            </p>
          ) : (
            <LogMeetingForm matches={myMatches} initialMatchId={preselectMatchId} />
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-bold text-byui-blue-dark">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No activities logged yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recent.map((l) => (
                <li key={l.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-byui-blue-dark">
                      {new Date(l.meetingDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <span className="inline-flex items-center rounded-full bg-byui-blue-light/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-byui-blue-dark capitalize">
                      {l.meetingType.replace("_", " ")}
                    </span>
                  </div>
                  {l.menteeName && (
                    <p className="mt-0.5 text-xs font-medium text-slate-700">
                      {l.menteeName}
                    </p>
                  )}
                  {l.durationMinutes ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {l.durationMinutes} minutes
                    </p>
                  ) : null}
                  {l.topicsDiscussed && (
                    <p className="mt-1 text-xs leading-snug text-slate-700">
                      {l.topicsDiscussed
                        .split(" · ")
                        .filter(Boolean)
                        .join(", ")}
                    </p>
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
