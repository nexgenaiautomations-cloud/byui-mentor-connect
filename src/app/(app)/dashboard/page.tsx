import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, meetingLogs, requests, users } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getCurrentUser } from "@/lib/session";
import { readActiveRole } from "@/lib/roles-server";
import { StatTile } from "@/components/stat-card";
import { KpiStrip } from "@/components/kpi-strip";
import { getStudentKpis } from "@/lib/kpis";

export default async function DashboardPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  // Which face of the dashboard to render is driven by the active-role
  // cookie, not the DB identity flags. Admins are also mentors and
  // members, so the rendering decision must follow the role switcher.
  const activeRole = await readActiveRole(me);
  if (activeRole === "admin") redirect("/admin");
  const actingAsMentor = activeRole === "mentor";

  // Members still see their own pending/outgoing request counts. Mentors
  // never look at request status from the dashboard — that surface is gone.
  const allReqs = actingAsMentor
    ? []
    : await db
        .select()
        .from(requests)
        .where(eq(requests.menteeId, me.id));

  const activeMatches = await db
    .select()
    .from(matches)
    .where(
      and(
        actingAsMentor
          ? eq(matches.mentorId, me.id)
          : eq(matches.menteeId, me.id),
        eq(matches.status, "active")
      )
    );

  // Only pending — never declined — surfaces to members so the experience
  // stays encouraging.
  const sentByMe = allReqs.filter((r) => r.menteeId === me.id);

  // Mentee KPI snapshot — drives the new strip and the welcome-panel logic.
  const studentKpis = actingAsMentor ? null : await getStudentKpis(me.id);

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");
  const recentMatches = await db
    .select({
      id: matches.id,
      startedAt: matches.startedAt,
      mentorId: matches.mentorId,
      menteeId: matches.menteeId,
      mentorName: mentor.name,
      mentorImage: mentor.image,
      mentorMajor: mentor.major,
      mentorMinor: mentor.minor,
      mentorBio: mentor.bio,
      mentorInterests: mentor.careerInterests,
      mentorGraduation: mentor.expectedGraduation,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      menteeMajor: mentee.major,
      menteeBio: mentee.bio,
    })
    .from(matches)
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .where(
      and(
        actingAsMentor
          ? eq(matches.mentorId, me.id)
          : eq(matches.menteeId, me.id),
        eq(matches.status, "active")
      )
    )
    .orderBy(desc(matches.startedAt))
    .limit(4);

  const [mentorCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.isMentor, true), eq(users.mentorAvailable, true)));

  // Mentor impact metrics. People helped = distinct mentees the mentor has
  // ever been matched with; career accomplishments = sum of " · "-separated
  // items in topics_discussed across all logs (matches how the log form
  // persists checked accomplishments).
  let impact: {
    menteesHelped: number;
    activeMentees: number;
    meetingsLogged: number;
    totalMinutes: number;
    careerAccomplishments: number;
    recentActivities: {
      id: string;
      menteeName: string | null;
      meetingDate: Date;
      meetingType: string;
      durationMinutes: number | null;
      topicsDiscussed: string | null;
    }[];
  } | null = null;

  if (actingAsMentor) {
    const [counts] = await db
      .select({
        menteesHelped: sql<number>`(select count(distinct mentee_id)::int from "match" where mentor_id = ${me.id})`,
        activeMentees: sql<number>`(select count(*)::int from "match" where mentor_id = ${me.id} and status = 'active')`,
        meetingsLogged: sql<number>`(select count(*)::int from "meeting_log" where mentor_id = ${me.id})`,
        totalMinutes: sql<number>`(select coalesce(sum(duration_minutes),0)::int from "meeting_log" where mentor_id = ${me.id})`,
        careerAccomplishments: sql<number>`(
          select coalesce(sum(array_length(string_to_array(topics_discussed, ' · '), 1)), 0)::int
          from "meeting_log"
          where mentor_id = ${me.id}
            and topics_discussed is not null
            and topics_discussed <> ''
        )`,
      })
      .from(sql`(select 1) as _t`);

    const recentActivityMentee = alias(users, "recent_activity_mentee");
    const recentActivities = await db
      .select({
        id: meetingLogs.id,
        menteeName: recentActivityMentee.name,
        meetingDate: meetingLogs.meetingDate,
        meetingType: meetingLogs.meetingType,
        durationMinutes: meetingLogs.durationMinutes,
        topicsDiscussed: meetingLogs.topicsDiscussed,
      })
      .from(meetingLogs)
      .innerJoin(recentActivityMentee, eq(recentActivityMentee.id, meetingLogs.menteeId))
      .where(eq(meetingLogs.mentorId, me.id))
      .orderBy(desc(meetingLogs.meetingDate), desc(meetingLogs.createdAt))
      .limit(4);

    impact = {
      menteesHelped: counts?.menteesHelped ?? 0,
      activeMentees: counts?.activeMentees ?? 0,
      meetingsLogged: counts?.meetingsLogged ?? 0,
      totalMinutes: counts?.totalMinutes ?? 0,
      careerAccomplishments: counts?.careerAccomplishments ?? 0,
      recentActivities,
    };
  }

  // First-login welcome: no active matches, no pending requests. Computed
  // from data so the card naturally disappears once the student takes action.
  const showWelcome =
    !actingAsMentor &&
    activeMatches.length === 0 &&
    sentByMe.length === 0;

  return (
    <div className="space-y-5 md:space-y-6">
      {showWelcome && (
        <section className="rounded-2xl border-2 border-byui-blue-light bg-gradient-to-r from-byui-blue-light/30 to-byui-blue-light/10 p-5 shadow-soft md:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-byui-blue">
            Welcome to BYUI CAN
          </p>
          <h2 className="mt-1 font-display text-2xl font-black tracking-tight text-byui-blue-dark md:text-3xl">
            Let&apos;s find your mentor.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-700">
            Search for mentors who align with your major, career interests, and
            goals. You can also start logging activities right away — your progress
            doesn&apos;t need to wait for a match.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/mentors"
              className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark cursor-pointer"
            >
              Find a Mentor
            </Link>
            <Link
              href="/log-meeting"
              className="inline-flex items-center justify-center rounded-lg border border-byui-blue/40 bg-white px-4 py-2 text-sm font-bold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
            >
              Log an Activity
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-gradient-to-r from-byui-blue-dark to-byui-blue p-5 text-white shadow-lift md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-byui-blue-light">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-black tracking-tight md:text-3xl">
            Welcome back, {me.firstName || "friend"}.
          </h1>
          <div className="flex flex-wrap gap-2">
            {actingAsMentor ? (
              <>
                <Link
                  href="/matches"
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-byui-blue-dark hover:bg-byui-blue-light/30 cursor-pointer"
                >
                  View mentees →
                </Link>
                <Link
                  href="/log-meeting"
                  className="rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/25 cursor-pointer"
                >
                  Log a meeting →
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/mentors"
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-byui-blue-dark hover:bg-byui-blue-light/30 cursor-pointer"
                >
                  Find a mentor →
                </Link>
                {!me.isMentor && (
                  <Link
                    href="/apply-mentor"
                    className="inline-flex items-center justify-center rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-white/25 cursor-pointer"
                  >
                    Apply to mentor →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
        {actingAsMentor && (
          <p className="mt-2 max-w-xl text-xs text-byui-blue-light">
            You&apos;re an approved mentor. Every conversation, resume review, and
            connection moves a student closer to their career.
          </p>
        )}
      </section>

      {studentKpis && <KpiStrip kpis={studentKpis} />}

      {actingAsMentor && impact && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <StatTile
            label="People Helped"
            value={impact.menteesHelped}
            hint="Mentees you have supported"
            href="/matches"
            tone="navy"
          />
          <StatTile
            label="Career Accomplishments"
            value={impact.careerAccomplishments}
            hint="Completed with your mentees"
            href="/log-meeting"
            tone="emerald"
          />
          <StatTile
            label="Meetings Logged"
            value={impact.meetingsLogged}
            hint="Career conversations recorded"
            href="/log-meeting"
            tone="navy"
          />
        </section>
      )}

      {impact && (
        <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-byui-blue-light/40 md:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-byui-blue">Your impact</p>
            <h2 className="mt-1 font-display text-2xl font-black text-byui-blue-dark">
              {impact.menteesHelped === 0
                ? "Ready for your first mentee?"
                : (() => {
                    const m = impact.menteesHelped;
                    const a = impact.careerAccomplishments;
                    if (a === 0) {
                      return m === 1
                        ? "You've helped 1 mentee so far."
                        : `You've helped ${m} mentees so far.`;
                    }
                    const menteeWord = m === 1 ? "mentee" : "mentees";
                    const accWord = a === 1 ? "career accomplishment" : "career accomplishments";
                    return `You've helped ${m} ${menteeWord} and completed ${a} ${accWord} together.`;
                  })()}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-slate-600">
              Every conversation, resume review, mock interview, and connection helps move a student
              closer to their career goals.
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active mentees</p>
              <p className="mt-1 font-display text-2xl font-bold text-byui-blue-dark">
                {impact.activeMentees}{" "}
                <span className="text-sm font-medium text-slate-400">of {me.mentorCapacity ?? 5}</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Meetings logged</p>
              <p className="mt-1 font-display text-2xl font-bold text-byui-blue-dark">{impact.meetingsLogged}</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Time invested</p>
              <p className="mt-1 font-display text-2xl font-bold text-byui-blue-dark">
                {Math.round(impact.totalMinutes / 60)}h{" "}
                <span className="text-sm font-medium text-slate-400">{impact.totalMinutes % 60}m</span>
              </p>
            </div>
          </div>
          {impact.recentActivities.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Recent activity
              </p>
              <ul className="mt-2 space-y-2">
                {impact.recentActivities.map((a) => {
                  const accomplishments = a.topicsDiscussed
                    ? a.topicsDiscussed.split(" · ").filter(Boolean).join(", ")
                    : null;
                  return (
                    <li
                      key={a.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-byui-blue-dark">
                          {new Date(a.meetingDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                          {a.menteeName ? ` · ${a.menteeName}` : ""}
                        </p>
                        <span className="inline-flex items-center rounded-full bg-byui-blue-light/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-byui-blue-dark capitalize">
                          {a.meetingType.replace("_", " ")}
                        </span>
                      </div>
                      {a.durationMinutes ? (
                        <p className="mt-0.5 text-[11px] text-slate-500">{a.durationMinutes} minutes</p>
                      ) : null}
                      {accomplishments && (
                        <p className="mt-1 text-xs leading-snug text-slate-700">{accomplishments}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-byui-blue-dark">
              {actingAsMentor ? "Your mentees" : "Your Mentors"}
            </h2>
            <Link href="/matches" className="text-xs font-semibold text-byui-blue hover:underline">
              View all →
            </Link>
          </div>
          {recentMatches.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              {actingAsMentor
                ? "No active mentees yet. Your impact starts with your first match."
                : "No active matches yet. Browse mentors and send a request."}
            </p>
          ) : actingAsMentor ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentMatches.map((m) => (
                <li key={m.id} className="flex items-start gap-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      m.menteeImage ||
                      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
                        m.menteeName || ""
                      )}&backgroundColor=006EB6&textColor=ffffff`
                    }
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-byui-blue-dark">
                      {m.menteeName}
                    </p>
                    <p className="truncate text-xs text-slate-600">
                      {m.menteeMajor?.trim() || (
                        <span className="text-slate-400">Major not listed</span>
                      )}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">
                      <span className="font-semibold text-slate-600">Bio:</span>{" "}
                      {m.menteeBio?.trim() || (
                        <span className="text-slate-400">Bio not listed</span>
                      )}
                    </p>
                  </div>
                  <Link
                    href="/matches"
                    className="shrink-0 text-xs font-semibold text-byui-blue hover:underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 space-y-3">
              {recentMatches.map((m) => {
                const interests = Array.isArray(m.mentorInterests)
                  ? m.mentorInterests.filter(Boolean).slice(0, 3)
                  : [];
                return (
                  <article
                    key={m.id}
                    className="overflow-hidden rounded-xl border border-byui-blue-light/40 bg-white shadow-soft"
                  >
                    <div className="h-12 bg-gradient-to-r from-byui-blue-dark via-byui-blue to-byui-blue-mid" />
                    <div className="px-3 pb-3">
                      {/* Avatar peeks into the gradient. Name + matched date
                          sit on the white surface below so the dark-navy
                          type stays readable. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          m.mentorImage ||
                          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
                            m.mentorName || ""
                          )}&backgroundColor=006EB6&textColor=ffffff`
                        }
                        alt=""
                        className="-mt-8 h-14 w-14 shrink-0 rounded-xl border-2 border-white bg-white object-cover shadow-lift"
                      />
                      <div className="mt-2">
                        <p className="truncate font-display text-base font-black leading-tight text-byui-blue-dark">
                          {m.mentorName}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-byui-blue">
                          Matched{" "}
                          {new Date(m.startedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {m.mentorMajor?.trim() ? (
                          <span className="inline-flex items-center rounded-full bg-byui-blue-light/40 px-2 py-0.5 text-[10px] font-bold text-byui-blue-dark">
                            {m.mentorMajor}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            Major not listed
                          </span>
                        )}
                        {m.mentorMinor?.trim() &&
                          m.mentorMinor.toLowerCase() !== "none" && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              Minor: {m.mentorMinor}
                            </span>
                          )}
                        {m.mentorGraduation?.trim() && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            Grad {m.mentorGraduation}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 whitespace-pre-line text-xs leading-snug text-slate-700">
                        <span className="font-semibold text-slate-600">Bio:</span>{" "}
                        {m.mentorBio?.trim() || (
                          <span className="text-slate-400">Bio not listed</span>
                        )}
                      </p>

                      {interests.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {interests.map((i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-full border border-byui-blue/30 bg-white px-2 py-0.5 text-[10px] font-semibold text-byui-blue-dark"
                            >
                              {i}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-3">
                        <Link
                          href="/matches"
                          className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-byui-blue-dark cursor-pointer"
                        >
                          Open mentor →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-bold text-byui-blue-dark">Quick actions</h2>
          <div className="mt-4 space-y-2">
            {(actingAsMentor
              ? [
                  { href: "/matches", title: "Your mentees", body: "Contact info and meeting history." },
                  { href: "/log-meeting", title: "Log a meeting", body: "Track what you did together and next steps." },
                  { href: "/profile", title: "Update profile", body: "Photo, bio, career interests." },
                ]
              : [
                  { href: "/mentors", title: "Find a mentor", body: "Filter, browse, request." },
                  { href: "/matches", title: "My Mentors", body: "Active mentors and pending requests." },
                  ...(me.isMentor
                    ? []
                    : [
                        {
                          href: "/apply-mentor",
                          title: "Apply to mentor",
                          body: "Pay it forward.",
                        },
                      ]),
                  { href: "/profile", title: "Update profile", body: "Photo, bio, career interests." },
                ]
            ).map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="block rounded-xl border border-slate-100 p-3 transition hover:border-byui-blue-light hover:bg-byui-blue-light/10 cursor-pointer"
              >
                <p className="text-sm font-semibold text-byui-blue-dark">{a.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{a.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
