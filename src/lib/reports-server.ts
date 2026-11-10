import "server-only";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { matches, meetingLogs, pods, requests, users } from "@/db/schema";
import { logPoints } from "@/lib/pods";
import { departmentOf, type ReportRole, type ReportRow, type ResolvedRange } from "@/lib/reports";

// One row per active (not removed) user with their activity inside the range.
export async function loadReport(range: ResolvedRange) {
  const [people, logs, menteeCounts, matchesStarted, requestsMade] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        major: users.major,
        semesterLevel: users.semesterLevel,
        isMentor: users.isMentor,
        isExecutiveMentor: users.isExecutiveMentor,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        podName: pods.name,
      })
      .from(users)
      .leftJoin(pods, eq(pods.id, users.podId))
      .where(isNull(users.deactivatedAt)),
    db
      .select({
        studentId: meetingLogs.studentId,
        group: meetingLogs.accomplishmentGroup,
        topicsDiscussed: meetingLogs.topicsDiscussed,
        isSystemGenerated: meetingLogs.isSystemGenerated,
      })
      .from(meetingLogs)
      .where(and(gte(meetingLogs.meetingDate, range.start), lt(meetingLogs.meetingDate, range.end))),
    db
      .select({ mentorId: matches.mentorId, n: sql<number>`count(*)::int` })
      .from(matches)
      .where(eq(matches.status, "active"))
      .groupBy(matches.mentorId),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(gte(matches.startedAt, range.start), lt(matches.startedAt, range.end))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(requests)
      .where(and(gte(requests.requestedAt, range.start), lt(requests.requestedAt, range.end))),
  ]);

  const mentees = new Map(menteeCounts.map((r) => [r.mentorId, r.n]));
  const stats = new Map<string, { activities: number; tasks: number; industry: number; chats: number; points: number }>();
  for (const l of logs) {
    if (!l.studentId || l.isSystemGenerated) continue;
    const s = stats.get(l.studentId) ?? { activities: 0, tasks: 0, industry: 0, chats: 0, points: 0 };
    s.activities += 1;
    if (l.group === "career_tasks") s.tasks += 1;
    if (l.group === "industry_experiences") s.industry += 1;
    if (l.group === "career_chats") s.chats += 1;
    s.points += logPoints(l);
    stats.set(l.studentId, s);
  }

  const rows: ReportRow[] = people.map((p) => {
    const s = stats.get(p.id);
    const role: ReportRole = p.isAdmin
      ? "admin"
      : p.isMentor && p.isExecutiveMentor
        ? "executive_mentor"
        : p.isMentor
          ? "mentor"
          : "member";
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      role,
      major: p.major,
      department: departmentOf(p.major),
      semesterLevel: p.semesterLevel,
      podName: p.podName,
      activeMentees: mentees.get(p.id) ?? 0,
      activities: s?.activities ?? 0,
      careerTasks: s?.tasks ?? 0,
      industryExperiences: s?.industry ?? 0,
      careerChats: s?.chats ?? 0,
      points: s?.points ?? 0,
      joinedInRange: p.createdAt >= range.start && p.createdAt < range.end,
    };
  });

  return {
    rows,
    matchesStarted: matchesStarted[0]?.n ?? 0,
    requestsMade: requestsMade[0]?.n ?? 0,
  };
}
