import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

export default async function MatchesPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");

  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      startedAt: matches.startedAt,
      mentorId: matches.mentorId,
      menteeId: matches.menteeId,
      mentorName: mentor.name,
      mentorEmail: mentor.email,
      mentorPhone: mentor.phone,
      mentorContact: mentor.preferredContactMethod,
      menteeName: mentee.name,
      menteeEmail: mentee.email,
      menteePhone: mentee.phone,
      menteeContact: mentee.preferredContactMethod,
    })
    .from(matches)
    .innerJoin(mentor, eq(matches.mentorId, mentor.id))
    .innerJoin(mentee, eq(matches.menteeId, mentee.id))
    .where(
      and(
        or(eq(matches.mentorId, me.id), eq(matches.menteeId, me.id)),
        eq(matches.status, "active")
      )
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-navy-800">Matches</h1>
        <p className="mt-1 text-slate-600">Active pairings — contact info is unlocked.</p>
      </header>

      {rows.length === 0 ? (
        <div className="card text-slate-600">
          No active matches yet. Browse mentors and send a request.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((m) => {
            const iAmMentor = m.mentorId === me.id;
            const counterpart = iAmMentor
              ? { name: m.menteeName, email: m.menteeEmail, phone: m.menteePhone, contact: m.menteeContact }
              : { name: m.mentorName, email: m.mentorEmail, phone: m.mentorPhone, contact: m.mentorContact };
            return (
              <div key={m.id} className="card flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="font-display text-lg font-bold text-navy-800">{counterpart.name}</p>
                  <span className="pill">{iAmMentor ? "Mentee" : "Mentor"}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-sm text-slate-700">
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <a href={`mailto:${counterpart.email}`} className="text-navy-700 hover:underline">
                      {counterpart.email}
                    </a>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p>{counterpart.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Preferred</p>
                    <p>{counterpart.contact || "—"}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Matched {new Date(m.startedAt).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
