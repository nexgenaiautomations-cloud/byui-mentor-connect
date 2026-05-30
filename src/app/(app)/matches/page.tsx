import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, meetingLogs, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, eq, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { POSSIBLE_ACTIONS, INACTIVITY_WARN_DAYS } from "@/lib/possible-actions";
import { EmptyState } from "@/components/empty-state";

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
      mentorContact: mentor.preferredContactMethod,
      mentorMajor: mentor.major,
      mentorBio: mentor.bio,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      menteeEmail: mentee.email,
      menteePhone: mentee.phone,
      menteeContact: mentee.preferredContactMethod,
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

  // Celebration moment: any match started in the last 7 days with no
  // meetings logged yet → call it out at the top.
  const fresh = rows.filter(
    (r) => daysSince(r.startedAt) <= 7 && r.meetingCount === 0
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black text-navy-800 sm:text-3xl lg:text-4xl">Your matches.</h1>
        <p className="mt-1 text-sm text-slate-600">
          Contact info is unlocked. Email, call, or jump into Teams directly.
        </p>
      </header>

      {fresh.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 p-5 text-navy-900 ring-4 ring-gold-200">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-navy-800">
            ✨ Fresh match
          </p>
          <p className="mt-1 font-display text-xl font-black">
            {fresh.length === 1
              ? "You just matched. Now what?"
              : `${fresh.length} new matches. Pick one to start.`}
          </p>
          <p className="mt-1 max-w-xl text-sm text-navy-900/85">
            Send the first email today. A short note (<em>&ldquo;great to be matched, here&rsquo;s what I&rsquo;m hoping to work on&rdquo;</em>) gets things moving.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          kind="match"
          title="No active matches yet"
          message="Browse mentors and send your first request. Most accept within 48 hours."
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
                  contact: m.menteeContact,
                  major: m.menteeMajor,
                  bio: m.menteeBio,
                  role: "Mentee",
                }
              : {
                  name: m.mentorName,
                  image: m.mentorImage,
                  email: m.mentorEmail,
                  phone: m.mentorPhone,
                  contact: m.mentorContact,
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
                  <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
                    <a href={`mailto:${other.email}`} className="btn-primary !px-3">Email</a>
                    {other.phone ? (
                      <a href={`tel:${other.phone}`} className="btn-outline !px-3">Call</a>
                    ) : (
                      <span className="btn-outline pointer-events-none opacity-40 !px-3">Call</span>
                    )}
                    <a href={teamsUrl} target="_blank" rel="noopener noreferrer" className="btn-outline !px-3">Teams</a>
                  </div>
                </div>

                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</p>
                    <a href={`mailto:${other.email}`} className="text-sm font-medium text-navy-700 hover:underline">
                      {other.email}
                    </a>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-700">{other.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prefers</p>
                    <p className="text-sm font-medium text-slate-700 capitalize">{other.contact || "—"}</p>
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
                      <a href={`mailto:${other.email}`} className="btn-primary text-xs">Send a quick check-in</a>
                      {iAmMentor && (
                        <Link href="/log-meeting" className="btn-outline text-xs">Log a meeting</Link>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Possible actions together
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {POSSIBLE_ACTIONS.map((a) => (
                      <div
                        key={a}
                        className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white p-3"
                      >
                        <span className="mt-0.5 text-emerald-600">✓</span>
                        <p className="text-sm text-navy-800">{a}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {iAmMentor && (
                    <Link href="/log-meeting" className="btn-ghost text-xs">Log a meeting →</Link>
                  )}
                  <Link href="/check-in" className="btn-ghost text-xs">Monthly check-in →</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
