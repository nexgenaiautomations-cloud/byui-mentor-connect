import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";

function daysSince(d: Date) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function AdminMatchesPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");

  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      startedAt: matches.startedAt,
      lastActivityAt: matches.lastActivityAt,
      endedAt: matches.endedAt,
      mentorName: mentor.name,
      mentorImage: mentor.image,
      mentorEmail: mentor.email,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      menteeEmail: mentee.email,
      meetingCount: sql<number>`(select count(*)::int from "meeting_log" where match_id = "match".id)`,
    })
    .from(matches)
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .orderBy(desc(matches.startedAt));

  const active = rows.filter((r) => r.status === "active");
  const stale = active.filter((r) => daysSince(r.lastActivityAt) > 30);
  const ended = rows.filter((r) => r.status !== "active");

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Pairings</p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">Matches</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every active and ended pairing across the program.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Active" value={active.length} tone="emerald" />
        <StatTile label="Stale (30d+)" value={stale.length} tone="amber" />
        <StatTile label="Ended" value={ended.length} tone="slate" />
        <StatTile
          label="Total meetings"
          value={rows.reduce((acc, r) => acc + (r.meetingCount ?? 0), 0)}
          tone="navy"
        />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-navy-800">Active</h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500">No active matches yet.</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Mentor</th>
                    <th className="px-3 py-3">Mentee</th>
                    <th className="px-3 py-3">Meetings</th>
                    <th className="px-3 py-3">Started</th>
                    <th className="px-5 py-3">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {active.map((m) => {
                    const inactive = daysSince(m.lastActivityAt);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <PersonCell name={m.mentorName} image={m.mentorImage} email={m.mentorEmail} />
                        </td>
                        <td className="px-3 py-3">
                          <PersonCell name={m.menteeName} image={m.menteeImage} email={m.menteeEmail} />
                        </td>
                        <td className="px-3 py-3 text-slate-700">{m.meetingCount}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {new Date(m.startedAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={
                              inactive > 30
                                ? "pill-pending"
                                : inactive > 14
                                ? "pill bg-amber-50 text-amber-700 border-amber-200"
                                : "pill-accepted"
                            }
                          >
                            {inactive}d ago
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {ended.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-navy-800">Ended</h2>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Mentor</th>
                    <th className="px-3 py-3">Mentee</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-5 py-3">Ended</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ended.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <PersonCell name={m.mentorName} image={m.mentorImage} email={m.mentorEmail} />
                      </td>
                      <td className="px-3 py-3">
                        <PersonCell name={m.menteeName} image={m.menteeImage} email={m.menteeEmail} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="pill-declined">{m.status}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {m.endedAt ? new Date(m.endedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PersonCell({
  name,
  image,
  email,
}: {
  name: string | null;
  image: string | null;
  email: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={
          image ||
          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || email || "")}&backgroundColor=1B3A6B&textColor=ffffff`
        }
        alt=""
        className="h-8 w-8 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-navy-800">{name ?? "—"}</p>
        <p className="truncate text-[11px] text-slate-500">{email}</p>
      </div>
    </div>
  );
}
