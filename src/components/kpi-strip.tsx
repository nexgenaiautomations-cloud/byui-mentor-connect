import type { StudentKpis } from "@/lib/kpis";

// Three-card KPI summary used at the top of the mentee dashboard and the
// student Log an Activity page. Server-rendered — values come from
// getStudentKpis(). The mentor My Mentees view uses the compact KpiChips
// component instead (more dense, fits inside a card).

export function KpiStrip({ kpis }: { kpis: StudentKpis }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <KpiCard
        label="Weekly Career Task"
        value={`${kpis.weeklyCareerTask.done}/${kpis.weeklyCareerTask.goal}`}
        progress={Math.min(
          1,
          kpis.weeklyCareerTask.done / kpis.weeklyCareerTask.goal
        )}
        hint={
          kpis.weeklyCareerTask.complete
            ? "Done this week"
            : "Log one Career Task to complete"
        }
        complete={kpis.weeklyCareerTask.complete}
      />
      <KpiCard
        label="Monthly Career Chats"
        value={`${kpis.monthlyCareerChats.done}/${kpis.monthlyCareerChats.goal}`}
        progress={Math.min(
          1,
          kpis.monthlyCareerChats.done / kpis.monthlyCareerChats.goal
        )}
        hint={
          kpis.monthlyCareerChats.complete
            ? "All three logged this month"
            : `${
                kpis.monthlyCareerChats.goal - kpis.monthlyCareerChats.done
              } more to reach the monthly goal`
        }
        complete={kpis.monthlyCareerChats.complete}
      />
      <KpiCard
        label="Weekly Streak"
        value={kpis.weeklyStreak === 0 ? "0 weeks" : `${kpis.weeklyStreak}w`}
        progress={kpis.weeklyStreak > 0 ? 1 : 0}
        hint={
          kpis.weeklyStreak === 0
            ? "Log a Career Task to start your streak"
            : kpis.thisWeekIncomplete
              ? "This week incomplete — log to keep it alive"
              : "Streak going strong"
        }
        complete={kpis.weeklyStreak > 0 && !kpis.thisWeekIncomplete}
        streakFlame={kpis.weeklyStreak >= 2}
      />
    </section>
  );
}

function KpiCard({
  label,
  value,
  progress,
  hint,
  complete,
  streakFlame,
}: {
  label: string;
  value: string;
  progress: number;
  hint: string;
  complete: boolean;
  streakFlame?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 shadow-soft " +
        (complete
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-byui-blue-light/40 bg-white")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        {complete && (
          <span className="text-emerald-600" aria-label="complete">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L9 11.6l6.3-6.3a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
        {streakFlame && !complete && (
          <span className="text-orange-500" aria-label="streak active">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2c1 4-2 5-2 8a3 3 0 0 0 6 0c0-1-.4-2-1-3 3 2 5 5 5 9a8 8 0 1 1-15.5-3C5 9 9 8 12 2z" />
            </svg>
          </span>
        )}
      </div>
      <p className="mt-1 font-display text-2xl font-black text-byui-blue-dark">
        {value}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={
            "h-full transition-all " +
            (complete ? "bg-emerald-500" : "bg-byui-blue")
          }
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
