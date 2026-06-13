import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users, meetingLogs } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { readActiveRole } from "@/lib/roles-server";
import { getStudentKpis } from "@/lib/kpis";
import { LogActivityForm } from "./form";
import { MentorWorkspace } from "./mentor-workspace";
import { KpiStrip } from "@/components/kpi-strip";

export default async function LogActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ matchId?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.onboardedAt) redirect("/onboarding");

  // Mentor vs mentee surface is driven by the active-role cookie so
  // admins (who are also mentors and members) can switch into the
  // member workflow and log their own activities.
  const activeRole = await readActiveRole(me);
  if (activeRole === "admin") redirect("/admin");
  const actingAsMentor = activeRole === "mentor";

  const { matchId: preselectMatchId } = await searchParams;

  if (actingAsMentor) {
    const mentee = alias(users, "mentee_u");
    const myMatches = await db
      .select({
        id: matches.id,
        menteeId: matches.menteeId,
        menteeName: mentee.name,
        menteeImage: mentee.image,
        menteeMajor: mentee.major,
        startedAt: matches.startedAt,
      })
      .from(matches)
      .innerJoin(mentee, eq(mentee.id, matches.menteeId))
      .where(and(eq(matches.mentorId, me.id), eq(matches.status, "active")));

    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Mentor tools
          </p>
          <h1 className="mt-1 font-display text-3xl font-black text-byui-blue-dark">
            Log a Meeting
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Capture a new meeting on the left. The panel on the right is the
            selected mentee&apos;s history — both their independent activities
            and the meetings you&apos;ve recorded — and lets you edit any entry.
          </p>
        </header>

        <LoggingGuidance role="mentor" />

        <MentorWorkspace matches={myMatches} initialMatchId={preselectMatchId} />
      </div>
    );
  }

  // ----- Mentee path -----
  const kpis = await getStudentKpis(me.id);
  const [activeMatch] = await db
    .select({
      id: matches.id,
      mentorId: matches.mentorId,
      mentorName: users.name,
    })
    .from(matches)
    .innerJoin(users, eq(users.id, matches.mentorId))
    .where(and(eq(matches.menteeId, me.id), eq(matches.status, "active")))
    .limit(1);

  const myRecent = await db
    .select({
      id: meetingLogs.id,
      meetingDate: meetingLogs.meetingDate,
      meetingType: meetingLogs.meetingType,
      durationMinutes: meetingLogs.durationMinutes,
      topicsDiscussed: meetingLogs.topicsDiscussed,
      menteeName: users.name,
      isSystemGenerated: meetingLogs.isSystemGenerated,
    })
    .from(meetingLogs)
    .leftJoin(users, eq(users.id, meetingLogs.mentorId))
    .where(
      or(eq(meetingLogs.studentId, me.id), eq(meetingLogs.menteeId, me.id))
    )
    .orderBy(desc(meetingLogs.meetingDate), desc(meetingLogs.createdAt))
    .limit(5);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Career Action Network
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-byui-blue-dark">
          Log an Activity
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Track what you worked on. Logging keeps your weekly Career Task and
          monthly Career Chat goals on pace.
        </p>
      </header>

      <KpiStrip kpis={kpis} />

      <LoggingGuidance role="mentee" />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card">
          {activeMatch ? (
            <p className="mb-4 text-xs text-slate-500">
              Logging will also notify your mentor{" "}
              <span className="font-semibold text-byui-blue-dark">
                {activeMatch.mentorName}
              </span>
              .
            </p>
          ) : (
            <p className="mb-4 text-xs text-slate-500">
              You don&apos;t have a mentor yet — that&apos;s OK. Your activity
              still counts toward your goals.
            </p>
          )}
          <LogActivityForm mode="mentee" hasMentor={Boolean(activeMatch)} />
        </div>

        <RecentList recent={myRecent} showAuthor={false} />
      </div>
    </div>
  );
}

// Explanation panel at the top of each Log an Activity page. Copy lifted
// from the spec — mentee = "report independent progress", mentor =
// "record what happened in a meeting".
function LoggingGuidance({ role }: { role: "mentor" | "mentee" }) {
  return (
    <section
      role="note"
      className="rounded-2xl border border-byui-blue-light/60 bg-byui-blue-light/15 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-byui-blue text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8.5h.01M11 12h1v4h1" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          {role === "mentee" ? (
            <>
              <h2 className="font-display text-base font-bold text-byui-blue-dark sm:text-lg">
                Report career progress you complete on your own.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Use this page to log activities you worked on outside of a
                1-on-1 mentor meeting — like working on your resume, applying
                to internships, attending a career event, or completing a
                career chat.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                If you did the activity during a meeting with your mentor, your
                mentor can record that meeting from their dashboard.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-base font-bold text-byui-blue-dark sm:text-lg">
                Record what happened during a 1-on-1 mentoring meeting.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Use this page to log what you helped your mentee with during a
                meeting, call, or career activity together. Mentees can log
                independent career work from their own dashboard.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function RecentList({
  recent,
  showAuthor = true,
}: {
  recent: {
    id: string;
    meetingDate: Date;
    meetingType: string;
    durationMinutes: number | null;
    topicsDiscussed: string | null;
    menteeName: string | null;
    isSystemGenerated: boolean;
  }[];
  showAuthor?: boolean;
}) {
  return (
    <div className="card">
      <h2 className="font-display text-lg font-bold text-byui-blue-dark">
        Recent activity
      </h2>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No activities logged yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {recent.map((l) => (
            <li
              key={l.id}
              className={
                "rounded-xl border p-3 " +
                (l.isSystemGenerated
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-100")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-byui-blue-dark">
                  {new Date(l.meetingDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider capitalize " +
                    (l.isSystemGenerated
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-byui-blue-light/30 text-byui-blue-dark")
                  }
                >
                  {l.isSystemGenerated
                    ? "Goal met"
                    : l.meetingType.replace("_", " ")}
                </span>
              </div>
              {showAuthor && l.menteeName && (
                <p className="mt-0.5 text-xs font-medium text-slate-700">
                  {l.menteeName}
                </p>
              )}
              {l.durationMinutes ? (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {l.durationMinutes} minutes
                </p>
              ) : null}
              {l.topicsDiscussed && (
                <p className="mt-1 text-xs leading-snug text-slate-700">
                  {l.topicsDiscussed
                    .split(" · ")
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
