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
  feedbackTrends,
  firstMeetingByCohort,
  healthCounts,
  industryExperienceProgress,
  lastMonthKeys,
  meetingConsistency,
  monthLabel,
  monthlyChatCompletion,
  outcomesByEngagement,
  retentionByCohort,
  workloadVsEngagement,
  type Rate,
  type StudentRow,
} from "@/lib/effectiveness";
import {
  feedbackHeatmap,
  healthHeatmap,
  markPartialLast,
  meetingsPerPairByMonth,
  weeklyCompletionHeatmap,
} from "@/lib/analytics-series";
import { CAREER_STAGES, STAGE_LABEL, funnelUniqueStudents } from "@/lib/career";
import { AnalyticsTabs } from "@/components/analytics-tabs";
import { AnalyticsCard, ProgramFilterBar, filterQuery } from "@/components/program-filter-bar";
import { Funnel } from "@/components/charts";
import { AreaTrend, Bars, HeatmapChart, LineTrend } from "@/components/analytics-charts";
import { CHART_COLORS } from "@/lib/chart-colors";
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
  const months12 = lastMonthKeys(now, 12);
  const partial = <T extends { label: string }>(rows: T[], keys: string[]) => markPartialLast(rows, now, keys[keys.length - 1]);
  const health = healthCounts(data.matches, now, thresholds);
  const heat = healthHeatmap(data.matches, data.logs, groupOfMentee, months6);
  const cohorts = lastMonthKeys(now, 6);
  const first = firstMeetingByCohort(data.matches, now, cohorts);
  const retention = retentionByCohort(data.matches, data.logs, now, cohorts);
  const consistency = meetingConsistency(data.matches, data.logs, now, thresholds.expectedMeetingIntervalDays);
  const meetingsTrend = partial(meetingsPerPairByMonth(data.matches, data.logs, months12), months12);
  const workload = workloadVsEngagement(data.matches, now);
  const weekly = weeklyCompletionHeatmap(data.students, data.logs, now, 12, groupKey);
  const monthly = monthlyChatCompletion(data.students, data.logs, now, 6);
  const industry = industryExperienceProgress(data.students, data.milestones);
  const inRange = data.milestones.filter((m) => m.occurredOn >= range.start && m.occurredOn < range.end);
  const funnel = funnelUniqueStudents(inRange, [...appCounts.keys()]);
  const outcomes = outcomesByEngagement(data.students, data.matches, data.logs, data.milestones);
  const feedback = feedbackTrends(data.feedback, data.matches, data.logs, months6);
  const ratingHeat = feedbackHeatmap(data.feedback, months6);
  const q = filterQuery(filters, range);
  const byLink = (g: Grouping) => `/admin/analytics/effectiveness?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(q)), by: g })}`;
  const rateRow = (label: string, r: Rate | null, n: number) => ({ label: `${label} (n=${n})`, value: r?.pct ?? null });

  return (
    <div className="space-y-6">
      <AnalyticsTabs current="/admin/analytics/effectiveness" query={q} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Analytics</p>
          <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Program effectiveness</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Engagement counts real mentor meetings and touchpoints only — never students&apos; independent activity or automatic goal
            logs. {scope.school ?? "All schools"} · {data.students.length} students · {data.matches.length} pairs.
          </p>
        </div>
        <a href={`/api/admin/program-report/csv?report=effectiveness&${q}`} className="btn-outline min-h-[44px]">
          Export CSV
        </a>
      </header>

      <ProgramFilterBar action="/admin/analytics/effectiveness" filters={filters} range={range} options={data.options} isPlatform={scope.platform} />

      <nav aria-label="Group charts by" className="flex flex-wrap items-center gap-1 text-sm">
        <span className="mr-1 text-xs font-semibold text-slate-700">Group by:</span>
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

      <section className="grid grid-cols-3 gap-3" aria-label="Mentorship health">
        <StatTile label="Healthy" value={health.healthy} hint={`Interacted within ${thresholds.expectedMeetingIntervalDays} days`} tone="emerald" />
        <StatTile label="Needs attention" value={health.needs_attention} hint="Quiet, or no first meeting yet" tone="amber" />
        <StatTile label="Inactive" value={health.inactive} hint={`${thresholds.adminAttentionDays}+ days without interaction`} tone="rose" />
      </section>

      <AnalyticsCard
        title={`Mentorship health by ${GROUPINGS[by].label.toLowerCase()}`}
        subtitle="Share of pairs active each month that had a meeting or touchpoint that month"
        footnote="n = active pairs in the cell. Admins already see each pair on the Matches page, so small cells are shown with their n rather than hidden."
      >
        <HeatmapChart
          title={`Mentorship engagement by ${GROUPINGS[by].label.toLowerCase()} and month`}
          rowHeader={GROUPINGS[by].label}
          scale="health"
          columns={months6.map((k) => monthLabel(k))}
          rows={heat}
          cellUnit="pairs"
          emptyText="No mentorship pairs match these filters yet."
        />
      </AnalyticsCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard
          title="First-meeting success"
          subtitle="New matches whose first mentor meeting happened within 7, 14 and 30 days"
          footnote="Each window counts only matches old enough to reach it, so recent cohorts aren't penalised. Fewer than 5 eligible pairs shows as not enough data."
        >
          <HeatmapChart
            title="First meeting within N days by cohort"
            rowHeader="Matched in"
            scale="health"
            columns={FIRST_MEETING_WINDOWS.map((w) => `≤ ${w} days`)}
            rows={first.map((c) => ({
              label: monthLabel(c.cohort, true),
              cells: FIRST_MEETING_WINDOWS.map((w) => ({ value: c.windows[w].pct, n: c.windows[w].den, note: c.windows[w].den ? "fewer than 5 matches" : "cohort too young" })),
            }))}
            cellUnit="matches"
          />
        </AnalyticsCard>
        <AnalyticsCard title="30 / 60 / 90-day retention" subtitle="Pairs with a meeting or touchpoint in the 30 days before each mark" footnote="Different from 'active' status: a pair can be active on paper and not talking.">
          <HeatmapChart
            title="Retention by cohort"
            rowHeader="Matched in"
            scale="health"
            columns={RETENTION_POINTS.map((p) => `Day ${p}`)}
            rows={retention.map((c) => ({
              label: monthLabel(c.cohort, true),
              cells: RETENTION_POINTS.map((p) => ({ value: c.points[p].pct, n: c.points[p].den, note: c.points[p].den ? "fewer than 5 pairs" : "cohort too young" })),
            }))}
            cellUnit="pairs"
          />
        </AnalyticsCard>

        <AnalyticsCard title="Meeting consistency over time" subtitle="Mentor meetings per month and per active pair">
          <AreaTrend
            title="Mentor meetings per month"
            data={meetingsTrend}
            series={[{ key: "meetings", label: "Mentor meetings", color: CHART_COLORS.plum }]}
            height={200}
          />
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              ["Per active pair", consistency.meetingsPerActiveMatch ?? "—"],
              ["Avg. days between", consistency.avgDaysBetweenMeetings ?? "—"],
              [`On ${thresholds.expectedMeetingIntervalDays}-day cadence`, show(consistency.onCadence)],
              ["No meeting yet", show(consistency.noMeetingYet)],
              ["Per student", consistency.meetingsPerStudent ?? "—"],
              ["Total meetings", consistency.totalMeetings],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-600">{k}</dt>
                <dd className="font-display text-lg font-black tabular-nums text-plum-800">{v}</dd>
              </div>
            ))}
          </dl>
        </AnalyticsCard>
        <AnalyticsCard
          title="Mentor workload vs engagement"
          subtitle="Share of pairs that interacted in the last 30 days, by the mentor's number of mentees"
          footnote="Helps spot mentors carrying more mentees than they can keep up with."
        >
          <Bars
            title="Engaged pairs by mentor load"
            horizontal
            showValues
            format="percent"
            data={workload.map((w) => ({ label: `${w.label} (${w.pairs} pairs)`, engaged: w.engaged.pct }))}
            series={[{ key: "engaged", label: "Engaged in last 30 days", color: CHART_COLORS.plum }]}
            emptyText="No active pairs yet."
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard
        title={`3-2-1: weekly career task, by ${GROUPINGS[by].label.toLowerCase()}`}
        subtitle="Share of students who logged a career task in each completed week (the '1')"
        footnote={`System "goal met" logs are excluded. Groups with fewer than ${K_ANON} students are hidden so no one can be identified.`}
      >
        <HeatmapChart title="Weekly career task completion" rowHeader={GROUPINGS[by].label} scale="health" columns={weekly.columns} rows={weekly.rows} cellUnit="students" />
      </AnalyticsCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard title="Monthly career chats (the '3')" subtitle="Students with 3+ career chats in each completed month">
          <LineTrend
            title="Students meeting the monthly career-chat goal"
            format="percent"
            data={monthly.map((m) => ({ label: monthLabel(m.month), pct: m.rate.pct }))}
            series={[{ key: "pct", label: "Met the goal", color: CHART_COLORS.sky }]}
          />
        </AnalyticsCard>
        <AnalyticsCard
          title="Industry experiences (the '2')"
          subtitle="Distinct internship or job offers per student"
          footnote="Counted from reported offers only — applying or attending events is never treated as an industry experience."
        >
          <Bars
            title="Students by number of industry experiences"
            horizontal
            showValues
            data={[
              { label: "None yet", students: industry.distribution.none },
              { label: "One", students: industry.distribution.one },
              { label: "Two or more (goal met)", students: industry.distribution.twoPlus },
            ]}
            series={[{ key: "students", label: "Students", color: CHART_COLORS.gold }]}
            rowColors={[CHART_COLORS.slate, CHART_COLORS.violet, CHART_COLORS.emerald]}
          />
        </AnalyticsCard>

        <AnalyticsCard
          title="Student feedback distribution"
          subtitle="Mentee monthly check-in ratings by month"
          footnote="Months with fewer than 5 responses are hidden; individual ratings are never shown."
        >
          <HeatmapChart title="Mentee ratings by month" rowHeader="Rating" format="count" scale="purple" columns={months6.map((k) => monthLabel(k))} rows={ratingHeat} cellUnit="responses" emptyText="Not enough check-ins yet." />
        </AnalyticsCard>
        <AnalyticsCard title="Feedback over time" subtitle="Average rating (needs 5+ responses) and check-ins submitted vs expected">
          <LineTrend
            title="Average mentee rating by month"
            format="decimal"
            data={feedback.byMonth.map((m) => ({ label: monthLabel(m.month), avg: m.avg }))}
            series={[{ key: "avg", label: "Average rating (1–5)", color: CHART_COLORS.plum }]}
            height={180}
            emptyText="Not enough check-ins for an average yet."
          />
          <AreaTrend
            className="mt-4"
            title="Check-ins submitted vs expected"
            data={feedback.byMonth.map((m) => ({ label: monthLabel(m.month), responses: m.responses, expected: m.expected }))}
            series={[
              { key: "expected", label: "Expected", color: CHART_COLORS.slate },
              { key: "responses", label: "Submitted", color: CHART_COLORS.emerald },
            ]}
            height={180}
          />
          <p className="mt-3 text-xs text-slate-600">
            Rating when the pair interacted that month: <strong>{feedback.vsEngagement.interacted.avg ?? "—"}</strong> (n={feedback.vsEngagement.interacted.n}) · when they didn&apos;t:{" "}
            <strong>{feedback.vsEngagement.noInteraction.avg ?? "—"}</strong> (n={feedback.vsEngagement.noInteraction.n})
          </p>
        </AnalyticsCard>

        <AnalyticsCard
          title="Engagement and career outcomes"
          subtitle={`Students with any reported offer, by mentorship engagement (engaged = ${ENGAGED_MEETINGS}+ mentor meetings)`}
          footnote="A descriptive comparison only — students who choose to meet more may differ in other ways, so this doesn't show that mentoring caused an outcome. Groups under 5 students are hidden."
        >
          <Bars
            title="Students with an offer by engagement level"
            horizontal
            showValues
            format="percent"
            data={[
              rateRow("Engaged with a mentor", outcomes.engaged.withOffer, outcomes.engaged.students),
              rateRow("Matched, less engaged", outcomes.lessEngaged.withOffer, outcomes.lessEngaged.students),
              rateRow("Not matched", outcomes.unmatched.withOffer, outcomes.unmatched.students),
            ]}
            series={[{ key: "value", label: "Have an offer", color: CHART_COLORS.emerald }]}
          />
          <p className="mt-3 text-xs text-slate-600">
            Average mentor meetings before a first offer:{" "}
            <strong>{outcomes.avgMeetingsBeforeFirstOffer ?? `not enough offers yet (${outcomes.offersObserved} of ${K_ANON} needed)`}</strong>
          </p>
        </AnalyticsCard>
        <AnalyticsCard
          title="Career progression funnel"
          subtitle={`Unique students, ${range.from} to ${range.to}`}
          footnote="Counts students, not applications. Exploring and preparing are optional, so conversion is shown from 'Actively applying' onward."
        >
          <Funnel conversionFrom={2} steps={CAREER_STAGES.map((s) => ({ label: STAGE_LABEL[s], value: funnel[s] }))} />
        </AnalyticsCard>
      </div>
    </div>
  );
}
