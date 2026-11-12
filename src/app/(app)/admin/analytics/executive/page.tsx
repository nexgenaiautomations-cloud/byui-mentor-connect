import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import {
  interventionReasonsByMonth,
  loadProgramData,
  openInterventionStudents,
  parseProgramFilters,
} from "@/lib/effectiveness-server";
import { getThresholds } from "@/lib/program-settings-server";
import { applicationLogCounts } from "@/lib/career-server";
import { resolveRange } from "@/lib/reports";
import {
  FIRST_MEETING_WINDOWS,
  RETENTION_POINTS,
  firstMeetingByCohort,
  lastMonthKeys,
  monthLabel,
  retentionByCohort,
} from "@/lib/effectiveness";
import {
  engagementMixByMonth,
  markPartialLast,
  meetingsPerPairByMonth,
  participationByMonth,
  pipelineByMonth,
  relationshipsByMonth,
  weeklyCompletionHeatmap,
} from "@/lib/analytics-series";
import { executiveSummary } from "@/lib/program-report";
import { isMeeting } from "@/lib/engagement";
import { CAREER_STAGES, STAGE_LABEL, funnelUniqueStudents } from "@/lib/career";
import { RISK_LABEL, RISK_REASONS } from "@/lib/interventions";
import { AnalyticsTabs } from "@/components/analytics-tabs";
import { AnalyticsCard, ProgramFilterBar, filterQuery } from "@/components/program-filter-bar";
import { Funnel, DeltaPill } from "@/components/charts";
import { AreaTrend, HeatmapChart } from "@/components/analytics-charts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { StatTile } from "@/components/stat-card";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

const pctText = (r: { pct: number | null }) => (r.pct === null ? "—" : `${r.pct}%`);

export default async function ExecutivePage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");
  const params = await searchParams;
  const filters = parseProgramFilters(params);
  const scope = adminScopeFor(me, filters.school)!;
  const range = resolveRange({ preset: params.range ?? "last_90" });
  const now = new Date();
  const months = lastMonthKeys(now, 12);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

  const [data, thresholds, openStudents, reasons] = await Promise.all([
    loadProgramData(scope, filters),
    getThresholds(scope.school),
    openInterventionStudents(scope),
    interventionReasonsByMonth(scope, since),
  ]);
  const appCounts = await applicationLogCounts(data.students.map((s) => s.id));
  const summary = executiveSummary({ ...data, openInterventionStudents: openStudents, range, now, thresholds });

  // Same-length previous period, for the KPI trend pills.
  const span = range.end.getTime() - range.start.getTime();
  const prevMeetings = data.logs.filter(
    (l) => isMeeting(l.eventKind) && l.meetingDate.getTime() >= range.start.getTime() - span && l.meetingDate < range.start
  ).length;

  const last = months[months.length - 1];
  const partial = <T extends { label: string }>(rows: T[]) => markPartialLast(rows, now, last);
  const participation = partial(participationByMonth(data.students, data.logs, months));
  const relationships = partial(relationshipsByMonth(data.matches, months));
  const mix = partial(engagementMixByMonth(data.matches, data.logs, months));
  const pipeline = partial(pipelineByMonth(data.milestones, [], months));
  const perPair = partial(meetingsPerPairByMonth(data.matches, data.logs, months));
  const cohorts = lastMonthKeys(now, 6);
  const first = firstMeetingByCohort(data.matches, now, cohorts);
  const retention = retentionByCohort(data.matches, data.logs, now, cohorts);
  const weekly = weeklyCompletionHeatmap(data.students, data.logs, now, 8, (s) => s.department);
  const funnel = funnelUniqueStudents(
    data.milestones.filter((m) => m.occurredOn >= range.start && m.occurredOn < range.end),
    [...appCounts.keys()]
  );
  const riskMonths = lastMonthKeys(now, 6);
  const q = filterQuery(filters, range);

  return (
    <div className="space-y-6">
      <AnalyticsTabs current="/admin/analytics/executive" query={q} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Analytics</p>
          <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Executive summary</h1>
          <p className="mt-1 text-sm text-slate-600">
            {scope.school ?? "All schools"} · {range.from} to {range.to} · career outcomes are self-reported unless verified
          </p>
        </div>
        <a href={`/api/admin/program-report/csv?report=executive&${q}`} className="btn-outline min-h-[44px]">
          Export CSV
        </a>
      </header>

      <ProgramFilterBar action="/admin/analytics/executive" filters={filters} range={range} options={data.options} isPlatform={scope.platform} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Program health">
        <StatTile label="Participating students" value={summary.participatingStudents} hint="Members in view" tone="navy" />
        <StatTile label="Active mentorships" value={summary.activeRelationships} hint={`${summary.health.healthy} healthy · ${summary.health.inactive} inactive`} tone="sky" />
        <StatTile label="First meeting ≤ 30 days" value={pctText(summary.firstMeeting30)} hint={`${summary.firstMeeting30.num} of ${summary.firstMeeting30.den} eligible matches`} tone="emerald" />
        <StatTile label="30-day retention" value={pctText(summary.retention30)} hint={`Interacted in month 1 · n=${summary.retention30.den}`} tone="emerald" />
        <div className="relative">
          <StatTile label="Mentor meetings" value={summary.meetingsInPeriod} hint="In period (not self-logs)" tone="violet" />
          <span className="absolute right-3 top-3" title="Change vs the previous period of the same length">
            <DeltaPill current={summary.meetingsInPeriod} previous={prevMeetings} />
          </span>
        </div>
        <StatTile label="Need intervention" value={summary.studentsNeedingIntervention} hint="Students with an open case" href="/admin/interventions" tone="rose" />
        <StatTile label="On track with 3-2-1" value={pctText(summary.studentsOnTrack)} hint="Weekly task + 3 chats last month" tone="gold" />
        <StatTile label="Internships / jobs" value={`${summary.internshipsReported} / ${summary.placementsReported}`} hint={`Offers in period · ${summary.acceptedOrStarted} accepted`} tone="amber" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard title="Student participation" subtitle="Students who logged their own activity each month, and new sign-ups">
          <AreaTrend
            title="Student participation by month"
            data={participation}
            series={[
              { key: "active", label: "Active students", color: CHART_COLORS.plum },
              { key: "joined", label: "New sign-ups", color: CHART_COLORS.gold },
            ]}
          />
        </AnalyticsCard>
        <AnalyticsCard title="Active mentor relationships" subtitle="Pairs active at month end, and new matches started">
          <AreaTrend
            title="Active mentor relationships by month"
            data={relationships}
            series={[
              { key: "active", label: "Active pairs", color: CHART_COLORS.sky },
              { key: "started", label: "New matches", color: CHART_COLORS.violet },
            ]}
          />
        </AnalyticsCard>
        <AnalyticsCard
          title="Mentor engagement"
          subtitle="Every active pair each month, by its strongest interaction"
          footnote="Quiet = no meeting or touchpoint that month. A student's own activity doesn't count as mentor engagement."
        >
          <AreaTrend
            title="Mentor engagement mix by month"
            stacked
            data={mix}
            series={[
              { key: "met", label: "Met", color: CHART_COLORS.emerald },
              { key: "touchpoint", label: "Touchpoint only", color: CHART_COLORS.amber },
              { key: "quiet", label: "Quiet", color: CHART_COLORS.rose },
            ]}
          />
        </AnalyticsCard>
        <AnalyticsCard
          title="Career outcomes"
          subtitle="Offers reported per month, by type"
          footnote="Each offer counted once. Self-reported unless verified on Career outcomes."
        >
          <AreaTrend
            title="Offers reported by month and type"
            stacked
            data={pipeline}
            series={[
              { key: "internship", label: "Internship", color: CHART_COLORS.plum },
              { key: "part_time", label: "Part-time", color: CHART_COLORS.violet },
              { key: "full_time", label: "Full-time", color: CHART_COLORS.emerald },
            ]}
            emptyText="No offers reported in the last 12 months."
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard
        title="At-risk relationships"
        subtitle="Intervention cases opened each month, by risk reason"
        footnote="A case can have more than one reason. Open the Intervention Center to act on them."
      >
        <HeatmapChart
          title="Intervention risk reasons by month"
          rowHeader="Risk"
          format="count"
          scale="purple"
          columns={riskMonths.map((k) => monthLabel(k))}
          rows={RISK_REASONS.map((r) => ({
            label: RISK_LABEL[r],
            cells: riskMonths.map((k) => ({ value: reasons.get(`${r}|${k}`) ?? 0 })),
          }))}
          legendLow="0 cases"
          emptyText="No intervention cases in the last 6 months."
        />
      </AnalyticsCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard
          title="First-meeting conversion"
          subtitle="Share of new matches whose first meeting happened within 7, 14 and 30 days"
          footnote="Each window counts only matches old enough to reach it. Fewer than 5 eligible matches shows as not enough data."
        >
          <HeatmapChart
            title="First meeting within N days, by month matched"
            rowHeader="Matched in"
            scale="health"
            columns={FIRST_MEETING_WINDOWS.map((w) => `≤ ${w} days`)}
            rows={first.map((c) => ({
              label: monthLabel(c.cohort, true),
              cells: FIRST_MEETING_WINDOWS.map((w) => ({
                value: c.windows[w].pct,
                n: c.windows[w].den,
                note: c.windows[w].den === 0 ? "no eligible matches yet" : "fewer than 5 matches",
              })),
            }))}
            cellUnit="matches"
          />
        </AnalyticsCard>
        <AnalyticsCard
          title="Retention by cohort"
          subtitle="Pairs still interacting at 30, 60 and 90 days"
          footnote="Retention needs a real meeting or touchpoint, not just an active status."
        >
          <HeatmapChart
            title="Retention by cohort"
            rowHeader="Matched in"
            scale="health"
            columns={RETENTION_POINTS.map((p) => `Day ${p}`)}
            rows={retention.map((c) => ({
              label: monthLabel(c.cohort, true),
              cells: RETENTION_POINTS.map((p) => ({
                value: c.points[p].pct,
                n: c.points[p].den,
                note: c.points[p].den === 0 ? "cohort too young" : "fewer than 5 pairs",
              })),
            }))}
            cellUnit="pairs"
          />
        </AnalyticsCard>

        <AnalyticsCard
          title="Meeting consistency"
          subtitle="Mentor meetings per active pair, by month"
          footnote="Touchpoints, independent activity and system logs are excluded. The latest month is to date."
        >
          <AreaTrend
            title="Mentor meetings per active pair by month"
            format="decimal"
            data={perPair}
            series={[{ key: "perPair", label: "Meetings per pair", color: CHART_COLORS.plum }]}
          />
        </AnalyticsCard>
        <AnalyticsCard title="Career progression funnel" subtitle="Unique students reaching each stage in the period">
          <Funnel conversionFrom={2} steps={CAREER_STAGES.map((s) => ({ label: STAGE_LABEL[s], value: funnel[s] }))} />
        </AnalyticsCard>
      </div>
      <AnalyticsCard
          title="3-2-1: weekly career task, by department"
          subtitle="Share of students who logged a career task each completed week"
          footnote="Departments with fewer than 5 students are hidden for privacy."
        >
          <HeatmapChart title="Weekly career task completion by department" rowHeader="Department" scale="health" columns={weekly.columns} rows={weekly.rows} cellUnit="students" />
        </AnalyticsCard>
      <p className="text-xs text-slate-600">
        All figures come from logged activity; the latest month in each trend is to date. Links between mentoring and outcomes are descriptive associations, not proof of cause.
      </p>
    </div>
  );
}
