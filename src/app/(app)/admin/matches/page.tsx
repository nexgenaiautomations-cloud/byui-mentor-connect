import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { matches, users } from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { StatTile } from "@/components/stat-card";
import {
  ActiveMatchesTable,
  EndedMatchesTable,
  type ActiveMatchRow,
  type EndedMatchRow,
} from "./matches-table";

function daysSince(d: Date) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function AdminMatchesPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const mentor = alias(users, "mentor_u");
  const mentee = alias(users, "mentee_u");

  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      startedAt: matches.startedAt,
      lastActivityAt: matches.lastActivityAt,
      endedAt: matches.endedAt,
      mentorName: mentor.name,
      mentorImage: mentor.image,
      mentorEmail: mentor.email,
      menteeName: mentee.name,
      menteeImage: mentee.image,
      menteeEmail: mentee.email,
      meetingCount: sql<number>`(select count(*)::int from "meeting_log" where match_id = "match".id)`,
    })
    .from(matches)
    .innerJoin(mentor, eq(mentor.id, matches.mentorId))
    .innerJoin(mentee, eq(mentee.id, matches.menteeId))
    .orderBy(desc(matches.startedAt));

  const active = rows.filter((r) => r.status === "active");
  const stale = active.filter((r) => daysSince(r.lastActivityAt) > 30);
  const ended = rows.filter((r) => r.status !== "active");

  const activeRows: ActiveMatchRow[] = active.map((m) => ({
    id: m.id,
    mentorName: m.mentorName,
    mentorImage: m.mentorImage,
    mentorEmail: m.mentorEmail,
    menteeName: m.menteeName,
    menteeImage: m.menteeImage,
    menteeEmail: m.menteeEmail,
    meetingCount: m.meetingCount,
    startedAt: m.startedAt.toISOString(),
    lastActivityAt: m.lastActivityAt.toISOString(),
  }));

  const endedRows: EndedMatchRow[] = ended.map((m) => ({
    id: m.id,
    status: m.status as "completed" | "cancelled",
    endedAt: m.endedAt ? m.endedAt.toISOString() : null,
    mentorName: m.mentorName,
    mentorImage: m.mentorImage,
    mentorEmail: m.mentorEmail,
    menteeName: m.menteeName,
    menteeImage: m.menteeImage,
    menteeEmail: m.menteeEmail,
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Pairings</p>
        <h1 className="mt-1 font-display text-2xl font-black text-navy-800 sm:text-3xl">Matches</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every active and ended pairing across the program.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Active" value={active.length} tone="emerald" />
        <StatTile label="Stale (30d+)" value={stale.length} tone="amber" />
        <StatTile label="Ended" value={ended.length} tone="slate" />
        <StatTile
          label="Total meetings"
          value={rows.reduce((acc, r) => acc + (r.meetingCount ?? 0), 0)}
          tone="navy"
        />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-navy-800">Active</h2>
        <ActiveMatchesTable rows={activeRows} />
      </section>

      {endedRows.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-navy-800">Ended</h2>
          <EndedMatchesTable rows={endedRows} />
        </section>
      )}
    </div>
  );
}
