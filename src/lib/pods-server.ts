import "server-only";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { meetingLogs, pods, users } from "@/db/schema";
import { currentMonthStart, logPoints, rankPods } from "@/lib/pods";
import { sameSchoolAs } from "@/lib/school-scope";

// Put everyone without a pod into the pod for their major, creating major
// pods as needed. Idempotent and cheap; run before showing the leaderboard.
export async function ensureMajorPods() {
  const unassigned = await db
    .selectDistinct({ major: users.major })
    .from(users)
    .where(and(isNull(users.podId), isNotNull(users.major), isNull(users.deactivatedAt)));
  for (const { major } of unassigned) {
    const name = major?.trim();
    if (!name) continue;
    await db
      .insert(pods)
      .values({ name, major: name })
      .onConflictDoNothing();
    const [pod] = await db
      .select({ id: pods.id })
      .from(pods)
      .where(sql`lower(${pods.name}) = lower(${name})`)
      .limit(1);
    if (!pod) continue;
    await db
      .update(users)
      .set({ podId: pod.id })
      .where(and(isNull(users.podId), sql`trim(${users.major}) = ${name}`));
  }
}

export async function listPods() {
  return db.select({ id: pods.id, name: pods.name }).from(pods).orderBy(pods.name);
}

// This month's standings: every pod with its members' points.
// Scoped to one school: pods are shared by major name across schools, so
// without this a member would see other schools' students on the board.
export async function monthlyLeaderboard(viewerEmail: string, now = new Date()) {
  const inSchool = sameSchoolAs(viewerEmail);
  const since = currentMonthStart(now);
  const [allPods, members, logs] = await Promise.all([
    listPods(),
    db
      .select({ id: users.id, name: users.name, image: users.image, podId: users.podId })
      .from(users)
      .where(and(isNotNull(users.podId), isNull(users.deactivatedAt), inSchool)),
    db
      .select({
        studentId: meetingLogs.studentId,
        topicsDiscussed: meetingLogs.topicsDiscussed,
        isSystemGenerated: meetingLogs.isSystemGenerated,
      })
      .from(meetingLogs)
      .where(
        and(
          gte(meetingLogs.meetingDate, since),
          sql`${meetingLogs.meetingDate} <= ${now}`,
          sql`${meetingLogs.studentId} in (select "id" from "user" where ${inSchool})`
        )
      ),
  ]);

  const pointsByUser = new Map<string, number>();
  for (const l of logs) {
    if (!l.studentId) continue;
    pointsByUser.set(l.studentId, (pointsByUser.get(l.studentId) ?? 0) + logPoints(l));
  }
  const membersByPod = new Map<string, { id: string; name: string | null; image: string | null; points: number }[]>();
  for (const m of members) {
    const list = membersByPod.get(m.podId!) ?? [];
    list.push({ id: m.id, name: m.name, image: m.image, points: pointsByUser.get(m.id) ?? 0 });
    membersByPod.set(m.podId!, list);
  }

  const ranked = rankPods(
    allPods
      .map((p) => {
        const list = membersByPod.get(p.id) ?? [];
        return {
          id: p.id,
          name: p.name,
          members: list.length,
          points: list.reduce((s, m) => s + m.points, 0),
          roster: list.sort((a, b) => b.points - a.points || (a.name ?? "").localeCompare(b.name ?? "")),
        };
      })
      .filter((p) => p.members > 0)
  );
  return { since, pods: ranked };
}

export async function joinPod(userId: string, podId: string): Promise<boolean> {
  const [pod] = await db.select({ id: pods.id }).from(pods).where(eq(pods.id, podId)).limit(1);
  if (!pod) return false;
  await db.update(users).set({ podId }).where(eq(users.id, userId));
  return true;
}
