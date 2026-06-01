import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, requests, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { INACTIVITY_WARN_DAYS, POSSIBLE_ACTIONS } from "@/lib/possible-actions";
import { EmptyState } from "@/components/empty-state";
import { CancelRequestButton } from "./cancel-request-button";

function daysSince(d: Date) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

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
      lastActivityAt: matches.lastActivityAt,
      mentorId: matches.mentorId,
      menteeId: matches.menteeId,
      meetingCount: sql<number>`(select count(*)::int from "meeting_log" where match_id = "match".id)`,
      mentorName: mentor.name,
      mentorImage: mentor.image,
      mentorEmail: mentor.email,
      mentorPhone: mentor.phone,
      mentorMajor: mentor.major,
      mentorBio: mentor.bio,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      menteeEmail: mentee.email,
      menteePhone: mentee.phone,
      menteeMajor: mentee.major,
      menteeBio: mentee.bio,
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

  // Pending outgoing requests are only relevant for members on this page —
  // mentors review pending requests on /requests, and admins don't use it.
  const pendingMentorAlias = alias(users, "pending_mentor_u");
  const pendingOutgoing = me.isMentor || me.isAdmin
    ? []
    : await db
        .select({
          id: requests.id,
          requestedAt: requests.requestedAt,
          message: requests.message,
          mentorId: requests.mentorId,
          mentorName: pendingMentorAlias.name,
          mentorImage: pendingMentorAlias.image,
          mentorMajor: pendingMentorAlias.major,
        })
        .from(requests)
        .innerJoin(pendingMentorAlias, eq(pendingMentorAlias.id, requests.mentorId))
        .where(and(eq(requests.menteeId, me.id), eq(requests.status, "pending")))
        .orderBy(desc(requests.requestedAt));

  // Celebration moment: any match started in the last 7 days with no
  // meetings logged yet → call it out at the top.
  const fresh = rows.filter(
    (r) => daysSince(r.startedAt) <= 7 && r.meetingCount === 0
  );

  const isMember = !me.isMentor && !me.isAdmin;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black text-byui-blue-dark sm:text-3xl lg:text-4xl">
          {isMember ? "My Mentors." : "My Mentees."}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isMember
            ? "Your active mentors are here. Pending requests are at the bottom."
            : "Contact info is unlocked. Email, call, or jump into Teams directly."}
        </p>
      </header>

      {fresh.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-byui-blue-dark to-byui-blue p-5 text-white ring-4 ring-byui-blue-light/60">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-byui-blue-light">
            ✨ Fresh match
          </p>
          <p className="mt-1 font-display text-xl font-black">
            {fresh.length === 1
              ? "You just matched. Now what?"
              : `${fresh.length} new matches. Pick one to start.`}
          </p>
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-byui-blue-light">
              Quick start
            </p>
            <ol className="mt-2 space-y-1.5 text-sm text-white/95">
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-byui-blue-dark">
                  1
                </span>
                <span><strong>Call or text.</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-byui-blue-dark">
                  2
                </span>
                <span>
                  <strong>Get to know them.</strong>{" "}
                  <span className="text-white/80">Go to the Crossroads, go to a society meeting together, or go have some fun.</span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-byui-blue-dark">
                  3
                </span>
                <span><strong>Do a career accomplishment together.</strong></span>
              </li>
            </ol>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          kind="match"
          title={isMember ? "No mentors yet" : "No active matches yet"}
          message={
            isMember
              ? "Browse mentors and send your first request. Most accept within 48 hours."
              : "Browse mentors and send your first request. Most accept within 48 hours."
          }
          cta={{ label: "Find a mentor", href: "/mentors" }}
        />
      ) : (
        <div
          className={
            isMember
              ? "space-y-6"
              : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {rows.map((m) => {
            const iAmMentor = m.mentorId === me.id;
            const other = iAmMentor
              ? {
                  name: m.menteeName,
                  image: m.menteeImage,
                  email: m.menteeEmail,
                  phone: m.menteePhone,
                  major: m.menteeMajor,
                  bio: m.menteeBio,
                  role: "Mentee",
                }
              : {
                  name: m.mentorName,
                  image: m.mentorImage,
                  email: m.mentorEmail,
                  phone: m.mentorPhone,
                  major: m.mentorMajor,
                  bio: m.mentorBio,
                  role: "Mentor",
                };
            const teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(other.email)}`;
            const inactivityDays = daysSince(m.lastActivityAt);
            const showInactivityWarn = inactivityDays >= INACTIVITY_WARN_DAYS;

            return (
              <article
                key={m.id}
                className="card flex flex-col gap-4"
              >
                {/* Header — photo + name + role */}
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      other.image ||
                      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(other.name || "")}&backgroundColor=006EB6&textColor=ffffff`
                    }
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full border border-byui-blue-light/40 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-black text-byui-blue-dark">
                      {other.name}
                    </p>
                    {other.major && (
                      <p className="truncate text-xs font-medium text-slate-600">{other.major}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center rounded-full bg-byui-blue-light/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-byui-blue-dark">
                        {other.role}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                        Since {new Date(m.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary action + 3 contact buttons */}
                <div className="flex flex-col gap-2">
                  {iAmMentor && (
                    <Link
                      href={`/log-meeting?matchId=${m.id}`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white shadow-soft transition hover:bg-byui-blue-dark active:scale-[0.98] cursor-pointer"
                    >
                      Log an Activity
                    </Link>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={`mailto:${other.email}`}
                      className="inline-flex items-center justify-center rounded-lg border border-byui-blue-light bg-white px-2 py-1.5 text-xs font-semibold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
                    >
                      Email
                    </a>
                    {other.phone ? (
                      <a
                        href={`tel:${other.phone}`}
                        className="inline-flex items-center justify-center rounded-lg border border-byui-blue-light bg-white px-2 py-1.5 text-xs font-semibold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
                      >
                        Call
                      </a>
                    ) : (
                      <span className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-300 pointer-events-none">
                        Call
                      </span>
                    )}
                    <a
                      href={teamsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border border-byui-blue-light bg-white px-2 py-1.5 text-xs font-semibold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
                    >
                      Teams
                    </a>
                  </div>
                </div>

                {/* Contact info */}
                <dl className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="min-w-0">
                    <dt className="font-semibold uppercase tracking-wider text-slate-500">Email</dt>
                    <dd className="mt-0.5">
                      <a href={`mailto:${other.email}`} className="truncate text-byui-blue-dark hover:underline block">
                        {other.email}
                      </a>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-semibold uppercase tracking-wider text-slate-500">Phone</dt>
                    <dd className="mt-0.5 text-slate-700">{other.phone || "—"}</dd>
                  </div>
                </dl>

                {showInactivityWarn && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="font-semibold">No activity in {inactivityDays} days.</p>
                    <p className="mt-1 text-[11px] text-amber-800">
                      Inactive {INACTIVITY_WARN_DAYS}+ days. After 6 months of inactivity it auto-ends.
                    </p>
                  </div>
                )}

                {/* Possible actions together — only on mentor cards, where the
                    mentor needs a menu of obvious next steps. */}
                {iAmMentor && (
                  <div className="mt-auto">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-byui-blue">
                      Things you can do together
                    </p>
                    <ul className="mt-2 space-y-1">
                      {POSSIBLE_ACTIONS.map((a) => (
                        <li key={a} className="flex items-start gap-1.5 text-xs leading-snug text-slate-700">
                          <span aria-hidden className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-byui-blue text-[9px] font-black text-white">
                            ✓
                          </span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </article>
            );
          })}
        </div>
      )}

      {isMember && pendingOutgoing.length > 0 && (
        <section className="space-y-3 pt-4">
          <header>
            <h2 className="font-display text-lg font-bold text-navy-800">Pending Requests</h2>
            <p className="mt-1 text-xs text-slate-500">
              Waiting on the mentor to accept or decline. You can cancel any time.
            </p>
          </header>
          <ul className="space-y-3">
            {pendingOutgoing.map((p) => (
              <li
                key={p.id}
                className="card flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      p.mentorImage ||
                      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(p.mentorName || "")}&backgroundColor=1B3A6B&textColor=ffffff`
                    }
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-navy-800">
                      {p.mentorName || "Mentor"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {p.mentorMajor}
                      {" · sent "}
                      {new Date(p.requestedAt).toLocaleDateString()}
                    </p>
                    {p.message && (
                      <p className="mt-1 line-clamp-1 text-xs italic text-slate-600">
                        &ldquo;{p.message}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="pill-pending">Pending</span>
                  <CancelRequestButton requestId={p.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
