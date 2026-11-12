import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import { loadProgramData, parseProgramFilters } from "@/lib/effectiveness-server";
import { applicationLogCounts, applicationLogDates } from "@/lib/career-server";
import { resolveRange } from "@/lib/reports";
import {
  CAREER_STAGES,
  OPPORTUNITY_LABEL,
  OPPORTUNITY_TYPES,
  STAGE_LABEL,
  countOffers,
  funnelUniqueStudents,
  type OpportunityType,
} from "@/lib/career";
import { K_ANON, rate } from "@/lib/effectiveness";
import { AnalyticsTabs } from "@/components/analytics-tabs";
import { AnalyticsCard, ProgramFilterBar, filterQuery } from "@/components/program-filter-bar";
import { Funnel } from "@/components/charts";
import { AreaTrend, Bars, HeatmapChart, LineTrend } from "@/components/analytics-charts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { markPartialLast, pipelineByMonth, stageHeatmap } from "@/lib/analytics-series";
import { lastMonthKeys, monthLabel } from "@/lib/effectiveness";
import { StatTile } from "@/components/stat-card";
import { VerifyButton } from "./verify-button";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

export default async function CareerOutcomesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");
  const params = await searchParams;
  const filters = parseProgramFilters(params);
  const scope = adminScopeFor(me, filters.school)!;
  const range = resolveRange({ preset: params.range ?? "all" });
  const data = await loadProgramData(scope, filters);

  const inRange = data.milestones.filter((m) => m.occurredOn >= range.start && m.occurredOn < range.end);
  const [appCounts, appDates] = await Promise.all([
    applicationLogCounts(data.students.map((s) => s.id)),
    applicationLogDates(data.students.map((s) => s.id)),
  ]);
  const now = new Date();
  const months = lastMonthKeys(now, 12);
  const pipeline = markPartialLast(pipelineByMonth(data.milestones, appDates, months), now, months[months.length - 1]);
  const stageMonths = lastMonthKeys(now, 6);
  const stages = stageHeatmap(data.milestones, stageMonths);
  const funnel = funnelUniqueStudents(inRange, [...appCounts.keys()]);
  const offers = countOffers(inRange);
  const verifiedOffers = countOffers(inRange.filter((m) => m.verification === "verified"));
  const totalOffers = OPPORTUNITY_TYPES.reduce((s, t) => s + offers[t], 0);
  const accepted = new Set(inRange.filter((m) => m.stage === "offer_accepted").map((m) => m.studentId)).size;
  const started = new Set(inRange.filter((m) => m.stage === "started").map((m) => m.studentId)).size;
  const reporting = new Set(data.milestones.map((m) => m.studentId)).size;


  // By major, suppressed below k.
  const withOffer = new Set(
    inRange.filter((m) => ["offer_received", "offer_accepted", "started"].includes(m.stage)).map((m) => m.studentId)
  );
  const majors = new Map<string, string[]>();
  for (const s of data.students) {
    const k = s.major ?? "Not listed";
    majors.set(k, [...(majors.get(k) ?? []), s.id]);
  }
  const byMajor = [...majors.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([major, ids]) => {
      const r = rate(ids.filter((id) => withOffer.has(id)).length, ids.length, K_ANON);
      return { label: major, ...r };
    });

  // Offers awaiting verification (names are fine here: admins already see
  // members; employer is optional and student-entered).
  const offerRows = inRange
    .filter((m) => m.stage === "offer_received" || m.stage === "offer_accepted" || m.stage === "started")
    .sort((a, b) => b.occurredOn.getTime() - a.occurredOn.getTime())
    .slice(0, 25);
  const names = offerRows.length
    ? new Map(
        (await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [...new Set(offerRows.map((o) => o.studentId))]))).map((u) => [u.id, u.name])
      )
    : new Map<string, string | null>();

  const q = filterQuery(filters, range);
  return (
    <div className="space-y-6">
      <AnalyticsTabs current="/admin/analytics/careers" query={q} />
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Analytics</p>
        <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Career outcomes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Self-reported by students unless marked verified. {scope.school ?? "All schools"} · {data.students.length} students in view
        </p>
      </header>

      <ProgramFilterBar action="/admin/analytics/careers" filters={filters} range={range} options={data.options} isPlatform={scope.platform} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Students reporting" value={reporting} hint="Any career update, all time" tone="navy" />
        <StatTile label="Offers reported" value={totalOffers} hint={`${OPPORTUNITY_TYPES.reduce((s, t) => s + verifiedOffers[t], 0)} verified · in period`} tone="emerald" />
        <StatTile label="Offers accepted" value={accepted} hint="Students, in period" tone="gold" />
        <StatTile label="Started" value={started} hint="Internship or job, in period" tone="sky" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard
          title="Career progression funnel"
          subtitle="Unique students who reached each stage in the period"
          footnote="Counts students, not events. Reaching a later stage implies the stages from 'Actively applying' up to it; 'applying' also includes students who logged an application. Exploring and preparing are optional, so conversion starts at applying."
        >
          <Funnel conversionFrom={2} steps={CAREER_STAGES.map((s) => ({ label: STAGE_LABEL[s], value: funnel[s] }))} />
        </AnalyticsCard>
        <AnalyticsCard title="Applications and interviews" subtitle="Per month, from career updates and logged applications">
          <AreaTrend
            title="Applications and interviews by month"
            data={pipeline}
            series={[
              { key: "applications", label: "Applications", color: CHART_COLORS.plum },
              { key: "interviews", label: "Interviews", color: CHART_COLORS.sky },
            ]}
          />
        </AnalyticsCard>
        <AnalyticsCard title="Internship vs job outcomes" subtitle="Offers reported per month, by type (each offer once)">
          <AreaTrend
            title="Offers by type and month"
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
        <AnalyticsCard
          title="Offers reported vs verified"
          subtitle="Verified = confirmed by a program admin"
          footnote="Self-reported offers are counted but kept separate from verified ones in every report."
        >
          <LineTrend
            title="Offers reported and verified by month"
            data={pipeline.map((p) => ({ label: p.label, reported: p.internship + p.part_time + p.full_time, verified: p.verified }))}
            series={[
              { key: "reported", label: "Reported", color: CHART_COLORS.plum },
              { key: "verified", label: "Verified", color: CHART_COLORS.emerald },
            ]}
            emptyText="No offers reported in the last 12 months."
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard
        title="Stage progression over time"
        subtitle="Students by their most recent career stage at the end of each month"
        footnote="Shows how the cohort moves through the pipeline. A student appears in one stage per month."
      >
        <HeatmapChart
          title="Students by current career stage and month"
          rowHeader="Stage"
          format="count"
          scale="purple"
          columns={stageMonths.map((k) => monthLabel(k))}
          rows={stages.map((r) => ({ label: STAGE_LABEL[r.stage], cells: r.cells.map((v) => ({ value: v })) }))}
          cellUnit="students"
          emptyText="No career updates yet."
        />
      </AnalyticsCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard title="Offers by type" subtitle="Each offer counted once, in period" footnote="An acceptance linked to an offer is not a second offer.">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-600">
                <th scope="col" className="py-1">Type</th>
                <th scope="col" className="py-1 text-right">Reported</th>
                <th scope="col" className="py-1 text-right">Verified</th>
              </tr>
            </thead>
            <tbody>
              {OPPORTUNITY_TYPES.map((t) => (
                <tr key={t} className="border-t border-slate-100">
                  <td className="py-1.5">{OPPORTUNITY_LABEL[t]}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{offers[t]}</td>
                  <td className="py-1.5 text-right tabular-nums">{verifiedOffers[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AnalyticsCard>
        <AnalyticsCard title="Students with an offer, by major" subtitle="In period" footnote={`Majors with fewer than ${K_ANON} students are hidden so no one can be identified.`}>
          <Bars
            title="Share of students with an offer by major"
            horizontal
            showValues
            format="percent"
            data={byMajor.map((m) => ({ label: `${m.label} (n=${m.den})`, value: m.pct }))}
            series={[{ key: "value", label: "Have an offer", color: CHART_COLORS.emerald }]}
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Reported offers" subtitle="Most recent 25 in the period. Verify ones you've confirmed.">
        {offerRows.length === 0 ? (
          <p className="text-sm text-slate-600">No offers reported in this period yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-600">
                  <th scope="col" className="py-1">Student</th>
                  <th scope="col" className="py-1">Stage</th>
                  <th scope="col" className="py-1">Type</th>
                  <th scope="col" className="py-1">Employer</th>
                  <th scope="col" className="py-1">Date</th>
                  <th scope="col" className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {offerRows.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="py-1.5">{names.get(o.studentId) ?? "Student"}</td>
                    <td className="py-1.5">{STAGE_LABEL[o.stage as keyof typeof STAGE_LABEL] ?? o.stage}</td>
                    <td className="py-1.5">{OPPORTUNITY_LABEL[o.opportunityType as OpportunityType] ?? "—"}</td>
                    <td className="py-1.5">{o.employer ?? "—"}</td>
                    <td className="py-1.5 whitespace-nowrap">{o.occurredOn.toLocaleDateString()}</td>
                    <td className="py-1.5">
                      <span className="mr-2 text-xs text-slate-600">{o.source === "activity_log" ? "Activity log" : "Self-reported"}</span>
                      <VerifyButton id={o.id} verified={o.verification === "verified"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnalyticsCard>
      <p className="text-[11px] text-slate-500">
        These are descriptive counts of what students reported. They do not show that mentoring caused any outcome.
      </p>
    </div>
  );
}
