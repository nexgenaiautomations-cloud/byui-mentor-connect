import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { meetingLogs, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";

export default async function AdminMeetingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");

  const logs = await db
    .select({
      id: meetingLogs.id,
      meetingDate: meetingLogs.meetingDate,
      meetingType: meetingLogs.meetingType,
      durationMinutes: meetingLogs.durationMinutes,
      topicsDiscussed: meetingLogs.topicsDiscussed,
      mentorName: mentor.name,
      mentorImage: mentor.image,
      menteeName: mentee.name,
      menteeImage: mentee.image,
    })
    .from(meetingLogs)
    .innerJoin(mentor, eq(mentor.id, meetingLogs.mentorId))
    .innerJoin(mentee, eq(mentee.id, meetingLogs.menteeId))
    .orderBy(desc(meetingLogs.meetingDate))
    .limit(100);

  const [totals] = await db
    .select({
      total: sql<number>`(select count(*)::int from "meeting_log")`,
      totalMinutes: sql<number>`(select coalesce(sum(duration_minutes), 0)::int from "meeting_log")`,
      thisMonth: sql<number>`(select count(*)::int from "meeting_log" where meeting_date >= now() - interval '30 days')`,
    })
    .from(sql`(select 1) as _t`);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Program logs</p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">Meetings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every meeting logged across the program.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="All time" value={totals?.total ?? 0} tone="navy" />
        <StatTile label="Last 30 days" value={totals?.thisMonth ?? 0} tone="emerald" />
        <StatTile
          label="Total minutes"
          value={(totals?.totalMinutes ?? 0).toLocaleString()}
          tone="sky"
        />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-navy-800">Recent</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No meetings logged yet.</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <ul className="divide-y divide-slate-100">
              {logs.map((l) => (
                <li key={l.id} className="px-4 py-3 hover:bg-slate-50 sm:px-5">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center -space-x-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          l.mentorImage ||
                          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(l.mentorName ?? "M")}&backgroundColor=1B3A6B&textColor=ffffff`
                        }
                        alt=""
                        className="h-8 w-8 rounded-full border-2 border-white object-cover"
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          l.menteeImage ||
                          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(l.menteeName ?? "X")}&backgroundColor=7c3aed&textColor=ffffff`
                        }
                        alt=""
                        className="h-8 w-8 rounded-full border-2 border-white object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-navy-800">
                          {l.mentorName} → {l.menteeName}
                        </p>
                        <span className="pill capitalize">{l.meetingType.replace("_", " ")}</span>
                        <span className="text-xs text-slate-500">
                          {l.durationMinutes ? `${l.durationMinutes} min` : "—"}
                        </span>
                      </div>
                      {l.topicsDiscussed && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{l.topicsDiscussed}</p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-slate-500">
                      {new Date(l.meetingDate).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
