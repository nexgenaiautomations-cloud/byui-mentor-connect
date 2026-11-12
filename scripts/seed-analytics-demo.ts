// Synthetic, program-sized data for the analytics dashboards: visual review,
// screenshots without real student data, and performance testing.
// DISPOSABLE DATABASES ONLY — same guards as scripts/seed-e2e.ts.
//
//   E2E_DATABASE_URL=... npx tsx scripts/seed-analytics-demo.ts --confirm=<host> [--students=1500]
//
// Everything lives at the synthetic school e2e-alpha.edu under ids starting
// with `demo-`, and is replaced on every run. Values come from a seeded PRNG,
// so runs are reproducible. Nothing here is real or derived from real data.
import { readFileSync, existsSync } from "node:fs";
import { parse } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { ACTIONS } from "../src/lib/possible-actions";

const SCHOOL = "e2e-alpha.edu";
const MAJORS = ["Accounting", "Business Management", "Finance", "Marketing", "Economics", "Business Analytics", "Communication"];

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}
function hostOf(u?: string) {
  try {
    return u ? new URL(u).host : null;
  } catch {
    return null;
  }
}

// mulberry32 — small deterministic PRNG.
let seed = 20261112;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const DAY = 86_400_000;

async function insertMany(sql: (q: string, p: unknown[]) => Promise<unknown>, table: string, cols: string[], rows: unknown[][]) {
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const params: unknown[] = [];
    const values = chunk
      .map((r) => `(${r.map((v) => (params.push(v), `$${params.length}`)).join(",")})`)
      .join(",");
    await sql(`insert into ${table} (${cols.map((c) => `"${c}"`).join(",")}) values ${values}`, params);
  }
}

async function main() {
  const url = process.env.E2E_DATABASE_URL;
  const host = hostOf(url);
  if (!url || !host || arg("confirm") !== host) throw new Error(`Refusing: pass --confirm=${host} to seed that database.`);
  if (existsSync(".env.local")) {
    const local = parse(readFileSync(".env.local"));
    if ([hostOf(local.DATABASE_URL), hostOf(local.DATABASE_URL_OWNER)].includes(host)) {
      throw new Error("Refusing: that is the app's main database from .env.local.");
    }
  }
  const sql = neon(url);
  const sentinel = (await sql(`select value_json from program_setting where school='*' and key='e2e_fixture'`)) as { value_json: string }[];
  if (sentinel[0]?.value_json !== "true") throw new Error("Refusing: run scripts/seed-e2e.ts on this database first.");

  const N = Number(arg("students") ?? 1500);
  const M = Math.max(10, Math.round(N / 10));
  const now = Date.now();

  console.log("[demo] clearing previous demo rows");
  await sql(`delete from intervention where student_id like 'demo-%'`);
  await sql(`delete from career_milestone where student_id like 'demo-%'`);
  await sql(`delete from monthly_feedback where submitted_by_user_id like 'demo-%'`);
  await sql(`delete from meeting_log where student_id like 'demo-%' or mentor_id like 'demo-%'`);
  await sql(`delete from "match" where mentee_id like 'demo-%' or mentor_id like 'demo-%'`);
  await sql(`delete from "user" where id like 'demo-%'`);

  const pods = (await sql(`select id, name from pod`)) as { id: string; name: string }[];
  const podFor = (major: string) => pods.find((p) => p.name.toLowerCase() === major.toLowerCase())?.id ?? null;

  console.log(`[demo] ${N} students, ${M} mentors`);
  const users: unknown[][] = [];
  const students: { id: string; joined: number; major: string; diligence: number }[] = [];
  for (let i = 0; i < M; i++) {
    const major = pick(MAJORS);
    users.push([`demo-m${i}`, `demo-m${i}@${SCHOOL}`, `Demo Mentor ${i}`, true, major, new Date(now - (200 + rand() * 400) * DAY), podFor(major)]);
  }
  for (let i = 0; i < N; i++) {
    const major = pick(MAJORS);
    const joined = now - rand() * 365 * DAY;
    students.push({ id: `demo-s${i}`, joined, major, diligence: rand() });
    users.push([`demo-s${i}`, `demo-s${i}@${SCHOOL}`, `Demo Student ${i}`, false, major, new Date(joined), podFor(major)]);
  }
  await insertMany(sql, `"user"`, ["id", "email", "name", "is_mentor", "major", "created_at", "pod_id"], users);

  // Matches: ~70% of students get a mentor 3–30 days after joining.
  console.log("[demo] matches + logs");
  const matches: unknown[][] = [];
  const logs: unknown[][] = [];
  const feedback: unknown[][] = [];
  const milestones: unknown[][] = [];
  const careerTasks = ACTIONS.filter((a) => a.group === "career_tasks").map((a) => a.menteeLabel);
  const chats = ACTIONS.filter((a) => a.group === "career_chats").map((a) => a.menteeLabel);
  const mentorTopics = ACTIONS.filter((a) => a.group === "career_tasks").map((a) => a.mentorLabel);
  let matchSeq = 0;

  for (const s of students) {
    // Independent career activity, more for diligent students.
    const weeks = Math.floor((now - s.joined) / (7 * DAY));
    for (let w = 0; w < weeks; w++) {
      if (rand() < 0.15 + s.diligence * 0.6) {
        logs.push([null, null, s.id, s.id, "mentee", "career_tasks", new Date(s.joined + (w * 7 + rand() * 6) * DAY), "other", null, pick(careerTasks), "independent_activity", false]);
      }
      if (rand() < s.diligence * 0.5) {
        logs.push([null, null, s.id, s.id, "mentee", "career_chats", new Date(s.joined + (w * 7 + rand() * 6) * DAY), "other", null, pick(chats), "independent_activity", false]);
      }
    }
    // Career pipeline.
    let t = s.joined + rand() * 30 * DAY;
    const stages = ["exploring", "preparing", "applying", "interviewing", "offer_received", "offer_accepted"];
    const depth = Math.floor(s.diligence * 6.5);
    for (let k = 0; k < depth && t < now; k++) {
      const stage = stages[k];
      const type = k >= 4 ? (rand() < 0.6 ? "internship" : rand() < 0.5 ? "part_time" : "full_time") : null;
      milestones.push([s.id, stage, type, new Date(t), rand() < 0.25 ? "verified" : "self_reported"]);
      t += (10 + rand() * 40) * DAY;
    }

    if (rand() > 0.7) continue;
    const started = s.joined + (3 + rand() * 27) * DAY;
    if (started > now) continue;
    const mentor = `demo-m${Math.floor(rand() * M)}`;
    const ended = rand() < 0.15 ? started + (60 + rand() * 120) * DAY : null;
    const engagement = rand();
    const matchId = `00000000-0000-4000-8000-${String(++matchSeq).padStart(12, "0")}`;
    const end = Math.min(now, ended ?? now);
    const meetings: number[] = [];
    // Engaged pairs meet every 2–5 weeks; others drift off.
    let at = started + (2 + rand() * (engagement > 0.3 ? 12 : 45)) * DAY;
    while (at < end && rand() < 0.35 + engagement * 0.6) {
      meetings.push(at);
      at += (14 + rand() * 25 + (1 - engagement) * 30) * DAY;
    }
    for (const mt of meetings) {
      const touch = rand() < 0.25;
      logs.push([matchId, mentor, s.id, s.id, "mentor", "career_tasks", new Date(mt), touch ? "phone" : pick(["video", "in_person"]), touch ? 15 : 30 + Math.floor(rand() * 45), pick(mentorTopics), touch ? "touchpoint" : "mentor_meeting", true]);
    }
    const first = meetings[0] ?? null;
    const last = meetings.at(-1) ?? null;
    matches.push([matchId, mentor, s.id, new Date(started), new Date(last ?? started), first ? new Date(first) : null, last ? new Date(last) : null, last ? new Date(last) : null, ended ? new Date(ended) : null, ended ? "completed" : "active"]);
    // Monthly mentee ratings for some engaged pairs.
    for (let mo = new Date(started); mo.getTime() < end; mo = new Date(mo.getTime() + 30 * DAY)) {
      if (rand() < 0.4) {
        feedback.push([matchId, s.id, "mentee", mo.getUTCMonth() + 1, mo.getUTCFullYear(), Math.max(1, Math.min(5, Math.round(2.5 + engagement * 2.5 + (rand() - 0.5))))]);
      }
    }
  }

  await insertMany(sql, `"match"`, ["id", "mentor_id", "mentee_id", "started_at", "last_activity_at", "first_meeting_at", "last_meeting_at", "last_interaction_at", "ended_at", "status"], matches);
  await insertMany(
    sql,
    "meeting_log",
    ["match_id", "mentor_id", "mentee_id", "student_id", "created_by", "accomplishment_group", "meeting_date", "meeting_type", "duration_minutes", "topics_discussed", "event_kind", "mentor_confirmed"],
    logs
  );
  // One feedback per (match, user, month): dedupe before insert.
  const seen = new Set<string>();
  const fb = feedback.filter((f) => {
    const k = `${f[0]}|${f[1]}|${f[3]}|${f[4]}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  await insertMany(sql, "monthly_feedback", ["match_id", "submitted_by_user_id", "submitted_by_role", "month", "year", "rating"], fb);
  await insertMany(sql, "career_milestone", ["student_id", "stage", "opportunity_type", "occurred_on", "verification"], milestones);
  console.log(`[demo] inserted ${users.length} users, ${matches.length} matches, ${logs.length} logs, ${fb.length} ratings, ${milestones.length} milestones`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
