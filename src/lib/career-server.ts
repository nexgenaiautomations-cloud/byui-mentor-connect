import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { careerMilestones, meetingLogs } from "@/db/schema";
import { keyForLabel } from "@/lib/possible-actions";

export async function listMilestones(studentId: string) {
  return db
    .select()
    .from(careerMilestones)
    .where(eq(careerMilestones.studentId, studentId))
    .orderBy(desc(careerMilestones.occurredOn), desc(careerMilestones.createdAt));
}

// Students who logged "Applied to an internship or job" (any role wording)
// — an applying signal from existing activity logs, counted per student.
export async function applicationLogCounts(studentIds?: string[]): Promise<Map<string, number>> {
  const rows = await db
    .select({ studentId: meetingLogs.studentId, topics: meetingLogs.topicsDiscussed })
    .from(meetingLogs)
    .where(
      and(
        sql`${meetingLogs.topicsDiscussed} ilike '%appl%'`,
        eq(meetingLogs.isSystemGenerated, false),
        studentIds ? inArray(meetingLogs.studentId, studentIds.length ? studentIds : ["\u0000"]) : sql`true`
      )
    );
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!r.studentId) continue;
    const applied = (r.topics ?? "").split(" · ").some((p) => keyForLabel(p.trim()) === "apply_internship");
    if (applied) out.set(r.studentId, (out.get(r.studentId) ?? 0) + 1);
  }
  return out;
}
