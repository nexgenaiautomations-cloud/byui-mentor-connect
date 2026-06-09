import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listAchievementsForStudent } from "@/lib/achievements";
import { TrophyBadge } from "@/components/trophy-badge";

export default async function TrophyCasePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");
  // Admins (pure) don't have a trophy case — they have program-wide views.
  if (me.isAdmin && !me.isMentor) redirect("/admin");

  const achievements = await listAchievementsForStudent(me.id);
  const earned = achievements.filter((a) => a.isEarned);
  const locked = achievements.filter((a) => !a.isEarned);

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
          {earned.length === 0
            ? "Log your first activity to start earning trophies."
            : `${earned.length} of ${achievements.length} earned. Keep going.`}
        </p>
      </header>

      {earned.length > 0 && (
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
            Earned
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {earned.map((a) => (
              <BadgeCard key={a.key} achievement={a} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {earned.length === 0 ? "Available" : "Still to unlock"}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locked.map((a) => (
            <BadgeCard key={a.key} achievement={a} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BadgeCard({
  achievement,
}: {
  achievement: {
    key: string;
    title: string;
    description: string;
    isEarned: boolean;
    earnedAt: Date | null;
  };
}) {
  const { key, title, description, isEarned, earnedAt } = achievement;
  return (
    <div
      className={
        "flex gap-3 rounded-2xl border p-4 transition " +
        (isEarned
          ? "border-byui-blue-light/50 bg-white shadow-soft"
          : "border-slate-200 bg-slate-50/70 opacity-70")
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
      </div>
    </div>
  );
}
