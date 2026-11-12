import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import { loadProgramData, parseProgramFilters } from "@/lib/effectiveness-server";
import { getThresholds } from "@/lib/program-settings-server";
import { applicationLogCounts } from "@/lib/career-server";
import { resolveRange } from "@/lib/reports";
import {
  ENGAGED_MEETINGS,
  FIRST_MEETING_WINDOWS,
  K_ANON,
  RETENTION_POINTS,
  engagementHeatmap,
  feedbackTrends,
  firstMeetingByCohort,
  healthCounts,
  industryExperienceProgress,
  lastMonthKeys,
  meetingConsistency,
  monthLabel,
  monthlyChatCompletion,
  outcomesByEngagement,
  pledgeByGroup,
  retentionByCohort,
  weeklyTaskCompletion,
  workloadVsEngagement,
  type Rate,
  type StudentRow,
} from "@/lib/effectiveness";
import { CAREER_STAGES, STAGE_LABEL, countOffers, funnelUniqueStudents } from "@/lib/career";
import { AnalyticsTabs } from "@/components/analytics-tabs";
import { AnalyticsCard, ProgramFilterBar, filterQuery } from "@/components/program-filter-bar";
import { Funnel, Heatmap, HBarList, MonthlyBars, RateBars } from "@/components/charts";
import { StatTile } from "@/components/stat-card";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

const GROUPINGS = {
  department: { label: "Department", key: (s: StudentRow) => s.department },
  major: { label: "Major", key: (s: StudentRow) => s.major ?? "Not listed" },
  pod: { label: "Pod", key: (s: StudentRow) => s.podName ?? "No pod" },
  cohort: { label: "Cohort", key: (s: StudentRow) => s.cohort },
} as const;
type Grouping = keyof typeof GROUPINGS;

const show = (r: Rate) => (r.pct === null ? "—" : `${r.pct}%`);

function CohortTable({
  rows,
  columns,
  caption,
}: {
  rows: { cohort: string; matches: number; cells: Rate[] }[];
  columns: string[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-xs text-slate-600">
            <th scope="col" className="py-1">Matched in</th>
            <th scope="col" className="py-1 text-right">Pairs</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="py-1 text-right">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort} className="border-t border-slate-100">
              <th scope="row" className="py-1.5 text-left font-medium">{monthLabel(r.cohort, true)}</th>
              <td className="py-1.5 text-right">{r.matches}</td>
              {r.cells.map((c, i) => (
                <td key={i} className="py-1.5 text-right" title={`${c.num} of ${c.den} eligible pairs`}>
                  <span className="font-semibold">{show(c)}</span>
                  {c.den > 0 && <span className="ml-1 text-xs text-slate-500">n={c.den}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function EffectivenessPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");
  const params = await searchParams;
  const filters = parseProgramFilters(params);
  const scope = adminScopeFor(me, filters.school)!;
  const range = resolveRange({ preset: params.range ?? "last_90" });
  const by: Grouping = params.by && params.by in GROUPINGS ? (params.by as Grouping) : "department";
  const now = new Date();

  const [data, thresholds] = await Promise.all([loadProgramData(scope, filters), getThresholds(scope.school)]);
  const appCounts = await applicationLogCounts(data.students.map((s) => s.id));
  const groupKey = GROUPINGS[by].key;
  const groupOfMentee = (id: string) => {
    const s = data.studentById.get(id);
    return s ? groupKey(s) : "Other";
  };

  const months6 = lastMonthKeys(now, 6);
  const heat = engagementHeatmap(data.matches, data.logs, groupOfMentee, months6);
  const health = healthCounts(data.matches, now, thresholds);
  const cohorts = lastMonthKeys(now, 6);
  const first = firstMeetingByCohort(data.matches, now, cohorts);
  const retention = retentionByCohort(data.matches, data.logs, now, lastMonthKeys(now, 6));
  const consistency = meetingConsistency(data.matches, data.logs, now, thresholds.expectedMeetingIntervalDays);
  const workload = workloadVsEngagement(data.matches, now);
  const weekly = weeklyTaskCompletion(data.students, data.logs, now, 12);
  const monthly = monthlyChatCompletion(data.students, data.logs, now, 6);
  const industry = industryExperienceProgress(data.students, data.milestones);
  const pledgeGroups = pledgeByGroup(data.students, data.logs, data.milestones, now, groupKey);
  const inRange = data.milestones.filter((m) => m.occurredOn >= range.start && m.occurredOn < range.end);
  const funnel = funnelUniqueStudents(inRange, [...appCounts.keys()]);
  const offerEvents = countOffers(inRange);
  const outcomes = outcomesByEngagement(data.students, data.matches, data.logs, data.milestones);
  const feedback = feedbackTrends(data.feedback, data.matches, data.logs, months6);
  const q = filterQuery(filters, range);
  const byLink = (g: Grouping) => `/admin/analytics/effectiveness?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(q)), by: g })}`;

  return (
    <div className="space-y-6">
      <AnalyticsTabs current="/admin/analytics/effectiveness" query={q} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Analytics</p>
          <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Program effectiveness</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Engagement is measured from real mentor meetings and touchpoints only — never students&apos; independent activity or
            automatic goal logs. {scope.school ?? "All schools"} · {data.students.length} students · {data.matches.length} pairs.
          </p>
        </div>
        <a href={`/api/admin/program-report/csv?report=effectiveness&${q}`} className="btn-outline min-h-[44px]">
          Export CSV
        </a>
      </header>

      <ProgramFilterBar action="/admin/analytics/effectiveness" filters={filters} range={range} options={data.options} isPlatform={scope.platform} />

      <nav aria-label="Group charts by" className="flex flex-wrap items-center gap-1 text-sm">
        <span className="mr-1 text-xs font-semibold text-slate-600">Group by:</span>
        {(Object.keys(GROUPINGS) as Grouping[]).map((g) => (
          <Link
            key={g}
            href={byLink(g)}
            aria-current={by === g ? "true" : undefined}
            className={"inline-flex min-h-[36px] items-center rounded-lg px-3 font-semibold transition cursor-pointer " + (by === g ? "bg-plum-700 text-white" : "text-plum-700 hover:bg-plum-50")}
          >
            {GROUPINGS[g].label}
          </Link>
        ))}
      </nav>

      {/* A. Health */}
      <section className="grid grid-cols-3 gap-3">
        <StatTile label="Healthy" value={health.healthy} hint={`Interacted within ${thresholds.expectedMeetingIntervalDays} days`} tone="emerald" />
        <StatTile label="Needs attention" value={health.needs_attention} hint="Quiet, or no first meeting yet" tone="amber" />
        <StatTile label="Inactive" value={health.inactive} hint={`${thresholds.adminAttentionDays}+ days without interaction`} tone="rose" />
      </section>
      <AnalyticsCard
        title={`Mentorship health by ${GROUPINGS[by].label.toLowerCase()}`}
        subtitle="Share of pairs active in each month that had a meeting or touchpoint that month"
        footnote="Admins can already see each pair on the Matches page, so small cells are shown with their n rather than hidden."
      >
        <Heatmap rows={heat} columns={months6.map((k) => ({ key: k, label: monthLabel(k) }))} caption="Mentorship engagement heatmap" />
      </AnalyticsCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* B. First meeting */}
        <AnalyticsCard
          title="First-meeting success"
          subtitle="Newly matched students who had their first mentor meeting within 7, 14 and 30 days"
          footnote="Each window only counts matches old enough to have reached it, so recent cohorts aren't penalised. Fewer than 5 eligible pairs shows —."
        >
          <CohortTable
            rows={first.map((c) => ({ cohort: c.cohort, matches: c.matches, cells: FIRST_MEETING_WINDOWS.map((w) => c.windows[w]) }))}
            columns={FIRST_MEETING_WINDOWS.map((w) => `${w} days`)}
            caption="First meeting by cohort"
          />
        </AnalyticsCard>

        {/* C. Retention */}
        <AnalyticsCard
          title="Mentorship retention"
          subtitle="Pairs still interacting at 30, 60 and 90 days (a meeting or touchpoint in the prior 30 days)"
          footnote="Different from 'active' status: a pair can be active on paper and not talking."
        >
          <CohortTable
            rows={retention.map((c) => ({ cohort: c.cohort, matches: c.matches, cells: RETENTION_POINTS.map((p) => c.points[p]) }))}
            columns={RETENTION_POINTS.map((p) => `Day ${p}`)}
            caption="Retention by cohort"
          />
        </AnalyticsCard>

        {/* D. Consistency */}
        <AnalyticsCard title="Meeting consistency" subtitle="Mentor meetings only">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Meetings per student", consistency.meetingsPerStudent ?? "—"],
              ["Meetings per active pair", consistency.meetingsPerActiveMatch ?? "—"],
              ["Avg. days between meetings", consistency.avgDaysBetweenMeetings ?? "—"],
              [`On a ${thresholds.expectedMeetingIntervalDays}-day cadence`, show(consistency.onCadence)],
              ["Active pairs with no meeting yet", show(consistency.noMeetingYet)],
              ["Total mentor meetings", consistency.totalMeetings],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-600">{k}</dt>
                <dd className="mt-0.5 font-display text-xl font-black text-plum-800">{v}</dd>
              </div>
            ))}
          </dl>
        </AnalyticsCard>
        <AnalyticsCard title="Mentor workload vs engagement" subtitle="Pairs that interacted in the last 30 days, by how many mentees the mentor has">
          <RateBars rows={workload.map((w) => ({ label: `${w.label} (${w.mentors} mentor${w.mentors === 1 ? "" : "s"})`, ...w.engaged }))} />
        </AnalyticsCard>

        {/* E. 3-2-1 */}
        <AnalyticsCard
          title="Weekly career task (the '1')"
          subtitle="Students who logged a career task each completed week"
          footnote="System 'goal met' logs are excluded. Weeks with fewer than 5 students are left off."
        >
          <MonthlyBars
            points={weekly.filter((w) => w.rate.pct !== null).map((w) => ({ label: `${w.weekStart.getMonth() + 1}/${w.weekStart.getDate()}`, value: w.rate.pct! }))}
            format={(n) => `${n}%`}
          />
        </AnalyticsCard>
        <AnalyticsCard title="Monthly career chats (the '3')" subtitle="Students with 3+ career chats in each completed month">
          <RateBars rows={monthly.map((m) => ({ label: monthLabel(m.month, true), ...m.rate }))} color="#0369A1" />
        </AnalyticsCard>
        <AnalyticsCard
          title="Industry experiences (the '2')"
          subtitle="Distinct internship or job offers per student"
          footnote="Counted from reported offers only — applying or attending events is never treated as an industry experience."
        >
          <HBarList
            rows={[
              { label: "No experiences yet", value: industry.distribution.none },
              { label: "One", value: industry.distribution.one },
              { label: "Two or more (goal met)", value: industry.distribution.twoPlus },
            ]}
            color="#B45309"
          />
        </AnalyticsCard>
        <AnalyticsCard
          title={`3-2-1 by ${GROUPINGS[by].label.toLowerCase()}`}
          subtitle="On track = career task in 3 of the last 4 weeks and 3+ chats last month"
          footnote={`Groups with fewer than ${K_ANON} students are hidden so no one can be identified.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-600">
                  <th scope="col" className="py-1">{GROUPINGS[by].label}</th>
                  <th scope="col" className="py-1 text-right">Students</th>
                  <th scope="col" className="py-1 text-right">On track</th>
                  <th scope="col" className="py-1 text-right">2+ experiences</th>
                </tr>
              </thead>
              <tbody>
                {pledgeGroups.map((g) => (
                  <tr key={g.group} className="border-t border-slate-100">
                    <th scope="row" className="py-1.5 text-left font-medium">{g.group}</th>
                    <td className="py-1.5 text-right">{g.students}</td>
                    <td className="py-1.5 text-right">{g.suppressed ? "Hidden" : show(g.onTrack!)}</td>
                    <td className="py-1.5 text-right">{g.suppressed ? "Hidden" : show(g.twoPlusIndustry!)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnalyticsCard>

        {/* F. Funnel */}
        <AnalyticsCard
          title="Career progression funnel"
          subtitle={`Unique students, ${range.from} to ${range.to}`}
          footnote={`Measures students, not applications. Offer events in the period: ${offerEvents.internship} internship, ${offerEvents.part_time} part-time, ${offerEvents.full_time} full-time.`}
        >
          <Funnel steps={CAREER_STAGES.map((s) => ({ label: STAGE_LABEL[s], value: funnel[s] }))} />
        </AnalyticsCard>

        {/* G. Outcomes */}
        <AnalyticsCard
          title="Engagement and reported outcomes"
          subtitle={`Students with any reported offer, by mentorship engagement (engaged = ${ENGAGED_MEETINGS}+ mentor meetings)`}
          footnote="A descriptive comparison only. Students who choose to meet more may differ in other ways, so this does not show that mentoring caused an outcome. Groups under 5 students are hidden."
        >
          <RateBars
            rows={[
              { label: "Engaged with a mentor", ...(outcomes.engaged.withOffer ?? { pct: null, num: 0, den: outcomes.engaged.students }) },
              { label: "Matched, less engaged", ...(outcomes.lessEngaged.withOffer ?? { pct: null, num: 0, den: outcomes.lessEngaged.students }) },
              { label: "Not matched", ...(outcomes.unmatched.withOffer ?? { pct: null, num: 0, den: outcomes.unmatched.students }) },
            ]}
            color="#047857"
          />
          <p className="mt-3 text-xs text-slate-600">
            Average mentor meetings before a first offer:{" "}
            <strong>{outcomes.avgMeetingsBeforeFirstOffer ?? `not enough offers yet (${outcomes.offersObserved} of ${K_ANON} needed)`}</strong>
          </p>
        </AnalyticsCard>

        {/* H. Feedback */}
        <AnalyticsCard
          title="Student feedback"
          subtitle={`Mentee monthly check-ins · ${feedback.responses} responses`}
          footnote="Averages need at least 5 responses; individual ratings are never shown."
        >
          {feedback.distribution ? (
            <HBarList rows={feedback.distribution.map((d) => ({ label: `${d.rating} star${d.rating === 1 ? "" : "s"}`, value: d.count }))} color="#6D28D9" />
          ) : (
            <p className="text-sm text-slate-600">Not enough responses yet to show a distribution.</p>
          )}
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-600">
                <th scope="col" className="py-1">Month</th>
                <th scope="col" className="py-1 text-right">Submitted / expected</th>
                <th scope="col" className="py-1 text-right">Average</th>
              </tr>
            </thead>
            <tbody>
              {feedback.byMonth.map((m) => (
                <tr key={m.month} className="border-t border-slate-100">
                  <th scope="row" className="py-1.5 text-left font-medium">{monthLabel(m.month, true)}</th>
                  <td className="py-1.5 text-right">{m.responses} / {m.expected}</td>
                  <td className="py-1.5 text-right">{m.avg ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-600">
            Average rating when the pair interacted that month: <strong>{feedback.vsEngagement.interacted.avg ?? "—"}</strong> (n=
            {feedback.vsEngagement.interacted.n}) · when they didn&apos;t: <strong>{feedback.vsEngagement.noInteraction.avg ?? "—"}</strong> (n=
            {feedback.vsEngagement.noInteraction.n})
          </p>
        </AnalyticsCard>
      </div>
    </div>
  );
}
