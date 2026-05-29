import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { mentorApplications, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { ApplicationActions } from "../actions";
import { EmptyState } from "@/components/empty-state";

export default async function AdminApplicationsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const apps = await db
    .select({
      id: mentorApplications.id,
      status: mentorApplications.status,
      submittedAt: mentorApplications.submittedAt,
      reviewedAt: mentorApplications.reviewedAt,
      motivation: mentorApplications.motivation,
      topics: mentorApplications.topics,
      capacity: mentorApplications.capacity,
      applicantName: users.name,
      applicantImage: users.image,
      applicantEmail: users.email,
      applicantMajor: users.major,
    })
    .from(mentorApplications)
    .innerJoin(users, eq(users.id, mentorApplications.userId))
    .orderBy(desc(mentorApplications.submittedAt));

  const pending = apps.filter((a) => a.status === "pending");
  const reviewed = apps.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mentor pipeline</p>
        <h1 className="mt-1 font-display text-3xl font-black text-navy-800">Applications</h1>
        <p className="mt-1 text-sm text-slate-600">
          {pending.length} pending · {reviewed.length} reviewed.
        </p>
      </header>

      <section>
        <h2 className="font-display text-lg font-bold text-navy-800">Pending</h2>
        <div className="mt-4 space-y-3">
          {pending.length === 0 && (
            <EmptyState
              kind="application"
              title="No pending applications"
              message="Inbox zero. New mentor applications will show up here for your review."
            />
          )}
          {pending.map((a) => (
            <div key={a.id} className="card">
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
              {a.topics && a.topics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.topics.map((t) => (
                    <span key={t} className="pill">{t}</span>
                  ))}
                </div>
              )}
              <ApplicationActions id={a.id} />
            </div>
          ))}
        </div>
      </section>

      {reviewed.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-navy-800">Reviewed</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {reviewed.map((a) => (
              <div key={a.id} className="card flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy-800">{a.applicantName}</p>
                  <p className="text-xs text-slate-500">{a.applicantEmail}</p>
                  {a.reviewedAt && (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Reviewed {new Date(a.reviewedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className={a.status === "approved" ? "pill-accepted" : "pill-declined"}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
