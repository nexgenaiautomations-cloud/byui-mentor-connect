import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { mentorApplications, users, matches, requests, meetingLogs } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";
import { ApplicationActions } from "./actions";

export default async function AdminPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const apps = await db
    .select({
      id: mentorApplications.id,
      status: mentorApplications.status,
      submittedAt: mentorApplications.submittedAt,
      motivation: mentorApplications.motivation,
      informationalInterviews: mentorApplications.informationalInterviews,
      internshipsCount: mentorApplications.internshipsCount,
      capacity: mentorApplications.capacity,
      applicantName: users.name,
      applicantImage: users.image,
      applicantEmail: users.email,
      applicantMajor: users.major,
    })
    .from(mentorApplications)
    .innerJoin(users, eq(users.id, mentorApplications.userId))
    .orderBy(desc(mentorApplications.submittedAt));

  const [counts] = await db
    .select({
      members: sql<number>`(select count(*)::int from "user")`,
      mentors: sql<number>`(select count(*)::int from "user" where is_mentor = true)`,
      activeMatches: sql<number>`(select count(*)::int from "match" where status = 'active')`,
      pendingRequests: sql<number>`(select count(*)::int from "request" where status = 'pending')`,
      meetingLogs: sql<number>`(select count(*)::int from "meeting_log")`,
      pendingApps: sql<number>`(select count(*)::int from "mentor_application" where status = 'pending')`,
    })
    .from(sql`(select 1) as _t`);

  const recentMatchesRows = await db
    .select({
      id: matches.id,
      startedAt: matches.startedAt,
      mentorId: matches.mentorId,
      menteeId: matches.menteeId,
    })
    .from(matches)
    .where(eq(matches.status, "active"))
    .orderBy(desc(matches.startedAt))
    .limit(5);

  const recentLogs = await db
    .select({
      id: meetingLogs.id,
      meetingDate: meetingLogs.meetingDate,
      topicsDiscussed: meetingLogs.topicsDiscussed,
    })
    .from(meetingLogs)
    .orderBy(desc(meetingLogs.createdAt))
    .limit(5);

  const pendingApps = apps.filter((a) => a.status === "pending");
  const reviewedApps = apps.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Program</p>
          <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">Admin dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Program overview, mentor application review, recent activity.
          </p>
        </div>
        <Link href="/admin/analytics" className="btn-gold">
          Full analytics →
        </Link>
      </header>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Members"      value={counts?.members ?? 0}        tone="navy"    hint="Registered" />
        <StatTile label="Mentors"      value={counts?.mentors ?? 0}        tone="emerald" hint="Approved" />
        <StatTile label="Matches"      value={counts?.activeMatches ?? 0}  tone="violet"  hint="Active" />
        <StatTile label="Requests"     value={counts?.pendingRequests ?? 0} tone="amber"   hint="Pending" />
        <StatTile label="Meetings"     value={counts?.meetingLogs ?? 0}    tone="sky"     hint="All time" />
        <StatTile label="To review"    value={counts?.pendingApps ?? 0}    tone="gold"    hint="Applications" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-navy-800">
              Mentor applications · pending
            </h2>
            <span className="pill">{pendingApps.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {pendingApps.length === 0 && (
              <p className="text-sm text-slate-500">Nothing in the queue. Nice work.</p>
            )}
            {pendingApps.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        a.applicantImage ||
                        `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(a.applicantName || "")}&backgroundColor=1B3A6B&textColor=ffffff`
                      }
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-semibold text-navy-800">{a.applicantName}</p>
                      <p className="text-xs text-slate-500">{a.applicantEmail} · {a.applicantMajor}</p>
                    </div>
                  </div>
                  <span className="pill">capacity {a.capacity}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{a.motivation}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.informationalInterviews && (
                    <span className="pill">Career chats: {a.informationalInterviews}</span>
                  )}
                  {a.internshipsCount && (
                    <span className="pill">Internships: {a.internshipsCount}</span>
                  )}
                </div>
                <ApplicationActions id={a.id} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-lg font-bold text-navy-800">Recent matches</h2>
            {recentMatchesRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No matches yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {recentMatchesRows.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-700">Match opened</span>
                    <span className="text-xs text-slate-500">{new Date(m.startedAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-bold text-navy-800">Recent meeting logs</h2>
            {recentLogs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No meetings logged yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {recentLogs.map((l) => (
                  <li key={l.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-navy-800">
                      {new Date(l.meetingDate).toLocaleDateString()}
                    </p>
                    {l.topicsDiscussed && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{l.topicsDiscussed}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {reviewedApps.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-navy-800">Reviewed applications</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {reviewedApps.map((a) => (
              <div key={a.id} className="card flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy-800">{a.applicantName}</p>
                  <p className="text-xs text-slate-500">{a.applicantEmail}</p>
                </div>
                <span className={a.status === "approved" ? "pill-accepted" : "pill-declined"}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-400">
        Tip: searchable user lookup, charts, and pagination land in v2.{" "}
        <Link href="/dashboard" className="text-navy-700 underline">Back to member view</Link>.
      </p>
    </div>
  );
}
