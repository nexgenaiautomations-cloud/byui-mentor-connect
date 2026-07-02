import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

export default async function AdminMentorsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      major: users.major,
      semesterLevel: users.semesterLevel,
      expectedGraduation: users.expectedGraduation,
      bio: users.bio,
      mentorTopics: users.mentorTopics,
      mentorCapacity: users.mentorCapacity,
      mentorAvailable: users.mentorAvailable,
      activeCount: sql<number>`(select count(*)::int from "match" where mentor_id = "user".id and status = 'active')`,
      totalMeetings: sql<number>`(select count(*)::int from "meeting_log" where mentor_id = "user".id)`,
    })
    .from(users)
    .where(eq(users.isMentor, true));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Directory</p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">Mentors</h1>
        <p className="mt-1 text-sm text-slate-600">
          {rows.length} approved · {rows.filter((r) => r.mentorAvailable).length} accepting requests right now
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((m) => {
          const slotsLeft = (m.mentorCapacity ?? 0) - (m.activeCount ?? 0);
          return (
            <article key={m.id} className="card flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    m.image ||
                    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(m.name || m.email)}&backgroundColor=1B3A6B&textColor=ffffff`
                  }
                  alt=""
                  className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold text-navy-800">
                    {m.name || "Mentor"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {m.major}
                    {m.semesterLevel ? ` · ${m.semesterLevel}` : ""}
                    {m.expectedGraduation ? ` · grad ${m.expectedGraduation}` : ""}
                  </p>
                </div>
              </div>

              {m.bio && <p className="line-clamp-2 text-sm text-slate-600">{m.bio}</p>}

              {m.mentorTopics && m.mentorTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.mentorTopics.slice(0, 4).map((t) => (
                    <span key={t} className="pill">{t}</span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Capacity</p>
                  <p className="font-display text-sm font-bold text-navy-800">
                    {m.activeCount}/{m.mentorCapacity}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Slots left</p>
                  <p className="font-display text-sm font-bold text-emerald-700">{Math.max(slotsLeft, 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Meetings</p>
                  <p className="font-display text-sm font-bold text-navy-800">{m.totalMeetings}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className={m.mentorAvailable ? "text-emerald-700" : "text-slate-500"}>
                  {m.mentorAvailable ? "Accepting requests" : "Paused"}
                </span>
                <a href={`mailto:${m.email}`} className="font-semibold text-navy-700 hover:underline">
                  Email mentor →
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
