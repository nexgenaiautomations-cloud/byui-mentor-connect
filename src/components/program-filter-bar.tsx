// Shared GET filter form for the program analytics pages. Server component:
// submitting reloads the page with query params, so filters are linkable and
// work without client JavaScript.
import { DEPARTMENT_OPTIONS, RANGE_PRESETS, type ResolvedRange } from "@/lib/reports";
import type { ProgramFilters } from "@/lib/effectiveness-server";

const select =
  "mt-1 block min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-plum-500 focus:outline-none focus:ring-2 focus:ring-plum-200";
const label = "text-xs font-semibold text-slate-700";

export function ProgramFilterBar({
  action,
  filters,
  range,
  options,
  showRange = true,
  isPlatform,
}: {
  action: string;
  filters: ProgramFilters;
  range?: ResolvedRange;
  options: { majors: string[]; pods: string[]; cohorts: string[]; schools: string[] };
  showRange?: boolean;
  isPlatform: boolean;
}) {
  return (
    <form method="get" action={action} className="card grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Filters">
      {isPlatform && (
        <label className={label}>
          School
          <select name="school" aria-label="School" defaultValue={filters.school} className={select}>
            <option value="">All schools</option>
            {options.schools.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      )}
      <label className={label}>
        Department
        <select name="department" aria-label="Department" defaultValue={filters.department} className={select}>
          <option value="">All</option>
          {DEPARTMENT_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Major
        <select name="major" aria-label="Major" defaultValue={filters.major} className={select}>
          <option value="">All</option>
          {options.majors.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Pod
        <select name="pod" aria-label="Pod" defaultValue={filters.pod} className={select}>
          <option value="">All</option>
          {options.pods.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        Cohort (joined)
        <select name="cohort" aria-label="Cohort (joined)" defaultValue={filters.cohort} className={select}>
          <option value="">All</option>
          {options.cohorts.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      {showRange && range && (
        <label className={label}>
          Period
          <select name="range" aria-label="Period" defaultValue={range.preset === "custom" ? "last_90" : range.preset} className={select}>
            {RANGE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
      )}
      <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-6">
        <button type="submit" className="btn-primary min-h-[44px]">Apply filters</button>
        <a href={action} className="btn-ghost min-h-[44px]">Reset</a>
      </div>
    </form>
  );
}

export function AnalyticsCard({
  title,
  subtitle,
  children,
  footnote,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footnote?: string;
}) {
  return (
    // min-w-0: grid items otherwise refuse to shrink below a wide table's
    // width, which pushed the page sideways on phones.
    <section className="card min-w-0">
      <h2 className="font-display text-base font-bold text-plum-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>}
      <div className="mt-4">{children}</div>
      {footnote && <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-500">{footnote}</p>}
    </section>
  );
}

export function filterQuery(filters: ProgramFilters, range?: ResolvedRange): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
  if (range) p.set("range", range.preset);
  return p.toString();
}
