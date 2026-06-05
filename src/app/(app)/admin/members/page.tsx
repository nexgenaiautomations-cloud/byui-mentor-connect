import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { mentorApplications, users } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { MembersTable, type MemberRow } from "./members-table";

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
      minor: users.minor,
      semesterLevel: users.semesterLevel,
      expectedGraduation: users.expectedGraduation,
      careerInterests: users.careerInterests,
      isMentor: users.isMentor,
      isAdmin: users.isAdmin,
      mentorAvailable: users.mentorAvailable,
      mentorCapacity: users.mentorCapacity,
      onboardedAt: users.onboardedAt,
      createdAt: users.createdAt,
      activeMatches: sql<number>`(select count(*)::int from "match" where (mentor_id = "user".id or mentee_id = "user".id) and status = 'active')`,
      recentActivityCount: sql<number>`(select count(*)::int from "meeting_log" where (mentor_id = "user".id or mentee_id = "user".id) and created_at > now() - interval '90 days')`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  // Most recent application per user — we surface it on the profile modal so
  // the admin gets the full picture without leaving the Members tab. Private
  // mentor review notes are NOT selected here on purpose.
  const apps = await db
    .select({
      userId: mentorApplications.userId,
      status: mentorApplications.status,
      submittedAt: mentorApplications.submittedAt,
      reviewedAt: mentorApplications.reviewedAt,
      motivation: mentorApplications.motivation,
      informationalInterviews: mentorApplications.informationalInterviews,
      internshipsCount: mentorApplications.internshipsCount,
      capacity: mentorApplications.capacity,
    })
    .from(mentorApplications)
    .orderBy(desc(mentorApplications.submittedAt));
  const latestAppByUser = new Map<string, (typeof apps)[number]>();
  for (const a of apps) {
    if (!latestAppByUser.has(a.userId)) latestAppByUser.set(a.userId, a);
  }

  const memberRows: MemberRow[] = rows.map((u) => {
    const app = latestAppByUser.get(u.id) ?? null;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      major: u.major,
      minor: u.minor,
      semesterLevel: u.semesterLevel,
      expectedGraduation: u.expectedGraduation,
      careerInterests: u.careerInterests,
      isMentor: u.isMentor,
      isAdmin: u.isAdmin,
      mentorAvailable: u.mentorAvailable,
      mentorCapacity: u.mentorCapacity,
      onboardedAt: u.onboardedAt ? u.onboardedAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      activeMatches: u.activeMatches,
      recentActivityCount: u.recentActivityCount,
      application: app
        ? {
            status: app.status,
            submittedAt: app.submittedAt.toISOString(),
            reviewedAt: app.reviewedAt ? app.reviewedAt.toISOString() : null,
            motivation: app.motivation,
            informationalInterviews: app.informationalInterviews,
            internshipsCount: app.internshipsCount,
            capacity: app.capacity,
          }
        : null,
    };
  });

  const counts = {
    total: memberRows.length,
    mentors: memberRows.filter((r) => r.isMentor).length,
    admins: memberRows.filter((r) => r.isAdmin).length,
    onboarded: memberRows.filter((r) => r.onboardedAt).length,
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Directory</p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">Members</h1>
        <p className="mt-1 text-sm text-slate-600">
          {counts.total} registered · {counts.mentors} mentors · {counts.admins} admins · {counts.onboarded} onboarded
        </p>
      </header>

      <MembersTable rows={memberRows} />
    </div>
  );
}
