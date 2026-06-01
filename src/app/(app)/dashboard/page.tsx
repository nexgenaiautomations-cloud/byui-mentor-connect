import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, meetingLogs, monthlyFeedback, requests, users } from "@/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";

export default async function DashboardPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const allReqs = await db
    .select()
    .from(requests)
    .where(or(eq(requests.menteeId, me.id), eq(requests.mentorId, me.id)));

  const activeMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        or(eq(matches.mentorId, me.id), eq(matches.menteeId, me.id)),
        eq(matches.status, "active")
      )
    );

  const pendingForMe = allReqs.filter((r) => r.status === "pending" && r.mentorId === me.id);
  const sentByMe = allReqs.filter((r) => r.menteeId === me.id);

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");
  const recentMatches = await db
    .select({
      id: matches.id,
      startedAt: matches.startedAt,
      mentorId: matches.mentorId,
      menteeId: matches.menteeId,
      mentorName: mentor.name,
      mentorImage: mentor.image,
      menteeName: mentee.name,
      menteeImage: mentee.image,
    })
    .from(matches)
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(
      and(
        or(eq(matches.mentorId, me.id), eq(matches.menteeId, me.id)),
        eq(matches.status, "active")
      )
    )
    .orderBy(desc(matches.startedAt))
    .limit(4);

  const [mentorCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.isMentor, true), eq(users.mentorAvailable, true)));

  // Mentor "Your impact" — count of mentees helped (all-time approved matches),
  // total meetings logged, average rating from mentees.
  let impact: {
    menteesHelped: number;
    activeMentees: number;
    meetingsLogged: number;
    totalMinutes: number;
    avgRating: number | null;
    recentTopics: { topicsDiscussed: string | null; meetingDate: Date }[];
  } | null = null;

  if (me.isMentor) {
    const [counts] = await db
      .select({
        menteesHelped: sql<number>`(select count(distinct mentee_id)::int from "match" where mentor_id = ${me.id})`,
        activeMentees: sql<number>`(select count(*)::int from "match" where mentor_id = ${me.id} and status = 'active')`,
        meetingsLogged: sql<number>`(select count(*)::int from "meeting_log" where mentor_id = ${me.id})`,
        totalMinutes: sql<number>`(select coalesce(sum(duration_minutes),0)::int from "meeting_log" where mentor_id = ${me.id})`,
      })
      .from(sql`(select 1) as _t`);

    const [ratingRow] = await db
      .select({
        avg: sql<number | null>`(select avg(rating)::numeric(10,2) from "monthly_feedback" fb where fb.submitted_by_role = 'mentee' and fb.match_id in (select id from "match" where mentor_id = ${me.id}))`,
      })
      .from(sql`(select 1) as _t`);

    const recentTopics = await db
      .select({
        topicsDiscussed: meetingLogs.topicsDiscussed,
        meetingDate: meetingLogs.meetingDate,
      })
      .from(meetingLogs)
      .where(eq(meetingLogs.mentorId, me.id))
      .orderBy(desc(meetingLogs.createdAt))
      .limit(3);

    impact = {
      menteesHelped: counts?.menteesHelped ?? 0,
      activeMentees: counts?.activeMentees ?? 0,
      meetingsLogged: counts?.meetingsLogged ?? 0,
      totalMinutes: counts?.totalMinutes ?? 0,
      avgRating: ratingRow?.avg ? Number(ratingRow.avg) : null,
      recentTopics,
    };
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-navy-700 to-navy-800 p-5 text-white shadow-lift md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-navy-200">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-black tracking-tight md:text-3xl">
            Welcome back, {me.firstName || "friend"}.
          </h1>
          <div className="flex flex-wrap gap-2">
            {me.isMentor ? (
              <Link href="/requests" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-navy-50 cursor-pointer">
                Review requests →
              </Link>
            ) : (
              <>
                <Link href="/mentors" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-navy-50 cursor-pointer">
                  Find a mentor →
                </Link>
                <Link href="/apply-mentor" className="inline-flex items-center justify-center rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-bold text-navy-900 transition hover:bg-gold-400 cursor-pointer">
                  Apply to mentor →
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="mt-2 max-w-xl text-xs text-navy-100">
          {me.isMentor
            ? "You're an approved mentor. Review pending requests, log meetings, and check in monthly."
            : `${mentorCount?.count ?? 0} mentors are accepting requests right now.`}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatTile
          label={me.isMentor ? "Active matches" : "My mentors"}
          value={activeMatches.length}
          hint={
            activeMatches.length
              ? "View contact info"
              : me.isMentor
              ? "Accept your first request"
              : "Find your first mentor"
          }
          href="/matches"
          tone="emerald"
        />
        {me.isMentor ? (
          <StatTile
            label="Requests sent"
            value={sentByMe.length}
            hint={`${sentByMe.filter((r) => r.status === "pending").length} pending`}
            href="/requests"
            tone="navy"
          />
        ) : (
          <StatTile
            label="Pending requests"
            value={sentByMe.filter((r) => r.status === "pending").length}
            hint="See where each request stands"
            href="/matches"
            tone="navy"
          />
        )}
        {me.isMentor ? (
          <StatTile
            label="Pending for me"
            value={pendingForMe.length}
            hint="Review and accept or decline"
            href="/requests"
            tone="amber"
          />
        ) : (
          <StatTile
            label="Mentors available"
            value={mentorCount?.count ?? 0}
            hint="Filter by major and interest"
            href="/mentors"
            tone="gold"
          />
        )}
      </section>

      {impact && (
        <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-emerald-100 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Your impact</p>
              <h2 className="mt-1 font-display text-2xl font-black text-navy-800">
                {impact.menteesHelped === 0
                  ? "Ready for your first mentee?"
                  : impact.menteesHelped === 1
                  ? "You've helped 1 mentee so far."
                  : `You've helped ${impact.menteesHelped} mentees so far.`}
              </h2>
              <p className="mt-1 max-w-prose text-sm text-slate-600">
                {impact.meetingsLogged > 0
                  ? `${impact.meetingsLogged} meeting${impact.meetingsLogged === 1 ? "" : "s"} logged · ${impact.totalMinutes} minutes invested. The kind of compounding that changes someone's career trajectory.`
                  : "Once you log your first meeting, your impact will show up here. Keep it up — peers helping peers is the whole point."}
              </p>
            </div>
            {impact.avgRating !== null && (
              <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-center ring-1 ring-emerald-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Avg rating</p>
                <p className="mt-1 font-display text-3xl font-black text-emerald-700">{impact.avgRating.toFixed(1)}</p>
                <p className="text-[10px] text-emerald-600">from mentee feedback</p>
              </div>
            )}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active mentees</p>
              <p className="mt-1 font-display text-2xl font-bold text-navy-800">
                {impact.activeMentees}{" "}
                <span className="text-sm font-medium text-slate-400">of {me.mentorCapacity ?? 5}</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Meetings logged</p>
              <p className="mt-1 font-display text-2xl font-bold text-navy-800">{impact.meetingsLogged}</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Time invested</p>
              <p className="mt-1 font-display text-2xl font-bold text-navy-800">
                {Math.round(impact.totalMinutes / 60)}h{" "}
                <span className="text-sm font-medium text-slate-400">{impact.totalMinutes % 60}m</span>
              </p>
            </div>
          </div>
          {impact.recentTopics.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Recent meeting highlights
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {impact.recentTopics
                  .filter((t) => t.topicsDiscussed)
                  .map((t, i) => (
                    <li key={i} className="flex gap-2 text-slate-700">
                      <span className="text-emerald-600">✓</span>
                      <span className="line-clamp-1">{t.topicsDiscussed}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy-800">Your matches</h2>
            <Link href="/matches" className="text-xs font-semibold text-navy-700 hover:underline">
              View all →
            </Link>
          </div>
          {recentMatches.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No active matches yet. Browse mentors and send a request.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentMatches.map((m) => {
                const iAmMentor = m.mentorId === me.id;
                const other = iAmMentor
                  ? { name: m.menteeName, image: m.menteeImage }
                  : { name: m.mentorName, image: m.mentorImage };
                return (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={other.image || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(other.name || "")}&backgroundColor=1B3A6B&textColor=ffffff`}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy-800">{other.name}</p>
                      <p className="text-xs text-slate-500">
                        {iAmMentor ? "Mentee" : "Mentor"} · matched {new Date(m.startedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Link href="/matches" className="text-xs font-semibold text-navy-700 hover:underline">
                      Open
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-bold text-navy-800">Quick actions</h2>
          <div className="mt-4 space-y-2">
            {(me.isMentor
              ? [
                  { href: "/requests", title: "Review requests", body: "Accept or decline pending mentees." },
                  { href: "/matches", title: "Your mentees", body: "Contact info and meeting history." },
                  { href: "/log-meeting", title: "Log an activity", body: "Track what you did together and next steps." },
                  { href: "/profile", title: "Update profile", body: "Photo, bio, career interests." },
                ]
              : [
                  { href: "/mentors", title: "Find a mentor", body: "Filter, browse, request." },
                  { href: "/matches", title: "My Mentors", body: "Active mentors and pending requests." },
                  { href: "/apply-mentor", title: "Apply to mentor", body: "Pay it forward." },
                  { href: "/profile", title: "Update profile", body: "Photo, bio, career interests." },
                ]
            ).map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="block rounded-xl border border-slate-100 p-3 transition hover:border-navy-200 hover:bg-navy-50/40 cursor-pointer"
              >
                <p className="text-sm font-semibold text-navy-800">{a.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{a.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
