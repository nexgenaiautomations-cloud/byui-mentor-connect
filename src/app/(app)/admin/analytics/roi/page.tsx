import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import { loadProgramData, loadRoiTracked, parseProgramFilters } from "@/lib/effectiveness-server";
import { getRoiAssumptions } from "@/lib/program-settings-server";
import { resolveRange } from "@/lib/reports";
import { computeRoi } from "@/lib/program-report";
import { AnalyticsTabs } from "@/components/analytics-tabs";
import { AnalyticsCard, ProgramFilterBar, filterQuery } from "@/components/program-filter-bar";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

const ROI_FIELDS = [
  { key: "minutesPerReminder", label: "Manual time per reminder", hint: "If staff sent it by hand", min: 0, max: 240, step: 0.5, suffix: "min" },
  { key: "minutesPerFollowUp", label: "Manual time per follow-up", min: 0, max: 240, step: 0.5, suffix: "min" },
  { key: "minutesPerIntervention", label: "Staff time per intervention outreach", min: 0, max: 600, suffix: "min" },
  { key: "staffHourlyCost", label: "Staff hourly cost", min: 0, max: 1000, step: 0.5, prefix: "$" },
  { key: "mentorHourValue", label: "Value per mentorship hour (optional)", hint: "0 hides this estimate", min: 0, max: 1000, step: 0.5, prefix: "$" },
];

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function RoiPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");
  const params = await searchParams;
  const filters = parseProgramFilters(params);
  const scope = adminScopeFor(me, filters.school)!;
  const range = resolveRange({ preset: params.range ?? "last_90" });
  const data = await loadProgramData(scope, filters);
  const [tracked, assumptions] = await Promise.all([loadRoiTracked(scope, data, range), getRoiAssumptions(scope.school)]);
  const roi = computeRoi(tracked, assumptions);
  const q = filterQuery(filters, range);

  const trackedRows: [string, string | number, string?][] = [
    ["Mentorship hours logged", roi.tracked.mentorshipHours, `${tracked.interactionsLogged} meetings/touchpoints; ${tracked.interactionsWithoutDuration} had no duration, so this is a floor`],
    ["Automated reminders delivered", tracked.remindersDelivered, "Meeting reminders and check-in nudges actually sent"],
    ["Automated follow-ups delivered", tracked.followUpsDelivered, "Log-it, confirm-it and action-item emails actually sent"],
    ["Follow-up tasks completed", tracked.followUpTasksCompleted, "Meeting action items marked done"],
    ["Intervention outreach recorded", tracked.interventionsRecorded, "Outreach actions on Intervention Center cases"],
    ["Intervention cases resolved", tracked.casesResolved, ""],
  ];

  return (
    <div className="space-y-6">
      <AnalyticsTabs current="/admin/analytics/roi" query={q} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Analytics</p>
          <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Program ROI</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Tracked numbers come straight from ICAN. Dollar figures are <strong>estimates</strong> from the assumptions below — not audited
            financial results. {range.from} to {range.to}.
          </p>
        </div>
        <a href={`/api/admin/program-report/csv?report=roi&${q}`} className="btn-outline min-h-[44px]">
          Export CSV
        </a>
      </header>

      <ProgramFilterBar action="/admin/analytics/roi" filters={filters} range={range} options={data.options} isPlatform={scope.platform} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCard title="Tracked activity" subtitle="Counted, not estimated">
          <table className="w-full text-sm">
            <tbody>
              {trackedRows.map(([k, v, note]) => (
                <tr key={k} className="border-t border-slate-100 first:border-0">
                  <th scope="row" className="py-2 pr-3 text-left align-top font-medium text-slate-800">
                    {k}
                    {note && <span className="block text-[11px] font-normal text-slate-500">{note}</span>}
                  </th>
                  <td className="py-2 text-right align-top font-display text-lg font-black text-plum-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AnalyticsCard>

        <AnalyticsCard title="Modeled estimates" subtitle="Based on your assumptions — every number shows its math">
          <dl className="space-y-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3">
              <dt className="text-xs font-semibold text-emerald-900">Estimated staff time saved by automation</dt>
              <dd className="mt-0.5 font-display text-2xl font-black text-emerald-900">
                {roi.modeled.staffHoursSaved} h <span className="text-base font-bold">≈ {usd(roi.modeled.staffCostSaved)}</span>
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs font-semibold text-slate-700">Estimated staff time spent on interventions</dt>
              <dd className="mt-0.5 font-display text-xl font-black text-slate-800">
                {roi.modeled.interventionStaffHours} h <span className="text-sm font-bold">≈ {usd(roi.modeled.interventionStaffCost)}</span>
              </dd>
            </div>
            <div className="rounded-lg bg-plum-50 p-3">
              <dt className="text-xs font-semibold text-plum-900">Estimated value of mentorship time</dt>
              <dd className="mt-0.5 font-display text-xl font-black text-plum-900">
                {roi.modeled.mentorshipValue === null ? "Not set" : usd(roi.modeled.mentorshipValue)}
              </dd>
            </div>
          </dl>
          <ul className="mt-4 list-disc space-y-1 pl-4 text-[11px] text-slate-600">
            {roi.formulas.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </AnalyticsCard>
      </div>

      <AnalyticsCard
        title="Assumptions"
        subtitle={scope.platform && !scope.school ? "Editing the default every school inherits" : `Applies to ${scope.school}`}
        footnote="Change these to match your program. Saving is recorded in the audit log."
      >
        <SettingsForm settingKey="roi" fields={ROI_FIELDS} initial={assumptions} school={scope.platform ? scope.school ?? undefined : undefined} />
      </AnalyticsCard>
    </div>
  );
}
