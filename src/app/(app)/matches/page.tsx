import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, meetingLogs, requests, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { INACTIVITY_WARN_DAYS, POSSIBLE_ACTIONS } from "@/lib/possible-actions";
import { EmptyState } from "@/components/empty-state";
import { CancelRequestButton } from "./cancel-request-button";
import { CanTodosButton } from "./can-todos-button";
import { KpiChips } from "@/components/kpi-chips";
import { getStudentKpisBatch } from "@/lib/kpis";
import { LogActions } from "./log-actions";

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
      mentorMinor: mentor.minor,
      mentorExpectedGraduation: mentor.expectedGraduation,
      mentorCareerInterests: mentor.careerInterests,
      mentorBio: mentor.bio,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      menteeEmail: mentee.email,
      menteePhone: mentee.phone,
      menteeMajor: mentee.major,
      menteeMinor: mentee.minor,
      menteeExpectedGraduation: mentee.expectedGraduation,
      menteeCareerInterests: mentee.careerInterests,
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

  // Recent activities per active match — only fetched when I'm the mentor on
  // at least one match, since they only show on mentee cards.
  const mentorMatchIds = rows
    .filter((r) => r.mentorId === me.id)
    .map((r) => r.id);
  const recentActivities = mentorMatchIds.length
    ? await db
        .select({
          id: meetingLogs.id,
          matchId: meetingLogs.matchId,
          meetingDate: meetingLogs.meetingDate,
          meetingType: meetingLogs.meetingType,
          durationMinutes: meetingLogs.durationMinutes,
          topicsDiscussed: meetingLogs.topicsDiscussed,
          actionItems: meetingLogs.actionItems,
          isSystemGenerated: meetingLogs.isSystemGenerated,
          createdBy: meetingLogs.createdBy,
        })
        .from(meetingLogs)
        .where(inArray(meetingLogs.matchId, mentorMatchIds))
        .orderBy(desc(meetingLogs.meetingDate), desc(meetingLogs.createdAt))
    : [];
  const activitiesByMatch = new Map<string, typeof recentActivities>();
  for (const a of recentActivities) {
    if (a.matchId) {
      const list = activitiesByMatch.get(a.matchId) ?? [];
      list.push(a);
      activitiesByMatch.set(a.matchId, list);
    }
  }

  // Batch KPI fetch for the mentor's mentees. Single SQL round-trip even with
  // a full mentor capacity.
  const menteeStudentIds = rows
    .filter((r) => r.mentorId === me.id)
    .map((r) => r.menteeId);
  const kpisByStudent = menteeStudentIds.length
    ? await getStudentKpisBatch(menteeStudentIds)
    : new Map();

  // Days since each mentee's most recent career_tasks log — drives the
  // amber "stale" tone on chips.
  const lastCareerTaskDays = new Map<string, number | null>();
  if (menteeStudentIds.length) {
    const lastTaskRows = await db
      .select({
        studentId: meetingLogs.studentId,
        meetingDate: meetingLogs.meetingDate,
      })
      .from(meetingLogs)
      .where(
        and(
          inArray(meetingLogs.studentId, menteeStudentIds),
          eq(meetingLogs.accomplishmentGroup, "career_tasks")
        )
      )
      .orderBy(desc(meetingLogs.meetingDate));
    for (const id of menteeStudentIds) lastCareerTaskDays.set(id, null);
    for (const r of lastTaskRows) {
      if (!r.studentId) continue;
      const existing = lastCareerTaskDays.get(r.studentId);
      if (existing == null) {
        lastCareerTaskDays.set(r.studentId, daysSince(r.meetingDate));
      }
    }
  }

  // Pending outgoing requests are only relevant for members on this page —
  // mentors respond to pending requests via the forced popup, and admins
  // don't use this surface.
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
            {isMember ? "✨ New connection" : "✨ Fresh match"}
          </p>
          <p className="mt-1 font-display text-xl font-black">
            {isMember
              ? fresh.length === 1
                ? "You have a new mentor. Now what?"
                : `${fresh.length} new mentors. Pick one to start.`
              : fresh.length === 1
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
            <CanTodosButton actions={POSSIBLE_ACTIONS} />
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
                  minor: m.menteeMinor,
                  expectedGraduation: m.menteeExpectedGraduation,
                  careerInterests: m.menteeCareerInterests,
                  bio: m.menteeBio,
                  role: "Mentee",
                }
              : {
                  name: m.mentorName,
                  image: m.mentorImage,
                  email: m.mentorEmail,
                  phone: m.mentorPhone,
                  major: m.mentorMajor,
                  minor: m.mentorMinor,
                  expectedGraduation: m.mentorExpectedGraduation,
                  careerInterests: m.mentorCareerInterests,
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

                {/* Profile details — shown for both sides of the match so the
                    mentee sees the mentor's full profile too (per the spec). */}
                <dl className="grid gap-1.5 text-xs">
                  <div className="flex flex-wrap gap-x-1.5">
                    <dt className="font-semibold text-slate-500">Minor:</dt>
                    <dd className="text-slate-700">{other.minor || "Not listed"}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-1.5">
                    <dt className="font-semibold text-slate-500">Expected Graduation Date:</dt>
                    <dd className="text-slate-700">{other.expectedGraduation || "Not listed"}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-1.5">
                    <dt className="font-semibold text-slate-500 shrink-0">Career Interests:</dt>
                    <dd className="text-slate-700">
                      {other.careerInterests && other.careerInterests.length > 0
                        ? other.careerInterests.join(", ")
                        : "Not listed"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="font-semibold text-slate-500">Bio:</dt>
                    <dd
                      className={
                        "whitespace-pre-wrap leading-snug " +
                        (other.bio ? "text-slate-700" : "italic text-slate-400")
                      }
                    >
                      {other.bio || "Bio not listed"}
                    </dd>
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

                {/* Mentee KPI chips — at-a-glance "is this student on pace?" */}
                {iAmMentor && kpisByStudent.get(m.menteeId) && (
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-byui-blue">
                      Progress this week / month
                    </p>
                    <KpiChips
                      kpis={kpisByStudent.get(m.menteeId)!}
                      daysSinceLastCareerTask={lastCareerTaskDays.get(m.menteeId) ?? null}
                    />
                  </div>
                )}

                {/* Recent Activities — scrollable feed of logged activities
                    for this specific mentee. Shown only on the mentor's view. */}
                {iAmMentor && (() => {
                  const items = activitiesByMatch.get(m.id) ?? [];
                  return (
                    <div className="mt-auto">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-byui-blue">
                          Recent Activities
                        </p>
                        {items.length > 0 && (
                          <Link
                            href={`/log-meeting?matchId=${m.id}`}
                            className="text-[10px] font-bold uppercase tracking-wider text-byui-blue hover:underline"
                          >
                            Log →
                          </Link>
                        )}
                      </div>
                      {items.length === 0 ? (
                        <div className="mt-2 rounded-xl border border-dashed border-byui-blue-light/60 bg-slate-50 p-3 text-center">
                          <p className="text-xs text-slate-600">No activities logged yet.</p>
                          <Link
                            href={`/log-meeting?matchId=${m.id}`}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-byui-blue hover:underline"
                          >
                            Log an Activity →
                          </Link>
                        </div>
                      ) : (
                        <ul className="mt-2 max-h-[180px] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2 pr-1">
                          {items.map((a) => (
                            <li
                              key={a.id}
                              className={
                                "rounded-lg border p-2.5 " +
                                (a.isSystemGenerated
                                  ? "border-emerald-200 bg-emerald-50/40"
                                  : "border-slate-100 bg-white")
                              }
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <p className="text-xs font-bold text-byui-blue-dark">
                                  {new Date(a.meetingDate).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </p>
                                <span
                                  className={
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                                    (a.isSystemGenerated
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-byui-blue-light/30 text-byui-blue-dark")
                                  }
                                >
                                  {a.isSystemGenerated
                                    ? "Goal met"
                                    : a.meetingType.replace("_", " ")}
                                </span>
                              </div>
                              {a.durationMinutes ? (
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {a.durationMinutes} minutes
                                </p>
                              ) : null}
                              {a.topicsDiscussed && (
                                <p className="mt-1 text-xs leading-snug text-slate-700">
                                  {a.isSystemGenerated ? (
                                    a.topicsDiscussed
                                  ) : (
                                    <>
                                      <span className="font-semibold text-slate-500">
                                        Accomplishments:
                                      </span>{" "}
                                      {a.topicsDiscussed
                                        .split(" · ")
                                        .filter(Boolean)
                                        .join(", ")}
                                    </>
                                  )}
                                </p>
                              )}
                              <LogActions
                                log={{
                                  id: a.id,
                                  meetingDate: new Date(a.meetingDate)
                                    .toISOString()
                                    .slice(0, 10),
                                  topicsDiscussed: a.topicsDiscussed,
                                  actionItems: a.actionItems,
                                  isSystemGenerated: a.isSystemGenerated,
                                }}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}

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
              Waiting for the mentor to respond. You can cancel any time.
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
