import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { monthlyFeedback, users, matches } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";

export default async function AdminFeedbackPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");
  const submitter = alias(users, "submitter_u");

  const fb = await db
    .select({
      id: monthlyFeedback.id,
      rating: monthlyFeedback.rating,
      month: monthlyFeedback.month,
      year: monthlyFeedback.year,
      submittedAt: monthlyFeedback.submittedAt,
      submittedByRole: monthlyFeedback.submittedByRole,
      submitterName: submitter.name,
      submitterImage: submitter.image,
      mentorName: mentor.name,
      menteeName: mentee.name,
    })
    .from(monthlyFeedback)
    .innerJoin(matches, eq(matches.id, monthlyFeedback.matchId))
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .innerJoin(submitter, eq(submitter.id, monthlyFeedback.submittedByUserId))
    .orderBy(desc(monthlyFeedback.submittedAt))
    .limit(100);

  const [stats] = await db
    .select({
      avg: sql<number | null>`(select avg(rating)::numeric(10,2) from "monthly_feedback")`,
      n: sql<number>`(select count(*)::int from "monthly_feedback")`,
      thisMonth: sql<number>`(select count(*)::int from "monthly_feedback" where submitted_at >= now() - interval '30 days')`,
      fivesPct: sql<number>`(select coalesce(round(100.0 * sum(case when rating = 5 then 1 else 0 end) / nullif(count(*), 0)), 0)::int from "monthly_feedback")`,
    })
    .from(sql`(select 1) as _t`);

  const avg = stats?.avg ? Number(stats.avg) : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Pulse</p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">Feedback</h1>
        <p className="mt-1 text-sm text-slate-600">
          Monthly check-ins from both sides of every match.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Avg rating" value={avg !== null ? avg.toFixed(1) : "—"} tone="emerald" />
        <StatTile label="5-star %" value={`${stats?.fivesPct ?? 0}%`} tone="emerald" />
        <StatTile label="Total responses" value={stats?.n ?? 0} tone="navy" />
        <StatTile label="Last 30 days" value={stats?.thisMonth ?? 0} tone="sky" />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-navy-800">Recent responses</h2>
        {fb.length === 0 ? (
          <p className="text-sm text-slate-500">No check-ins yet.</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <ul className="divide-y divide-slate-100">
              {fb.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      f.submitterImage ||
                      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(f.submitterName ?? "?")}&backgroundColor=1B3A6B&textColor=ffffff`
                    }
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-800">
                      {f.submitterName} <span className="font-normal text-slate-500">({f.submittedByRole})</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {f.mentorName} → {f.menteeName} · {f.month}/{f.year}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={i < f.rating ? "text-amber-500" : "text-slate-200"}
                      >
                        ★
                      </span>
                    ))}
                    <span className="ml-1 text-xs font-bold text-navy-800">{f.rating}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
