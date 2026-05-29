import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { mentorApplications } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { ApplyForm } from "./form";

export default async function ApplyMentorPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const recent = await db
    .select()
    .from(mentorApplications)
    .where(eq(mentorApplications.userId, me.id))
    .orderBy(desc(mentorApplications.submittedAt))
    .limit(5);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-gold-700">Pay it forward</p>
        <h1 className="mt-1 font-display text-3xl font-black text-navy-800">Apply to mentor</h1>
        <p className="mt-1 text-slate-600">
          Every member is welcome to apply. An admin reviews your application and approves it
          once you&apos;re ready to take on mentees.
        </p>
      </header>

      {me.isMentor && (
        <div className="card border-emerald-200 bg-emerald-50">
          <p className="font-semibold text-emerald-800">You&apos;re already an approved mentor.</p>
          <p className="mt-1 text-sm text-emerald-700">
            You can update your availability and topics from your profile.
          </p>
        </div>
      )}

      <div className="card">
        <ApplyForm hasOpenApplication={recent.some((r) => r.status === "pending")} />
      </div>

      {recent.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-navy-800">Your applications</h2>
          <ul className="mt-3 space-y-2">
            {recent.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm flex items-center justify-between">
                <span className="text-slate-600">
                  Submitted {new Date(r.submittedAt).toLocaleDateString()}
                </span>
                <span className="pill">{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
