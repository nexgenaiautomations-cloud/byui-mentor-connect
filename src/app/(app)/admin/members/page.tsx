import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

export default async function AdminMembersPage() {
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
      isMentor: users.isMentor,
      isAdmin: users.isAdmin,
      onboardedAt: users.onboardedAt,
      createdAt: users.createdAt,
      activeMatches: sql<number>`(select count(*)::int from "match" where (mentor_id = "user".id or mentee_id = "user".id) and status = 'active')`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const counts = {
    total: rows.length,
    mentors: rows.filter((r) => r.isMentor).length,
    admins: rows.filter((r) => r.isAdmin).length,
    onboarded: rows.filter((r) => r.onboardedAt).length,
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Directory</p>
        <h1 className="mt-1 font-display text-3xl font-black text-navy-800">Members</h1>
        <p className="mt-1 text-sm text-slate-600">
          {counts.total} registered · {counts.mentors} mentors · {counts.admins} admins · {counts.onboarded} onboarded
        </p>
      </header>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-3 py-3">Major</th>
                <th className="px-3 py-3">Semester</th>
                <th className="px-3 py-3">Expected grad</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Active matches</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          u.image ||
                          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u.name || u.email)}&backgroundColor=1B3A6B&textColor=ffffff`
                        }
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-semibold text-navy-800">{u.name || "—"}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{u.major || "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{u.semesterLevel || "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{u.expectedGraduation || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.isAdmin && <span className="pill bg-rose-50 text-rose-700 border-rose-100">Admin</span>}
                      {u.isMentor && <span className="pill bg-emerald-50 text-emerald-700 border-emerald-100">Mentor</span>}
                      {!u.isMentor && !u.isAdmin && <span className="pill">Member</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{u.activeMatches}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
