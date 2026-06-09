import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, requests, users } from "@/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { EmptyState } from "@/components/empty-state";
import { MajorFilter } from "./major-filter";
import { MentorProfileButton } from "./profile-modal";

export default async function MentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ major?: string; mine?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");
  // Mentors don't request mentors — bounce them back to their dashboard if
  // they navigate here directly.
  if (me.isMentor) redirect("/dashboard");

  const params = await searchParams;
  const filterMyMajor = params.mine === "1";
  const filterMajor = params.major?.trim() || "";

  // Populate the Major dropdown from majors that any available mentor actually
  // has — keeps the dropdown clean instead of listing every catalog entry.
  const majorRows = await db
    .selectDistinct({ major: users.major })
    .from(users)
    .where(and(eq(users.isMentor, true), eq(users.mentorAvailable, true)));
  const mentorMajors = majorRows
    .map((r) => r.major)
    .filter((m): m is string => !!m && m.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));

  const conditions = [eq(users.isMentor, true), eq(users.mentorAvailable, true), ne(users.id, me.id)];
  if (filterMajor) conditions.push(eq(users.major, filterMajor));
  else if (filterMyMajor && me.major) conditions.push(eq(users.major, me.major));

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

  // Pending requests I've already sent — surfaced on cards as "Requested".
  const myReqs = await db
    .select({ mentorId: requests.mentorId, status: requests.status })
    .from(requests)
    .where(
      and(
        eq(requests.menteeId, me.id),
        inArray(requests.status, ["pending"])
      )
    );
  const requestedSet = new Set(myReqs.map((r) => r.mentorId));

  // Active matches — if a mentor is already mine, show "Already your mentor".
  const myMatches = await db
    .select({ mentorId: matches.mentorId })
    .from(matches)
    .where(and(eq(matches.menteeId, me.id), eq(matches.status, "active")));
  const matchedSet = new Set(myMatches.map((r) => r.mentorId));

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
  const isFiltering = filterMyMajor || !!filterMajor;
  const recommended = isFiltering ? [] : scored.filter((m) => m.score >= 3);
  const others = isFiltering ? scored : scored.filter((m) => m.score < 3);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-2xl font-black text-navy-800 sm:text-3xl lg:text-4xl">Find a mentor.</h1>
        <p className="text-sm font-medium text-slate-600">
          {mentors.length} accepting requests · sorted by overlap with your major and interests
        </p>
      </header>

      {/* Filters — Major dropdown + an optional "My major" shortcut */}
      <div className="flex flex-wrap items-center gap-3">
        <MajorFilter majors={mentorMajors} selected={filterMajor} />
        {me.major && !filterMajor && (
          <FilterChip
            label={`My major: ${me.major}`}
            href="/mentors?mine=1"
            active={filterMyMajor}
          />
        )}
        {(filterMyMajor || filterMajor) && (
          <FilterChip label="Clear filters" href="/mentors" active={false} />
        )}
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
                  <MentorCard
                    key={m.id}
                    mentor={m}
                    highlight
                    myStatus={
                      matchedSet.has(m.id)
                        ? "accepted"
                        : requestedSet.has(m.id)
                          ? "pending"
                          : undefined
                    }
                  />
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
                  <MentorCard
                    key={m.id}
                    mentor={m}
                    myStatus={
                      matchedSet.has(m.id)
                        ? "accepted"
                        : requestedSet.has(m.id)
                          ? "pending"
                          : undefined
                    }
                  />
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

function MentorCard({
  mentor: m,
  highlight,
  myStatus,
}: {
  mentor: Mentor;
  highlight?: boolean;
  myStatus?: "pending" | "accepted";
}) {
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

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p
          className={
            "text-xs font-bold " +
            (m.slotsLeft > 0 ? "text-emerald-700" : "text-slate-400")
          }
        >
          {m.slotsLeft > 0
            ? `${m.slotsLeft} of ${m.mentorCapacity} spots left`
            : "At capacity"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {myStatus === "accepted" ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
              ✓ Already your mentor
            </span>
          ) : myStatus === "pending" ? (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
              ✓ Requested · waiting
            </span>
          ) : null}
          <MentorProfileButton mentor={m} myStatus={myStatus} />
        </div>
      </div>
    </article>
  );
}
