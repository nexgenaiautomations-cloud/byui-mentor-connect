import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { mentorApplications, users, matches, requests } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
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
      topics: mentorApplications.topics,
      capacity: mentorApplications.capacity,
      availability: mentorApplications.availability,
      applicantName: users.name,
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
    })
    .from(sql`(select 1) as _t`);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-navy-800">Admin</h1>
        <p className="mt-1 text-slate-600">Program overview and mentor application review.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Members" value={counts?.members ?? 0} />
        <Stat label="Mentors" value={counts?.mentors ?? 0} />
        <Stat label="Active matches" value={counts?.activeMatches ?? 0} />
        <Stat label="Pending requests" value={counts?.pendingRequests ?? 0} />
      </section>

      <section>
        <h2 className="font-display text-xl font-bold text-navy-800">Mentor applications</h2>
        <div className="mt-4 space-y-3">
          {apps.length === 0 && <p className="text-sm text-slate-500">No applications yet.</p>}
          {apps.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-bold text-navy-800">{a.applicantName}</p>
                  <p className="text-sm text-slate-600">
                    {a.applicantEmail} · {a.applicantMajor}
                  </p>
                </div>
                <span className="pill">{a.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{a.motivation}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(a.topics ?? []).map((t) => (
                  <span key={t} className="pill">{t}</span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Capacity {a.capacity} · {a.availability || "no availability listed"}
              </p>
              {a.status === "pending" && <ApplicationActions id={a.id} />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="font-display text-3xl font-bold text-navy-800">{value}</p>
    </div>
  );
}
