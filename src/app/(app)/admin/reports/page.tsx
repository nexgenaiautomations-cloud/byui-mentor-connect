import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { MAJOR_OPTIONS } from "@/lib/academic-options";
import { SEMESTER_LEVELS } from "@/lib/careers";
import {
  COUNT_THRESHOLDS,
  DEPARTMENT_OPTIONS,
  RANGE_PRESETS,
  ROLE_LABEL,
  applyFilters,
  parseFilters,
  resolveRange,
} from "@/lib/reports";
import { loadReport } from "@/lib/reports-server";
import { adminScopeFor } from "@/lib/admin-scope";

type Search = Record<string, string | undefined>;

function fmtDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
}

// /admin/reports — QuickBooks-style filtered report. Shaun Franklin, 2026-11-09.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const range = resolveRange({ preset: params.range, from: params.from, to: params.to });
  const filters = parseFilters(params);
  const { rows, matchesStarted, requestsMade } = await loadReport(range, adminScopeFor(me)!);
  const shown = applyFilters(rows, filters).sort((a, b) => b.points - a.points || (a.name ?? "").localeCompare(b.name ?? ""));

  const sum = (k: "activities" | "careerTasks" | "industryExperiences" | "careerChats" | "points") =>
    shown.reduce((s, r) => s + r[k], 0);
  const active = shown.filter((r) => r.activities > 0).length;
  const joined = shown.filter((r) => r.joinedInRange).length;

  const qs = new URLSearchParams(
    Object.entries({ ...params, range: range.preset, from: range.from, to: range.to }).filter(
      (e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""
    )
  ).toString();

  const select = "mt-1 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900";
  const label = "text-xs font-semibold text-slate-700";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">Analytics</p>
          <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            {fmtDay(range.from)} – {fmtDay(range.to)} · {shown.length} of {rows.length} people match
          </p>
        </div>
        <a
          href={`/api/admin/reports/csv?${qs}`}
          className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-brand/40 bg-white px-3 py-1.5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-light/20"
        >
          Export CSV
        </a>
      </header>

      <form method="get" className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>
          Date range
          <select name="range" defaultValue={range.preset} className={select}>
            {RANGE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          From <span className="font-normal text-slate-500">(custom)</span>
          <input type="date" name="from" defaultValue={range.from} className={select} />
        </label>
        <label className={label}>
          To <span className="font-normal text-slate-500">(custom)</span>
          <input type="date" name="to" defaultValue={range.to} className={select} />
        </label>
        <label className={label}>
          Role
          <select name="role" defaultValue={filters.role ?? ""} className={select}>
            <option value="">Everyone</option>
            {Object.entries(ROLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Department
          <select name="department" defaultValue={filters.department ?? ""} className={select}>
            <option value="">All departments</option>
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Major
          <select name="major" defaultValue={filters.major ?? ""} className={select}>
            <option value="">All majors</option>
            {MAJOR_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Year in school
          <select name="year" defaultValue={filters.year ?? ""} className={select}>
            <option value="">All years</option>
            {SEMESTER_LEVELS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Active mentees
          <select name="mentees" defaultValue={filters.minMentees?.toString() ?? ""} className={select}>
            <option value="">Any</option>
            {COUNT_THRESHOLDS.filter((n) => n > 0).map((n) => (
              <option key={n} value={n}>{n} or more</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Informational interviews / career chats
          <select name="interviews" defaultValue={filters.minInterviews?.toString() ?? ""} className={select}>
            <option value="">Any</option>
            {COUNT_THRESHOLDS.filter((n) => n > 0).map((n) => (
              <option key={n} value={n}>{n} or more in range</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="min-h-10 cursor-pointer rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
            Run report
          </button>
          <a href="/admin/reports" className="inline-flex min-h-10 cursor-pointer items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Reset
          </a>
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Activity logs", sum("activities")],
          ["Career chats", sum("careerChats")],
          ["Industry experiences", sum("industryExperiences")],
          ["Career tasks", sum("careerTasks")],
          ["Points", sum("points")],
          ["Active people", active],
          ["New members", joined],
          ["Matches started", matchesStarted],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{l}</p>
            <p className="mt-1 font-display text-2xl font-black tabular-nums text-plum-800">{v}</p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-slate-600">
        Matches started and mentor requests ({requestsMade}) cover the whole program for the date range; the other
        totals follow your filters.
      </p>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-2">Person</th>
                <th scope="col" className="px-3 py-2">Role</th>
                <th scope="col" className="px-3 py-2">Department · Major</th>
                <th scope="col" className="px-3 py-2">Year</th>
                <th scope="col" className="px-3 py-2 text-right">Mentees</th>
                <th scope="col" className="px-3 py-2 text-right">Logs</th>
                <th scope="col" className="px-3 py-2 text-right">Chats</th>
                <th scope="col" className="px-3 py-2 text-right">Industry</th>
                <th scope="col" className="px-4 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-600">
                    Nobody matches these filters for this date range.
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <p className="font-semibold text-slate-900">{r.name || "—"}</p>
                      <p className="text-xs text-slate-600">{r.email}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{ROLE_LABEL[r.role]}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.department}
                      {r.major ? <span className="block text-xs text-slate-600">{r.major}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{r.semesterLevel || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.activeMentees}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.activities}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.careerChats}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.industryExperiences}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{r.points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
