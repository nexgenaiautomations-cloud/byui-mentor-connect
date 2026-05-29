import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
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

  const myInterests = new Set(me.careerInterests ?? []);
  const myMajor = me.major?.toLowerCase().trim() ?? "";

  // Score each mentor and sort by relevance.
  const scored = mentors
    .map((m) => {
      const overlap = (m.careerInterests ?? []).filter((c) => myInterests.has(c)).length;
      const sameMajor = m.major && m.major.toLowerCase().trim() === myMajor ? 1 : 0;
      const slotsLeft = Math.max(0, (m.mentorCapacity ?? 0) - (m.activeCount ?? 0));
      const score = overlap * 3 + sameMajor * 2 + (slotsLeft > 0 ? 1 : 0);
      return { ...m, overlap, sameMajor, slotsLeft, score };
    })
    .sort((a, b) => b.score - a.score || (b.slotsLeft - a.slotsLeft));

  const recommended = scored.filter((m) => m.score >= 3);
  const others = scored.filter((m) => m.score < 3);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Browse</p>
        <h1 className="mt-1 font-display text-3xl font-black text-navy-800">Find a mentor</h1>
        <p className="mt-1 text-sm text-slate-600">
          {mentors.length} mentor{mentors.length === 1 ? "" : "s"} accepting requests. Sorted by overlap with your major and career interests.
        </p>
      </header>

      {recommended.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold text-navy-800">Recommended for you</h2>
            <span className="text-xs text-slate-500">based on your major and career interests</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommended.map((m) => (
              <MentorCard key={m.id} mentor={m} highlight />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-navy-800">
            {recommended.length > 0 ? "All other mentors" : "All mentors"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {others.map((m) => (
              <MentorCard key={m.id} mentor={m} />
            ))}
          </div>
        </section>
      )}

      {mentors.length === 0 && (
        <div className="card text-center text-slate-600">
          No mentors available right now.{" "}
          <a href="/apply-mentor" className="text-navy-700 underline">Apply to be the first</a>.
        </div>
      )}
    </div>
  );
}

type Mentor = {
  id: string;
  name: string | null;
  image: string | null;
  major: string | null;
  minor: string | null;
  semesterLevel: string | null;
  expectedGraduation: string | null;
  bio: string | null;
  careerInterests: string[] | null;
  mentorTopics: string[] | null;
  mentorCapacity: number | null;
  activeCount: number;
  slotsLeft: number;
  overlap: number;
  sameMajor: number;
};

function MentorCard({ mentor: m, highlight }: { mentor: Mentor; highlight?: boolean }) {
  return (
    <article
      className={
        "card flex flex-col gap-4 " +
        (highlight ? "ring-4 ring-gold-300" : "")
      }
    >
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
          <p className="truncate font-display text-base font-bold text-navy-800">{m.name || "Mentor"}</p>
          <p className="truncate text-xs text-slate-600">
            {m.major}{m.minor ? ` · ${m.minor}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {m.semesterLevel}
            {m.expectedGraduation ? ` · grad ${m.expectedGraduation}` : ""}
          </p>
        </div>
      </div>

      {highlight && (
        <div className="flex flex-wrap gap-1.5">
          {m.sameMajor > 0 && <span className="pill-gold">Same major</span>}
          {m.overlap > 0 && (
            <span className="pill-gold">
              {m.overlap} shared interest{m.overlap === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      {m.bio && <p className="line-clamp-2 text-sm text-slate-700">{m.bio}</p>}

      {m.mentorTopics && m.mentorTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {m.mentorTopics.slice(0, 4).map((t) => (
            <span key={t} className="pill">{t}</span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        <p className={`text-xs font-bold ${m.slotsLeft > 0 ? "text-emerald-700" : "text-slate-400"}`}>
          {m.slotsLeft > 0 ? `${m.slotsLeft} of ${m.mentorCapacity} spots left` : "At capacity"}
        </p>
        <RequestButton mentorId={m.id} mentorName={m.name} disabled={m.slotsLeft <= 0} />
      </div>
    </article>
  );
}
