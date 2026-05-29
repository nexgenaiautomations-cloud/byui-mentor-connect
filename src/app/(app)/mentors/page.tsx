import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { RequestButton } from "./request-button";

export default async function MentorsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const mentors = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      major: users.major,
      minor: users.minor,
      semesterLevel: users.semesterLevel,
      bio: users.bio,
      mentorTopics: users.mentorTopics,
      mentorCapacity: users.mentorCapacity,
    })
    .from(users)
    .where(and(eq(users.isMentor, true), eq(users.mentorAvailable, true), ne(users.id, me.id)));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-navy-800">Find a mentor</h1>
        <p className="mt-1 text-slate-600">
          {mentors.length} mentor{mentors.length === 1 ? "" : "s"} available right now.
        </p>
      </header>

      {mentors.length === 0 ? (
        <div className="card text-center text-slate-600">
          No mentors are available yet. Check back soon — or be the first by{" "}
          <a href="/apply-mentor" className="text-navy-700 underline">applying yourself</a>.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mentors.map((m) => (
            <div key={m.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      m.image ||
                      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(m.name || "Mentor")}&backgroundColor=047857&textColor=ffffff`
                    }
                    alt={m.name ?? "Mentor"}
                    className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                  />
                  <div>
                    <p className="font-display text-lg font-bold text-navy-800">{m.name || "Mentor"}</p>
                    <p className="text-sm text-slate-600">
                      {m.major}
                      {m.minor ? ` · minor in ${m.minor}` : ""}
                      {m.semesterLevel ? ` · ${m.semesterLevel}` : ""}
                    </p>
                  </div>
                </div>
                <span className="pill">Capacity {m.mentorCapacity ?? "—"}</span>
              </div>
              {m.bio && <p className="text-sm text-slate-600">{m.bio}</p>}
              {m.mentorTopics && m.mentorTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.mentorTopics.map((t) => (
                    <span key={t} className="pill">{t}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end pt-1">
                <RequestButton mentorId={m.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
