import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { RequestButton } from "./request-button";
import { EmptyState } from "@/components/empty-state";
import { SEMESTER_LEVELS } from "@/lib/careers";

export default async function MentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ major?: string; semester?: string; mine?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  const params = await searchParams;
  const filterMyMajor = params.mine === "1";
  const filterSemester = params.semester;

  const conditions = [eq(users.isMentor, true), eq(users.mentorAvailable, true), ne(users.id, me.id)];
  if (filterMyMajor && me.major) conditions.push(eq(users.major, me.major));
  if (filterSemester) conditions.push(eq(users.semesterLevel, filterSemester));

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
    .where(and(...conditions));

  const myInterests = new Set(me.careerInterests ?? []);
  const myMajor = me.major?.toLowerCase().trim() ?? "";

  const scored = mentors
    .map((m) => {
      const overlap = (m.careerInterests ?? []).filter((c) => myInterests.has(c)).length;
      const sameMajor = m.major && m.major.toLowerCase().trim() === myMajor ? 1 : 0;
      const slotsLeft = Math.max(0, (m.mentorCapacity ?? 0) - (m.activeCount ?? 0));
      const score = overlap * 3 + sameMajor * 2 + (slotsLeft > 0 ? 1 : 0);
      return { ...m, overlap, sameMajor, slotsLeft, score };
    })
    .sort((a, b) => b.score - a.score || (b.slotsLeft - a.slotsLeft));

  // Don't show "Recommended" if any filter is active (user is being intentional)
  const isFiltering = filterMyMajor || !!filterSemester;
  const recommended = isFiltering ? [] : scored.filter((m) => m.score >= 3);
  const others = isFiltering ? scored : scored.filter((m) => m.score < 3);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-black text-navy-800">Find a mentor.</h1>
        <p className="text-sm font-medium text-slate-600">
          {mentors.length} accepting requests · sorted by overlap with your major and interests
        </p>
      </header>

      {/* Filter chips — real URL-param filters */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="All majors" href="/mentors" active={!filterMyMajor && !filterSemester} />
        {me.major && (
          <FilterChip
            label={`My major: ${me.major}`}
            href="/mentors?mine=1"
            active={filterMyMajor}
          />
        )}
        {SEMESTER_LEVELS.map((s) => (
          <FilterChip
            key={s}
            label={s}
            href={`/mentors?semester=${encodeURIComponent(s)}`}
            active={filterSemester === s}
          />
        ))}
      </div>

      {mentors.length === 0 ? (
        <EmptyState
          kind="mentor"
          title="No mentors match that filter"
          message="Try widening your search or be the first to apply to mentor in this slice."
          cta={{ label: "Clear filters", href: "/mentors" }}
        />
      ) : (
        <>
          {recommended.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-bold text-navy-800">Recommended for you</h2>
                <span className="text-xs text-slate-500">based on major and career interests</span>
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
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex select-none items-center rounded-full border px-3 py-1 text-xs font-semibold transition cursor-pointer " +
        (active
          ? "border-navy-700 bg-navy-700 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-navy-300 hover:text-navy-700")
      }
    >
      {label}
    </Link>
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
