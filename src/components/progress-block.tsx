import type { StudentKpis } from "@/lib/kpis";

// Larger "Progress This Week / Month" block used at the top of each My
// Mentees card. The compact KpiChips component still exists for any other
// place that needs the dense inline version.
//
// Color rules:
//   - complete (1/1 weekly, 3/3 monthly): emerald
//   - incomplete this period: slate
//   - incomplete + ≥14 days since last career_task log: amber alert
export function ProgressBlock({
  kpis,
  daysSinceLastCareerTask,
}: {
  kpis: StudentKpis;
  daysSinceLastCareerTask?: number | null;
}) {
  const stale =
    daysSinceLastCareerTask != null && daysSinceLastCareerTask >= 14;

  return (
    <section
      aria-label="Progress this week and month"
      className="rounded-xl border border-byui-blue-light/40 bg-gradient-to-br from-byui-blue-light/30 to-white p-3"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-byui-blue-dark">
        Progress This Week / Month
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Stat
          label="Weekly Career Task"
          value={`${kpis.weeklyCareerTask.done}/${kpis.weeklyCareerTask.goal}`}
          tone={
            kpis.weeklyCareerTask.complete
              ? "emerald"
              : stale
                ? "amber"
                : "slate"
          }
        />
        <Stat
          label="Career Chats"
          value={`${kpis.monthlyCareerChats.done}/${kpis.monthlyCareerChats.goal}`}
          tone={
            kpis.monthlyCareerChats.complete
              ? "emerald"
              : kpis.monthlyCareerChats.done === 0 && stale
                ? "amber"
                : "slate"
          }
        />
        <Stat
          label="Weekly Streak"
          value={kpis.weeklyStreak === 0 ? "—" : `${kpis.weeklyStreak}w`}
          tone={
            kpis.weeklyStreak >= 2 && !kpis.thisWeekIncomplete
              ? "emerald"
              : "slate"
          }
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "slate" | "amber";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={"rounded-lg border px-2 py-1.5 text-center " + cls}>
      <p className="font-display text-lg font-black leading-tight md:text-xl">
        {value}
      </p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
    </div>
  );
}
