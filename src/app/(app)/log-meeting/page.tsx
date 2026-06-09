import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users, meetingLogs } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
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
  // Admins (who aren't also mentors) go to admin — they don't log activity.
  if (me.isAdmin && !me.isMentor) redirect("/admin");

  const { matchId: preselectMatchId } = await searchParams;

  if (me.isMentor) {
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
      <div className="space-y-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Mentor tools
          </p>
          <h1 className="mt-1 font-display text-3xl font-black text-byui-blue-dark">
            Log an Activity
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Capture a new session on the left. The panel on the right shows the
            selected mentee&apos;s full activity history — including what they
            logged themselves — and lets you edit any entry.
          </p>
        </header>

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
