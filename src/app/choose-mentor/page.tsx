import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { matches, requests, users } from "@/db/schema";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/session";
import { needsAgreement } from "@/lib/agreements";
import { needsPledge } from "@/lib/pledge";
import { sameSchoolAs } from "@/lib/school-scope";
import { rankMentors, RECOMMENDED_MIN_SCORE } from "@/lib/mentor-ranking";
import { ChooseMentorButton } from "./choose-button";

export const metadata: Metadata = {
  title: "Choose your mentor · ICAN",
};

// Last step of sign-up (Shaun Franklin, 2026-11-09): profile, then the
// pledge, then choose a mentor. If mentors have open slots the student must
// pick one (recommended first). If none do, admins match them by hand and
// they're told they'll get an email.
export default async function ChooseMentorPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (needsAgreement(me)) redirect("/agreements");
  if (!me.onboardedAt) redirect("/onboarding");
  if (needsPledge(me)) redirect("/pledge?then=mentor");
  if (me.isMentor || me.isAdmin) redirect("/dashboard");

  // Already has a mentor or a pending request: nothing to choose.
  const [existing] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.menteeId, me.id), eq(matches.status, "active")))
    .limit(1);
  const [pending] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.menteeId, me.id), inArray(requests.status, ["pending"])))
    .limit(1);
  if (existing || pending) redirect("/dashboard");

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      major: users.major,
      semesterLevel: users.semesterLevel,
      bio: users.bio,
      careerInterests: users.careerInterests,
      mentorCapacity: users.mentorCapacity,
      activeCount: sql<number>`(select count(*)::int from "match" where mentor_id = "user".id and status = 'active')`,
    })
    .from(users)
    .where(
      and(
        eq(users.isMentor, true),
        eq(users.mentorAvailable, true),
        ne(users.id, me.id),
        sameSchoolAs(me.email),
        sql`${users.deactivatedAt} is null`
      )
    );
  const open = rankMentors(me, rows).filter((m) => m.slotsLeft > 0);
  const recommended = open.filter((m) => m.score >= RECOMMENDED_MIN_SCORE);
  const others = open.filter((m) => m.score < RECOMMENDED_MIN_SCORE);

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-light/30 via-white to-white px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Logo size={40} tile />
          <span className="font-brand text-2xl font-semibold tracking-[0.12em] text-plum-800">ICAN</span>
        </div>
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Last step</p>
        <h1 className="mt-1 text-center font-display text-2xl font-bold text-plum-800 sm:text-3xl">
          Choose your mentor
        </h1>

        {open.length === 0 ? (
          <div className="card mx-auto mt-6 max-w-lg text-center">
            <p className="font-display text-lg font-bold text-plum-800">
              You will be assigned a mentor as soon as one is available.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Every mentor is full right now. An ICAN admin will match you with a mentor and
              we&apos;ll let you know by email at {me.email}.
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Continue to ICAN
            </Link>
          </div>
        ) : (
          <>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-600">
              Pick the mentor you&apos;d like to work with to continue. Your best matches,
              based on your major and career interests, are first.
            </p>
            {recommended.length > 0 && (
              <MentorGrid title="Recommended for you" mentors={recommended} highlight />
            )}
            {others.length > 0 && (
              <MentorGrid title={recommended.length ? "Other mentors" : "Available mentors"} mentors={others} />
            )}
          </>
        )}

        <p className="mt-10 text-center text-sm text-slate-600">
          Want to help other students instead?{" "}
          <Link href="/apply-mentor" className="font-semibold text-brand underline-offset-2 hover:underline">
            Apply to be a mentor
          </Link>
        </p>
      </div>
    </main>
  );
}

type Ranked = ReturnType<typeof rankMentors<{
  id: string;
  name: string | null;
  image: string | null;
  major: string | null;
  semesterLevel: string | null;
  bio: string | null;
  careerInterests: string[] | null;
  mentorCapacity: number | null;
  activeCount: number;
}>>[number];

function MentorGrid({ title, mentors, highlight }: { title: string; mentors: Ranked[]; highlight?: boolean }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg font-bold text-plum-800">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {mentors.map((m) => (
          <article
            key={m.id}
            className={`card flex flex-col gap-3 ${highlight ? "ring-2 ring-brand/40" : ""}`}
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  m.image ||
                  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(m.name || "Mentor")}&backgroundColor=1B3A6B&textColor=ffffff`
                }
                alt=""
                className="h-12 w-12 rounded-full border border-slate-200 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-display font-bold text-plum-800">{m.name || "Mentor"}</p>
                <p className="truncate text-xs text-slate-600">
                  {m.major || "Major not listed"}
                  {m.semesterLevel ? ` · ${m.semesterLevel}` : ""}
                </p>
              </div>
            </div>
            {(m.sameMajor > 0 || m.overlap > 0) && (
              <p className="text-xs font-semibold text-emerald-800">
                {[m.sameMajor ? "Same major" : null, m.overlap ? `${m.overlap} shared interest${m.overlap === 1 ? "" : "s"}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {m.bio && <p className="line-clamp-3 text-sm text-slate-700">{m.bio}</p>}
            <p className="text-xs text-slate-600">
              {m.slotsLeft} open spot{m.slotsLeft === 1 ? "" : "s"}
            </p>
            <div className="mt-auto">
              <ChooseMentorButton mentorId={m.id} mentorName={m.name} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
