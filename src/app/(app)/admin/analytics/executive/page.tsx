import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import {
  interventionOutcomes,
  loadProgramData,
  openInterventionStudents,
  parseProgramFilters,
} from "@/lib/effectiveness-server";
import { getThresholds } from "@/lib/program-settings-server";
import { applicationLogCounts } from "@/lib/career-server";
import { resolveRange } from "@/lib/reports";
import {
  engagementHeatmap,
  firstMeetingByCohort,
  lastMonthKeys,
  monthKey,
  monthLabel,
  pledgeByGroup,
  retentionByCohort,
} from "@/lib/effectiveness";
import { executiveSummary } from "@/lib/program-report";
import { isMeeting } from "@/lib/engagement";
import { CAREER_STAGES, STAGE_LABEL, funnelUniqueStudents } from "@/lib/career";
import { STATUS_LABEL, type InterventionStatus } from "@/lib/interventions";
import { AnalyticsTabs } from "@/components/analytics-tabs";
import { AnalyticsCard, ProgramFilterBar, filterQuery } from "@/components/program-filter-bar";
import { Funnel, HBarList, MonthlyBars, MonthlyLine, RateBars } from "@/components/charts";
import { StatTile } from "@/components/stat-card";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

const pctText = (r: { pct: number | null; den: number }) => (r.pct === null ? "—" : `${r.pct}%`);

export default async function ExecutivePage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");
  const params = await searchParams;
  const filters = parseProgramFilters(params);
  const scope = adminScopeFor(me, filters.school)!;
  const range = resolveRange({ preset: params.range ?? "last_90" });
  const now = new Date();

  const [data, thresholds, openStudents, outcomes] = await Promise.all([
    loadProgramData(scope, filters),
    getThresholds(scope.school),
    openInterventionStudents(scope),
    interventionOutcomes(scope, range),
  ]);
  const appCounts = await applicationLogCounts(data.students.map((s) => s.id));
  const summary = executiveSummary({
    students: data.students,
    matches: data.matches,
    logs: data.logs,
    milestones: data.milestones,
    openInterventionStudents: openStudents,
    range,
    now,
    thresholds,
  });

  const months = lastMonthKeys(now, 12);
  const meetingsByMonth = months.map((k) => ({
    label: monthLabel(k),
    value: data.logs.filter((l) => isMeeting(l.eventKind) && monthKey(l.meetingDate) === k).length,
  }));
  const [allRow] = engagementHeatmap(data.matches, data.logs, () => "All", months);
  const engagedPct = (allRow?.cells ?? []).map((c) => ({ label: monthLabel(c.month), value: c.pct ?? 0 }));
  const cohorts = lastMonthKeys(now, 6);
  const firstMeeting = firstMeetingByCohort(data.matches, now, cohorts);
  const retention = retentionByCohort(data.matches, data.logs, now, cohorts);
  const inRangeMilestones = data.milestones.filter((m) => m.occurredOn >= range.start && m.occurredOn < range.end);
  const funnel = funnelUniqueStudents(inRangeMilestones, [...appCounts.keys()]);
  const pledgeByDept = pledgeByGroup(data.students, data.logs, data.milestones, now, (s) => s.department);
  const offersByMonth = months.map((k) => ({
    label: monthLabel(k),
    value: data.milestones.filter((m) => m.stage === "offer_received" && monthKey(m.occurredOn) === k).length,
  }));
  const q = filterQuery(filters, range);
  const hasPairs = data.matches.length > 0;

  return (
    <div className="space-y-6">
      <AnalyticsTabs current="/admin/analytics/executive" query={q} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Analytics</p>
          <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Executive summary</h1>
          <p className="mt-1 text-sm text-slate-600">
            {scope.school ?? "All schools"} · {range.from} to {range.to} · outcomes are self-reported unless verified
          </p>
        </div>
        <a href={`/api/admin/program-report/csv?report=executive&${q}`} className="btn-outline min-h-[44px]">
          Export CSV
        </a>
      </header>

      <ProgramFilterBar action="/admin/analytics/executive" filters={filters} range={range} options={data.options} isPlatform={scope.platform} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Participating students" value={summary.participatingStudents} hint="Members in view" tone="navy" />
        <StatTile label="Active mentorships" value={summary.activeRelationships} hint={`${summary.health.healthy} healthy · ${summary.health.inactive} inactive`} tone="sky" />
        <StatTile label="First meeting ≤ 30 days" value={pctText(summary.firstMeeting30)} hint={`${summary.firstMeeting30.num} of ${summary.firstMeeting30.den} matches`} tone="emerald" />
        <StatTile label="30-day retention" value={pctText(summary.retention30)} hint={`Interacted in month 1 · n=${summary.retention30.den}`} tone="emerald" />
        <StatTile label="Mentor meetings" value={summary.meetingsInPeriod} hint="In period (not self-logs)" tone="violet" />
        <StatTile label="Need intervention" value={summary.studentsNeedingIntervention} hint="Students with an open case" href="/admin/interventions" tone="rose" />
        <StatTile label="On track with 3-2-1" value={pctText(summary.studentsOnTrack)} hint="Weekly task + 3 chats last month" tone="gold" />
        <StatTile label="Internships / jobs" value={`${summary.internshipsReported} / ${summary.placementsReported}`} hint={`Offers reported in period · ${summary.acceptedOrStarted} accepted`} tone="amber" />
      </section>

      {!hasPairs && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No mentorship pairs match these filters yet, so engagement charts are empty. Widen the filters or check back once students are matched.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard title="Mentorship engagement over time" subtitle="Mentor meetings per month (bars) and share of active pairs that interacted (line)">
          <MonthlyBars points={meetingsByMonth} color="#6D28D9" />
          <div className="mt-4">
            <MonthlyLine points={engagedPct} color="#047857" format={(n) => `${n}%`} />
          </div>
        </AnalyticsCard>
        <AnalyticsCard
          title="First-meeting conversion"
          subtitle="Matches that met within 14 days, by month matched"
          footnote="Only matches at least 14 days old are counted. Rates with fewer than 5 matches show —."
        >
          <RateBars rows={firstMeeting.map((c) => ({ label: monthLabel(c.cohort), ...c.windows[14] }))} />
        </AnalyticsCard>
        <AnalyticsCard
          title="Retention by cohort"
          subtitle="Pairs that interacted in their first 30 days, by month matched"
          footnote="Retention requires a real meeting or touchpoint — an 'active' status alone doesn't count."
        >
          <RateBars rows={retention.map((c) => ({ label: monthLabel(c.cohort), ...c.points[30] }))} color="#047857" />
        </AnalyticsCard>
        <AnalyticsCard title="Career progression funnel" subtitle="Unique students reaching each stage in the period">
          <Funnel steps={CAREER_STAGES.map((s) => ({ label: STAGE_LABEL[s], value: funnel[s] }))} />
        </AnalyticsCard>
        <AnalyticsCard title="3-2-1 on track, by department" subtitle="Weekly task in 3 of the last 4 weeks and 3+ career chats last month" footnote="Departments with fewer than 5 students are hidden for privacy.">
          <RateBars
            rows={pledgeByDept.map((g) => ({
              label: g.group,
              pct: g.onTrack?.pct ?? null,
              num: g.onTrack?.num ?? 0,
              den: g.students,
              note: g.suppressed ? "Hidden — fewer than 5 students" : undefined,
            }))}
            color="#B45309"
          />
        </AnalyticsCard>
        <AnalyticsCard title="Intervention outcomes" subtitle={`Cases opened in the period: ${outcomes.opened}`}>
          <HBarList
            rows={Object.entries(outcomes.byStatus).map(([s, n]) => ({ label: STATUS_LABEL[s as InterventionStatus] ?? s, value: n }))}
            color="#BE123C"
          />
        </AnalyticsCard>
        <AnalyticsCard title="Career outcome trend" subtitle="Offers reported per month (each offer once)" footnote="Self-reported by students; see Career outcomes to verify.">
          <MonthlyBars points={offersByMonth} color="#B45309" />
        </AnalyticsCard>
      </div>
      <p className="text-[11px] text-slate-500">
        All figures come from logged activity. Associations between mentoring and outcomes are descriptive, not proof of cause.
      </p>
    </div>
  );
}
