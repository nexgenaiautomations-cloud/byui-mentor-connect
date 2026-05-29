import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, meetingLogs, monthlyFeedback, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

export default async function AdminActivityPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");

  const recentLogs = await db
    .select({
      id: meetingLogs.id,
      meetingDate: meetingLogs.meetingDate,
      meetingType: meetingLogs.meetingType,
      durationMinutes: meetingLogs.durationMinutes,
      topicsDiscussed: meetingLogs.topicsDiscussed,
      mentorName: mentor.name,
      menteeName: mentee.name,
    })
    .from(meetingLogs)
    .innerJoin(mentor, eq(mentor.id, meetingLogs.mentorId))
    .innerJoin(mentee, eq(mentee.id, meetingLogs.menteeId))
    .orderBy(desc(meetingLogs.createdAt))
    .limit(25);

  const recentFeedback = await db
    .select({
      id: monthlyFeedback.id,
      submittedAt: monthlyFeedback.submittedAt,
      rating: monthlyFeedback.rating,
      submittedByRole: monthlyFeedback.submittedByRole,
      month: monthlyFeedback.month,
      year: monthlyFeedback.year,
    })
    .from(monthlyFeedback)
    .orderBy(desc(monthlyFeedback.submittedAt))
    .limit(15);

  const [feedbackAvg] = await db
    .select({
      avg: sql<number | null>`(select avg(rating)::numeric(10,2) from "monthly_feedback")`,
      n: sql<number>`(select count(*)::int from "monthly_feedback")`,
    })
    .from(sql`(select 1) as _t`);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Program pulse</p>
        <h1 className="mt-1 font-display text-3xl font-black text-navy-800">Activity</h1>
        <p className="mt-1 text-sm text-slate-600">
          Recent meeting logs and monthly check-ins across the program.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-800">Recent meeting logs</h2>
          {recentLogs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No meetings logged yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentLogs.map((l) => (
                <li key={l.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-navy-800">
                      {l.mentorName} → {l.menteeName}
                    </p>
                    <span className="text-xs text-slate-500">
                      {new Date(l.meetingDate).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 capitalize">
                    {l.meetingType.replace("_", " ")} · {l.durationMinutes ?? "—"} min
                  </p>
                  {l.topicsDiscussed && (
                    <p className="mt-1 line-clamp-1 text-xs text-slate-600">{l.topicsDiscussed}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="card text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg monthly rating</p>
            <p className="mt-1 font-display text-5xl font-black text-navy-800">
              {feedbackAvg?.avg ? Number(feedbackAvg.avg).toFixed(1) : "—"}
            </p>
            <p className="text-xs text-slate-500">across {feedbackAvg?.n ?? 0} check-ins</p>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-bold text-navy-800">Recent check-ins</h2>
            {recentFeedback.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">None yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {recentFeedback.map((f) => (
                  <li key={f.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-700">
                      {f.submittedByRole} · {f.month}/{f.year}
                    </span>
                    <span className="font-bold text-navy-800">{f.rating}/5</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
