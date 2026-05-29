import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
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
      expectedGraduation: users.expectedGraduation,
      bio: users.bio,
      careerInterests: users.careerInterests,
      mentorTopics: users.mentorTopics,
      mentorCapacity: users.mentorCapacity,
      activeCount: sql<number>`(select count(*)::int from "match" where mentor_id = "user".id and status = 'active')`,
    })
    .from(users)
    .where(and(eq(users.isMentor, true), eq(users.mentorAvailable, true), ne(users.id, me.id)));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black text-navy-800">Find a mentor</h1>
          <p className="mt-1 text-sm text-slate-600">
            {mentors.length} mentor{mentors.length === 1 ? "" : "s"} accepting requests right now.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip label="All majors" active />
          <FilterChip label="My major" />
          <FilterChip label="Senior" />
          <FilterChip label="Available" />
        </div>
      </header>

      {mentors.length === 0 ? (
        <div className="card text-center text-slate-600">
          No mentors are available yet. Check back soon — or be the first by{" "}
          <a href="/apply-mentor" className="text-navy-700 underline">applying yourself</a>.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mentors.map((m) => {
            const slotsLeft = (m.mentorCapacity ?? 0) - (m.activeCount ?? 0);
            return (
              <article key={m.id} className="card group flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      m.image ||
                      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(m.name || "Mentor")}&backgroundColor=1B3A6B&textColor=ffffff`
                    }
                    alt={m.name ?? "Mentor"}
                    className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold text-navy-800">
                      {m.name || "Mentor"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {m.major}
                      {m.minor ? ` · ${m.minor}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {m.semesterLevel}
                      {m.expectedGraduation ? ` · grad ${m.expectedGraduation}` : ""}
                    </p>
                  </div>
                </div>

                {m.bio && <p className="line-clamp-2 text-sm text-slate-600">{m.bio}</p>}

                {m.mentorTopics && m.mentorTopics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.mentorTopics.slice(0, 4).map((t) => (
                      <span key={t} className="pill">{t}</span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-emerald-700">
                    {slotsLeft > 0 ? `${slotsLeft} of ${m.mentorCapacity} spots left` : "At capacity"}
                  </p>
                  <RequestButton mentorId={m.id} disabled={slotsLeft <= 0} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={`inline-flex select-none items-center rounded-full border px-3 py-1 text-xs font-semibold cursor-default ${
        active
          ? "border-navy-700 bg-navy-700 text-white"
          : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}
