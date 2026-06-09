import type { StudentKpis } from "@/lib/kpis";

// Compact KPI chips — used inside the mentor's My Mentees card. Designed to
// fit on one row alongside other inline metadata. The KpiStrip component
// (dashboard / log page) is the bigger version for primary surfaces.
//
// Color rules per spec:
//   - complete (1/1 or 3/3): emerald-tinted
//   - incomplete this period: neutral slate
//   - incomplete + ≥14 days since last career_tasks log: amber alert
export function KpiChips({
  kpis,
  daysSinceLastCareerTask,
}: {
  kpis: StudentKpis;
  daysSinceLastCareerTask?: number | null;
}) {
  const stale =
    daysSinceLastCareerTask != null && daysSinceLastCareerTask >= 14;

  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip
        label="Weekly"
        value={`${kpis.weeklyCareerTask.done}/${kpis.weeklyCareerTask.goal}`}
        tone={
          kpis.weeklyCareerTask.complete
            ? "emerald"
            : stale
              ? "amber"
              : "slate"
        }
      />
      <Chip
        label="Chats"
        value={`${kpis.monthlyCareerChats.done}/${kpis.monthlyCareerChats.goal}`}
        tone={
          kpis.monthlyCareerChats.complete
            ? "emerald"
            : kpis.monthlyCareerChats.done === 0 && stale
              ? "amber"
              : "slate"
        }
      />
      <Chip
        label="Streak"
        value={
          kpis.weeklyStreak === 0 ? "—" : `${kpis.weeklyStreak}w`
        }
        tone={
          kpis.weeklyStreak >= 2 && !kpis.thisWeekIncomplete
            ? "emerald"
            : "slate"
        }
      />
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "slate" | "amber";
}) {
  const classes =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        classes
      }
    >
      <span className="opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  );
}
