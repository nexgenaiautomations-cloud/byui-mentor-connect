import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { meetingLogs, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";

export default async function AdminMeetingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  // Mentor join is LEFT so mentee-self-logs (no mentor) and system-generated
  // logs still appear. Student join is INNER on studentId since every row
  // post-backfill has a student.
  const mentor = alias(users, "mentor_u");
  const student = alias(users, "student_u");

  const logs = await db
    .select({
      id: meetingLogs.id,
      meetingDate: meetingLogs.meetingDate,
      meetingType: meetingLogs.meetingType,
      durationMinutes: meetingLogs.durationMinutes,
      topicsDiscussed: meetingLogs.topicsDiscussed,
      isSystemGenerated: meetingLogs.isSystemGenerated,
      createdBy: meetingLogs.createdBy,
      accomplishmentGroup: meetingLogs.accomplishmentGroup,
      mentorName: mentor.name,
      mentorImage: mentor.image,
      studentName: student.name,
      studentImage: student.image,
    })
    .from(meetingLogs)
    .leftJoin(mentor, eq(mentor.id, meetingLogs.mentorId))
    .innerJoin(student, eq(student.id, meetingLogs.studentId))
    .orderBy(desc(meetingLogs.meetingDate))
    .limit(100);

  const [totals] = await db
    .select({
      total: sql<number>`(select count(*)::int from "meeting_log" where is_system_generated = false)`,
      totalMinutes: sql<number>`(select coalesce(sum(duration_minutes), 0)::int from "meeting_log")`,
      thisMonth: sql<number>`(select count(*)::int from "meeting_log" where is_system_generated = false and meeting_date >= now() - interval '30 days')`,
      selfLogged: sql<number>`(select count(*)::int from "meeting_log" where created_by = 'mentee')`,
      systemLogged: sql<number>`(select count(*)::int from "meeting_log" where is_system_generated = true)`,
    })
    .from(sql`(select 1) as _t`);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          Program logs
        </p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">
          Activity
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Every activity logged across the program. System-generated &ldquo;goal
          met&rdquo; events are surfaced inline so you can see when students hit
          their KPIs.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="All time" value={totals?.total ?? 0} tone="navy" />
        <StatTile
          label="Last 30 days"
          value={totals?.thisMonth ?? 0}
          tone="emerald"
        />
        <StatTile
          label="Self-logged by students"
          value={totals?.selfLogged ?? 0}
          tone="sky"
        />
        <StatTile
          label="System (goal met)"
          value={totals?.systemLogged ?? 0}
          tone="emerald"
        />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-navy-800">
          Recent
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No meetings logged yet.</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <ul className="divide-y divide-slate-100">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className={
                    "px-4 py-3 sm:px-5 " +
                    (l.isSystemGenerated
                      ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                      : "hover:bg-slate-50")
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center -space-x-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          l.studentImage ||
                          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(l.studentName ?? "X")}&backgroundColor=7c3aed&textColor=ffffff`
                        }
                        alt=""
                        className="h-8 w-8 rounded-full border-2 border-white object-cover"
                      />
                      {l.mentorName && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={
                            l.mentorImage ||
                            `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(l.mentorName)}&backgroundColor=1B3A6B&textColor=ffffff`
                          }
                          alt=""
                          className="h-8 w-8 rounded-full border-2 border-white object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-navy-800">
                          {l.studentName}
                          {l.mentorName ? (
                            <>
                              <span className="text-slate-400"> · with </span>
                              {l.mentorName}
                            </>
                          ) : (
                            <span className="text-slate-400"> · no mentor</span>
                          )}
                        </p>
                        <AuthorPill createdBy={l.createdBy} />
                        {l.isSystemGenerated ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            Goal met
                          </span>
                        ) : (
                          <span className="pill capitalize">
                            {l.meetingType.replace("_", " ")}
                          </span>
                        )}
                        {l.durationMinutes ? (
                          <span className="text-xs text-slate-500">
                            {l.durationMinutes} min
                          </span>
                        ) : null}
                      </div>
                      {l.topicsDiscussed && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {l.topicsDiscussed}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-slate-500">
                      {new Date(l.meetingDate).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function AuthorPill({ createdBy }: { createdBy: string | null }) {
  if (!createdBy || createdBy === "mentor") return null;
  const map: Record<string, { label: string; cls: string }> = {
    mentee: {
      label: "Self-logged",
      cls: "bg-violet-100 text-violet-800",
    },
    admin: { label: "Admin", cls: "bg-slate-200 text-slate-800" },
    system: { label: "System", cls: "bg-emerald-100 text-emerald-800" },
  };
  const entry = map[createdBy];
  if (!entry) return null;
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
        entry.cls
      }
    >
      {entry.label}
    </span>
  );
}
