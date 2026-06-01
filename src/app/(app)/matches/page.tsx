import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, requests, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { INACTIVITY_WARN_DAYS } from "@/lib/possible-actions";
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
        <h1 className="font-display text-2xl font-black text-navy-800 sm:text-3xl lg:text-4xl">
          {isMember ? "My Mentors." : "Your matches."}
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
          <p className="mt-1 max-w-xl text-sm text-white/90">
            Send the first email today. A short note (<em>&ldquo;great to be matched, here&rsquo;s what I&rsquo;m hoping to work on&rdquo;</em>) gets things moving.
          </p>
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
        <div className="space-y-6">
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
              <article key={m.id} className="card space-y-5">
                <div className="flex flex-wrap items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      other.image ||
                      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(other.name || "")}&backgroundColor=1B3A6B&textColor=ffffff`
                    }
                    alt=""
                    className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl font-black text-navy-800">{other.name}</p>
                      <span className="pill">{other.role}</span>
                      <span className="pill bg-emerald-50 text-emerald-700 border-emerald-100">
                        Active since {new Date(m.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {other.major && <p className="mt-1 text-sm text-slate-600">{other.major}</p>}
                    {other.bio && <p className="mt-2 max-w-prose text-sm text-slate-600">{other.bio}</p>}
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
                    {iAmMentor && (
                      <Link
                        href={`/log-meeting?matchId=${m.id}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white shadow-soft transition hover:bg-byui-blue-dark active:scale-[0.98] cursor-pointer"
                      >
                        Log a Meeting
                      </Link>
                    )}
                    <a
                      href={`mailto:${other.email}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-byui-blue-light bg-white px-3 py-2 text-sm font-semibold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
                    >
                      Email
                    </a>
                    {other.phone ? (
                      <a
                        href={`tel:${other.phone}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-byui-blue-light bg-white px-3 py-2 text-sm font-semibold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
                      >
                        Call
                      </a>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-300 pointer-events-none">
                        Call
                      </span>
                    )}
                    <a
                      href={teamsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-byui-blue-light bg-white px-3 py-2 text-sm font-semibold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
                    >
                      Teams
                    </a>
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</p>
                    <a href={`mailto:${other.email}`} className="text-sm font-medium text-byui-blue-dark hover:underline">
                      {other.email}
                    </a>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-700">{other.phone || "—"}</p>
                  </div>
                </div>

                {showInactivityWarn && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">No activity in {inactivityDays} days.</p>
                    <p className="mt-1 text-amber-800">
                      If nothing happens by 30 days from the last meeting, the mentoring relationship will be
                      discontinued — feel free to re-connect later. After 6 months of inactivity it ends
                      automatically.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={`mailto:${other.email}`}
                        className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-byui-blue-dark cursor-pointer"
                      >
                        Send a quick check-in
                      </a>
                      {iAmMentor && (
                        <Link
                          href={`/log-meeting?matchId=${m.id}`}
                          className="inline-flex items-center justify-center rounded-lg border border-byui-blue-light bg-white px-3 py-1.5 text-xs font-semibold text-byui-blue-dark hover:bg-byui-blue-light/20 cursor-pointer"
                        >
                          Log a meeting
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <Link href="/check-in" className="btn-ghost text-xs">Monthly check-in →</Link>
                </div>
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
