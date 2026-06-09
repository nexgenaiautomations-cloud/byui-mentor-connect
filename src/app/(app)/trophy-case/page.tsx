import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {
  listAchievementsForStudent,
  type AchievementListing,
  type AchievementTier,
} from "@/lib/achievements";
import { getTrophyStats } from "@/lib/trophy-stats";
import { TrophyBadge } from "@/components/trophy-badge";

export default async function TrophyCasePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");
  if (me.isAdmin && !me.isMentor) redirect("/admin");

  const [achievements, stats] = await Promise.all([
    listAchievementsForStudent(me.id),
    getTrophyStats(me.id),
  ]);
  const earnedCount = achievements.filter((a) => a.isEarned).length;

  const byTier: Record<AchievementTier, AchievementListing[]> = {
    starter: [],
    progressive: [],
    hard: [],
  };
  for (const a of achievements) byTier[a.tier].push(a);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Trophy Case
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-byui-blue-dark">
          Your achievements
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {earnedCount === 0
            ? "Log your first activity to start earning trophies."
            : `${earnedCount} of ${achievements.length} earned. Keep going.`}
        </p>
      </header>

      {/* ===== KPI cards ===== */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Career Chats"
          value={String(stats.totalCareerChats)}
          hint={
            stats.priorCareerChats > 0
              ? `Includes prior experience + logged chats`
              : "Logged in BYUI CAN"
          }
          tone="emerald"
        />
        <KpiCard
          label="Current Weekly Streak"
          value={
            stats.weeklyStreak === 0
              ? "0 weeks"
              : stats.weeklyStreak === 1
                ? "1 week"
                : `${stats.weeklyStreak} weeks`
          }
          hint={
            stats.thisWeekIncomplete && stats.weeklyStreak > 0
              ? "Log a Career Task to keep it alive"
              : stats.weeklyStreak === 0
                ? "Start your streak with a Career Task"
                : "Going strong"
          }
          tone="orange"
        />
        <KpiCard
          label="Career Tasks Completed"
          value={String(stats.totalCareerTasks)}
          hint="Lifetime across all weeks"
          tone="navy"
        />
        <KpiCard
          label="Achievements Earned"
          value={`${earnedCount} / ${achievements.length}`}
          hint={
            earnedCount === achievements.length
              ? "You've earned them all 🏆"
              : "Tier breakdown below"
          }
          tone="violet"
        />
      </section>

      {/* ===== Tier sections ===== */}
      <TierSection
        title="Starter Trophies"
        blurb="Quick wins. Most students earn these in the first month."
        items={byTier.starter}
      />
      <TierSection
        title="Progressive Trophies"
        blurb="Milestones that build with time and consistency."
        items={byTier.progressive}
      />
      <TierSection
        title="Hard Trophies"
        blurb="Long-haul achievements. Few earn these — and it shows."
        items={byTier.hard}
      />
    </div>
  );
}

function TierSection({
  title,
  blurb,
  items,
}: {
  title: string;
  blurb: string;
  items: AchievementListing[];
}) {
  if (items.length === 0) return null;
  const earned = items.filter((a) => a.isEarned).length;
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
            {title}
          </h2>
          <p className="text-xs text-slate-500">{blurb}</p>
        </div>
        <p className="text-xs font-semibold text-slate-600">
          {earned} / {items.length} earned
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <BadgeCard key={a.key} achievement={a} />
        ))}
      </div>
    </section>
  );
}

function BadgeCard({ achievement }: { achievement: AchievementListing }) {
  const { key, title, description, isEarned, earnedAt, progress } = achievement;
  return (
    <div
      className={
        "flex gap-3 rounded-2xl border p-4 transition " +
        (isEarned
          ? "border-byui-blue-light/50 bg-white shadow-soft"
          : "border-slate-200 bg-slate-50/70")
      }
    >
      <TrophyBadge achievementKey={key} earned={isEarned} />
      <div className="min-w-0 flex-1">
        <p
          className={
            "font-display text-sm font-black leading-tight " +
            (isEarned ? "text-byui-blue-dark" : "text-slate-500")
          }
        >
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-slate-600">
          {description}
        </p>
        {isEarned && earnedAt && (
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
            Earned{" "}
            {new Date(earnedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
        {!isEarned && progress && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>
                {progress.current} / {progress.target} {progress.unit}
              </span>
              <span className="text-slate-400">
                {Math.round((progress.current / progress.target) * 100)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-byui-blue transition-all"
                style={{
                  width: `${Math.min(100, Math.round((progress.current / progress.target) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "orange" | "navy" | "violet";
}) {
  const toneCls = {
    emerald:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-900",
    orange:
      "border-orange-200 bg-gradient-to-br from-orange-50 to-white text-orange-900",
    navy: "border-byui-blue-light/60 bg-gradient-to-br from-byui-blue-light/40 to-white text-byui-blue-dark",
    violet:
      "border-violet-200 bg-gradient-to-br from-violet-50 to-white text-violet-900",
  }[tone];
  return (
    <div className={"rounded-2xl border p-4 shadow-soft " + toneCls}>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-black md:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs opacity-80">{hint}</p>
    </div>
  );
}
