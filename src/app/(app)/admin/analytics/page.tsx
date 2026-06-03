import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import {
  meetingLogs,
  monthlyFeedback,
  matches,
  requests,
  users,
} from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";
import {
  MonthlyLine,
  MonthlyBars,
  HBarList,
  Donut,
  DeltaPill,
} from "@/components/charts";

export const dynamic = "force-dynamic";

type Bucket = { label: string; value: number };

// Build the last N month buckets in chronological order (oldest first).
function monthBuckets(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      label: d.toLocaleString(undefined, { month: "short" }),
    });
  }
  return out;
}

function alignToBuckets(
  buckets: { key: string; label: string }[],
  rows: { key: string; value: number }[]
): Bucket[] {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return buckets.map((b) => ({ label: b.label, value: m.get(b.key) ?? 0 }));
}

export default async function AnalyticsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const buckets = monthBuckets(12);
  const monthsBack = buckets[0].key; // unused server-side, kept for clarity
  void monthsBack;

  // -------- Monthly series (12 mo) --------
  const requestsByMonth = await db.execute(sql<{ key: string; value: number }>`
    select to_char(date_trunc('month', requested_at), 'YYYY-MM') as key,
           count(*)::int as value
      from "request"
     where requested_at >= now() - interval '12 months'
     group by 1
     order by 1
  `);

  const acceptedByMonth = await db.execute(sql<{ key: string; value: number }>`
    select to_char(date_trunc('month', requested_at), 'YYYY-MM') as key,
           count(*)::int as value
      from "request"
     where requested_at >= now() - interval '12 months'
       and status = 'accepted'
     group by 1
     order by 1
  `);

  const matchesByMonth = await db.execute(sql<{ key: string; value: number }>`
    select to_char(date_trunc('month', started_at), 'YYYY-MM') as key,
           count(*)::int as value
      from "match"
     where started_at >= now() - interval '12 months'
     group by 1
     order by 1
  `);

  const meetingsByMonth = await db.execute(sql<{ key: string; value: number }>`
    select to_char(date_trunc('month', meeting_date), 'YYYY-MM') as key,
           count(*)::int as value
      from "meeting_log"
     where meeting_date >= now() - interval '12 months'
     group by 1
     order by 1
  `);

  const minutesByMonth = await db.execute(sql<{ key: string; value: number }>`
    select to_char(date_trunc('month', meeting_date), 'YYYY-MM') as key,
           coalesce(sum(duration_minutes),0)::int as value
      from "meeting_log"
     where meeting_date >= now() - interval '12 months'
     group by 1
     order by 1
  `);

  const ratingByMonth = await db.execute(sql<{ key: string; value: number }>`
    select to_char(make_date(year, month, 1), 'YYYY-MM') as key,
           round(avg(rating)::numeric, 2)::float as value
      from "monthly_feedback"
     where make_date(year, month, 1) >= date_trunc('month', now()) - interval '11 months'
     group by 1
     order by 1
  `);

  const newMembersByMonth = await db.execute(sql<{ key: string; value: number }>`
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as key,
           count(*)::int as value
      from "user"
     where created_at >= now() - interval '12 months'
     group by 1
     order by 1
  `);

  const requestsSeries = alignToBuckets(buckets, requestsByMonth.rows as { key: string; value: number }[]);
  const acceptedSeries = alignToBuckets(buckets, acceptedByMonth.rows as { key: string; value: number }[]);
  const matchesSeries = alignToBuckets(buckets, matchesByMonth.rows as { key: string; value: number }[]);
  const meetingsSeries = alignToBuckets(buckets, meetingsByMonth.rows as { key: string; value: number }[]);
  const minutesSeries = alignToBuckets(buckets, minutesByMonth.rows as { key: string; value: number }[]);
  const ratingSeries = alignToBuckets(buckets, ratingByMonth.rows as { key: string; value: number }[]);
  const newMembersSeries = alignToBuckets(buckets, newMembersByMonth.rows as { key: string; value: number }[]);

  // Per-month acceptance rate (accepted / total requested in that month)
  const acceptanceRateSeries: Bucket[] = requestsSeries.map((r, i) => {
    const acc = acceptedSeries[i]?.value ?? 0;
    return {
      label: r.label,
      value: r.value > 0 ? Math.round((acc / r.value) * 100) : 0,
    };
  });

  // -------- KPIs + month-over-month --------
  const [headline] = await db
    .select({
      members: sql<number>`(select count(*)::int from "user")`,
      mentors: sql<number>`(select count(*)::int from "user" where is_mentor = true)`,
      activeMatches: sql<number>`(select count(*)::int from "match" where status = 'active')`,
      pendingRequests: sql<number>`(select count(*)::int from "request" where status = 'pending')`,
      pendingApps: sql<number>`(select count(*)::int from "mentor_application" where status = 'pending')`,
      capacityTotal: sql<number>`(select coalesce(sum(coalesce(mentor_capacity,5)),0)::int from "user" where is_mentor = true and mentor_available = true)`,
    })
    .from(sql`(select 1) as _t`);

  // This month vs last month — for MoM deltas
  const thisMonth = meetingsSeries[meetingsSeries.length - 1]?.value ?? 0;
  const lastMonth = meetingsSeries[meetingsSeries.length - 2]?.value ?? 0;
  const ratingThis = ratingSeries[ratingSeries.length - 1]?.value ?? 0;
  const ratingPrev = ratingSeries[ratingSeries.length - 2]?.value ?? 0;
  const accThis = acceptanceRateSeries[acceptanceRateSeries.length - 1]?.value ?? 0;
  const accPrev = acceptanceRateSeries[acceptanceRateSeries.length - 2]?.value ?? 0;
  const membersThis = newMembersSeries[newMembersSeries.length - 1]?.value ?? 0;
  const membersPrev = newMembersSeries[newMembersSeries.length - 2]?.value ?? 0;
  const matchesThis = matchesSeries[matchesSeries.length - 1]?.value ?? 0;
  const matchesPrev = matchesSeries[matchesSeries.length - 2]?.value ?? 0;

  // -------- Distributions --------
  const topMajors = await db.execute(sql<{ label: string; value: number }>`
    select coalesce(major, 'Unknown') as label, count(*)::int as value
      from "user"
     where is_mentor = true
     group by 1
     order by value desc
     limit 8
  `);

  const semesterDistribution = await db.execute(sql<{ label: string; value: number }>`
    select coalesce(semester_level, 'Unknown') as label, count(*)::int as value
      from "user"
     group by 1
     order by case label
                when 'Freshman' then 1
                when 'Sophomore' then 2
                when 'Junior' then 3
                when 'Senior' then 4
                when 'Graduate' then 5
                else 99
              end
  `);

  const meetingTypes = await db.execute(sql<{ label: string; value: number }>`
    select meeting_type::text as label, count(*)::int as value
      from "meeting_log"
     group by 1
     order by value desc
  `);

  const topInterests = await db.execute(sql<{ label: string; value: number }>`
    select interest as label, count(*)::int as value
      from (select unnest(career_interests) as interest from "user") s
     where interest is not null
     group by 1
     order by value desc
     limit 8
  `);

  // -------- Engagement / at-risk --------
  const [atRisk] = await db
    .select({
      stale30: sql<number>`(select count(*)::int from "match" where status = 'active' and last_activity_at < now() - interval '30 days')`,
      stale60: sql<number>`(select count(*)::int from "match" where status = 'active' and last_activity_at < now() - interval '60 days')`,
      capacityFilled: sql<number>`(select count(*)::int from "match" where status = 'active')`,
    })
    .from(sql`(select 1) as _t`);

  // Top mentors by active mentees this period (vs capacity)
  const topMentors = await db
    .select({
      id: users.id,
      name: users.name,
      capacity: users.mentorCapacity,
      active: sql<number>`(select count(*)::int from "match" m where m.mentor_id = ${users.id} and m.status = 'active')`,
      lifetime: sql<number>`(select count(distinct m.mentee_id)::int from "match" m where m.mentor_id = ${users.id})`,
    })
    .from(users)
    .where(eq(users.isMentor, true))
    .orderBy(desc(sql`(select count(*)::int from "match" m where m.mentor_id = ${users.id} and m.status = 'active')`))
    .limit(6);

  // -------- Recent activity feed --------
  const recentRequests = await db
    .select({
      id: requests.id,
      at: requests.requestedAt,
      status: requests.status,
      menteeName: users.name,
    })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.menteeId))
    .orderBy(desc(requests.requestedAt))
    .limit(8);

  const recentMatches = await db
    .select({
      id: matches.id,
      at: matches.startedAt,
    })
    .from(matches)
    .orderBy(desc(matches.startedAt))
    .limit(4);

  const recentMeetings = await db
    .select({
      id: meetingLogs.id,
      at: meetingLogs.meetingDate,
      topic: meetingLogs.topicsDiscussed,
    })
    .from(meetingLogs)
    .orderBy(desc(meetingLogs.meetingDate))
    .limit(6);

  // Overall acceptance rate (last 12 mo)
  const totalReq12 = requestsSeries.reduce((s, p) => s + p.value, 0);
  const totalAcc12 = acceptedSeries.reduce((s, p) => s + p.value, 0);
  const overallAcceptance = totalReq12 > 0 ? Math.round((totalAcc12 / totalReq12) * 100) : 0;

  const capFilled = atRisk?.capacityFilled ?? 0;
  const capTotal = headline?.capacityTotal ?? 0;

  // -------- Render --------
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Program</p>
          <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Monthly trends, distributions, and at-risk signals across the program.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link href="/admin" className="btn-outline">Overview</Link>
          <Link href="/admin/meetings" className="btn-outline">Meetings</Link>
          <Link href="/admin/feedback" className="btn-outline">Feedback</Link>
        </div>
      </header>

      {/* KPI band */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Members"      value={headline?.members ?? 0}        tone="navy"    hint="Registered" />
        <StatTile label="Mentors"      value={headline?.mentors ?? 0}        tone="emerald" hint="Approved" />
        <StatTile label="Active matches" value={headline?.activeMatches ?? 0} tone="sky"   hint="Right now" />
        <StatTile label="Pending"      value={headline?.pendingRequests ?? 0} tone="navy"   hint="Requests" />
        <StatTile label="To review"    value={headline?.pendingApps ?? 0}    tone="amber"   hint="Applications" />
        <StatTile label="Avg rating"   value={ratingThis ? ratingThis.toFixed(2) : "—"} tone="emerald" hint="This month" />
      </section>

      {/* Month-over-month deltas */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-navy-800">Month over month</h2>
          <span className="text-xs text-slate-500">Last 12 months in trend</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MoMTile
            label="New members"
            value={membersThis}
            previous={membersPrev}
            series={newMembersSeries}
            color="#1B3A6B"
            goodWhen="up"
          />
          <MoMTile
            label="New matches"
            value={matchesThis}
            previous={matchesPrev}
            series={matchesSeries}
            color="#006EB6"
            goodWhen="up"
          />
          <MoMTile
            label="Meetings logged"
            value={thisMonth}
            previous={lastMonth}
            series={meetingsSeries}
            color="#0F766E"
            goodWhen="up"
          />
          <MoMTile
            label="Acceptance rate"
            value={accThis}
            previous={accPrev}
            series={acceptanceRateSeries}
            color="#4F9ACF"
            asPercentPoints
            goodWhen="up"
            valueSuffix="%"
          />
        </div>
      </section>

      {/* Trends */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Requests submitted" subtitle="By month, last 12">
          <MonthlyBars points={requestsSeries} color="#4F9ACF" />
        </ChartCard>
        <ChartCard title="Requests accepted" subtitle="By month, last 12">
          <MonthlyBars points={acceptedSeries} color="#0F766E" />
        </ChartCard>
        <ChartCard title="Meeting minutes" subtitle="Total time logged per month">
          <MonthlyLine
            points={minutesSeries}
            color="#214491"
            format={(n) => `${Math.round(n / 60)}h`}
            unit=""
          />
        </ChartCard>
        <ChartCard title="Avg feedback rating" subtitle="Mentee + mentor monthly check-ins">
          <MonthlyLine
            points={ratingSeries}
            color="#006EB6"
            format={(n) => n.toFixed(2)}
          />
        </ChartCard>
      </section>

      {/* Mentor utilization + at-risk */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
        <div className="card">
          <h3 className="font-display text-base font-bold text-navy-800">Capacity utilization</h3>
          <p className="mt-1 text-xs text-slate-500">Active matches vs total mentor capacity</p>
          <div className="mt-3 flex items-center gap-4">
            <Donut value={capFilled} total={Math.max(1, capTotal)} color="#006EB6" />
            <div className="text-sm">
              <p className="font-display text-2xl font-black text-navy-800">
                {capFilled}<span className="text-base font-medium text-slate-400"> / {capTotal}</span>
              </p>
              <p className="text-xs text-slate-500">slots filled</p>
            </div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-display text-base font-bold text-navy-800">At-risk matches</h3>
          <p className="mt-1 text-xs text-slate-500">No activity in 30/60 days</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <RiskTile label="30d stale" value={atRisk?.stale30 ?? 0} tone="amber" />
            <RiskTile label="60d stale" value={atRisk?.stale60 ?? 0} tone="rose" />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            6-month inactive matches auto-end. 30-day stale gets a nudge email.
          </p>
        </div>
        <div className="card">
          <h3 className="font-display text-base font-bold text-navy-800">Top mentors (active load)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {topMentors.length === 0 && <li className="text-xs text-slate-400">No mentors yet.</li>}
            {topMentors.map((m) => {
              const cap = m.capacity ?? 5;
              const pct = cap > 0 ? Math.min(100, Math.round((m.active / cap) * 100)) : 0;
              return (
                <li key={m.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-semibold text-navy-800">{m.name}</span>
                    <span className="font-bold text-slate-700">
                      {m.active}/{cap} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${Math.max(2, pct)}%`, background: "#006EB6" }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">{m.lifetime} mentees lifetime</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Distributions */}
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Mentors by major" subtitle="Top 8">
          <HBarList rows={topMajors.rows as { label: string; value: number }[]} color="#006EB6" />
        </ChartCard>
        <ChartCard title="Members by semester" subtitle="Class composition">
          <HBarList rows={semesterDistribution.rows as { label: string; value: number }[]} color="#214491" />
        </ChartCard>
        <ChartCard title="Top career interests" subtitle="Across all members">
          <HBarList rows={topInterests.rows as { label: string; value: number }[]} color="#4F9ACF" />
        </ChartCard>
        <ChartCard title="Meeting types" subtitle="Format breakdown">
          <HBarList rows={meetingTypes.rows as { label: string; value: number }[]} color="#A0D4ED" />
        </ChartCard>
      </section>

      {/* Overall acceptance + activity feed */}
      <section className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="card">
          <h3 className="font-display text-base font-bold text-navy-800">Acceptance rate (12 mo)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Of {totalReq12} requests submitted in the last year
          </p>
          <div className="mt-3 flex items-center gap-4">
            <Donut value={totalAcc12} total={Math.max(1, totalReq12)} color="#006EB6" />
            <div className="text-sm">
              <p className="font-display text-2xl font-black text-navy-800">
                {overallAcceptance}%
              </p>
              <p className="text-xs text-slate-500">{totalAcc12} accepted</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Monthly rate</p>
            <MonthlyLine points={acceptanceRateSeries} color="#006EB6" format={(n) => `${n}%`} />
          </div>
        </div>

        <div className="card">
          <h3 className="font-display text-base font-bold text-navy-800">Recent activity</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ...recentRequests.map((r) => ({
                kind: "request" as const,
                at: r.at,
                text: `${r.menteeName} requested a mentor`,
                status: r.status,
              })),
              ...recentMatches.map((m) => ({
                kind: "match" as const,
                at: m.at,
                text: "Match opened",
              })),
              ...recentMeetings.map((m) => ({
                kind: "meeting" as const,
                at: m.at,
                text: m.topic ? `Meeting logged: ${m.topic.slice(0, 80)}` : "Meeting logged",
              })),
            ]
              .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
              .slice(0, 10)
              .map((e, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-navy-800">{e.text}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      {e.kind}
                      {"status" in e ? ` · ${e.status}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {new Date(e.at).toLocaleDateString()}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        All counts are live. Series cover the trailing 12 calendar months including the current one.
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-bold text-navy-800">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MoMTile({
  label,
  value,
  previous,
  series,
  color,
  asPercentPoints,
  goodWhen,
  valueSuffix = "",
}: {
  label: string;
  value: number;
  previous: number;
  series: Bucket[];
  color: string;
  asPercentPoints?: boolean;
  goodWhen?: "up" | "down";
  valueSuffix?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <DeltaPill
          current={value}
          previous={previous}
          asPercentPoints={asPercentPoints}
          goodWhen={goodWhen}
        />
      </div>
      <p className="mt-1 font-display text-2xl font-black text-navy-800">
        {value}
        {valueSuffix}
      </p>
      <div className="mt-1">
        <MonthlyLine points={series} color={color} height={48} />
      </div>
    </div>
  );
}

function RiskTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "rose";
}) {
  const bg = tone === "amber" ? "bg-amber-50 ring-amber-200" : "bg-rose-50 ring-rose-200";
  const fg = tone === "amber" ? "text-amber-800" : "text-rose-800";
  return (
    <div className={`rounded-xl p-3 ring-1 ${bg}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${fg}`}>{label}</p>
      <p className={`mt-1 font-display text-2xl font-black ${fg}`}>{value}</p>
    </div>
  );
}
