// End-to-end safety check of the reminder job against a DISPOSABLE database.
// Never sends email: runs only in "off" and "dry_run" modes.
//
//   VERIFY_DATABASE_URL=... npx tsx scripts/verify-notification-safety.ts --confirm=<host>
//
// (`server-only` must resolve outside Next: NODE_PATH=<dir with a stub>.)
// Creates synthetic `zz-ns-` users at a synthetic school, asserts each rule,
// and deletes everything it created.
import { readFileSync, existsSync } from "node:fs";
import { parse } from "dotenv";
import { neon } from "@neondatabase/serverless";

const url = process.env.VERIFY_DATABASE_URL;
const host = (() => {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
})();
const confirm = process.argv.find((a) => a.startsWith("--confirm="))?.slice(10);
if (!url || !host || confirm !== host) {
  console.error(`Refusing: set VERIFY_DATABASE_URL and pass --confirm=${host ?? "<host>"}.`);
  process.exit(1);
}
if (existsSync(".env.local")) {
  const local = parse(readFileSync(".env.local"));
  const mains = [local.DATABASE_URL, local.DATABASE_URL_OWNER].map((u) => {
    try {
      return u ? new URL(u).host : null;
    } catch {
      return null;
    }
  });
  if (mains.includes(host)) {
    console.error("Refusing: that is the app's main database from .env.local.");
    process.exit(1);
  }
}
// The job reads DATABASE_URL through the app's db client.
process.env.DATABASE_URL = url;
process.env.AUTH_RESEND_KEY = "";

const sql = neon(url);
let failures = 0;
function check(ok: unknown, label: string) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures++;
}

const P = "zz-ns-";
const school = "zz-ns.edu";
const H = 3600_000;

async function rows(userIds: string[]) {
  return (await sql(
    `select kind, status, user_id, attempts, dedupe_key from notification_delivery where user_id = any($1) order by created_at`,
    [userIds]
  )) as { kind: string; status: string; user_id: string; attempts: number; dedupe_key: string }[];
}

async function main() {
  const { runReminderJob } = await import("../src/lib/reminder-job");
  const now = new Date();
  const ids = { mentor: `${P}mentor`, mentee: `${P}mentee`, gone: `${P}gone`, m2: `${P}mentor2` };
  const all = Object.values(ids);
  await sql(`insert into school_domain(domain, school_name, active) values ($1,'Notification safety (synthetic)',true) on conflict do nothing`, [school]);
  for (const id of all) {
    await sql(
      `insert into "user"(id,email,name,first_name,is_mentor,deactivated_at) values ($1,$2,$1,'Test',$3,$4)
       on conflict (id) do update set deactivated_at = $4`,
      [id, `${id}@${school}`, id.includes("mentor"), id === ids.gone ? now : null]
    );
  }
  const liveSincePrev = (await sql(`select value_json from program_setting where school='*' and key='notifications_live_since'`)) as { value_json: string }[];
  try {
    const recent = new Date(now.getTime() - 2 * 86400000);
    const [pair] = (await sql(
      `insert into "match"(mentor_id, mentee_id, started_at, last_activity_at, first_meeting_at, last_interaction_at)
       values ($1,$2,$3,$3,$3,$3) returning id`,
      [ids.mentor, ids.mentee, recent]
    )) as { id: string }[];
    const [gonePair] = (await sql(
      `insert into "match"(mentor_id, mentee_id, started_at, last_activity_at, first_meeting_at, last_interaction_at)
       values ($1,$2,$3,$3,$3,$3) returning id`,
      [ids.m2, ids.gone, recent]
    )) as { id: string }[];
    const meeting = async (matchId: string, startsAt: Date, status = "scheduled") =>
      ((await sql(
        `insert into scheduled_meeting(match_id, scheduled_date, scheduled_time, timezone, starts_at, status)
         values ($1, $2, $3, 'UTC', $4, $5) returning id`,
        [matchId, startsAt.toISOString().slice(0, 10), startsAt.toISOString().slice(11, 16), startsAt, status]
      )) as { id: string }[])[0].id;

    const soon = new Date(now.getTime() + 20 * H);
    const m1 = await meeting(pair.id, soon);
    await meeting(pair.id, new Date(now.getTime() + 10 * H), "cancelled");
    await meeting(pair.id, new Date(now.getTime() - 30 * H), "completed");
    await meeting(gonePair.id, soon);

    // 1. off
    process.env.NOTIFICATIONS_MODE = "off";
    const off = await runReminderJob(now);
    check(off.outcomes === null && (await rows(all)).length === 0, "NOTIFICATIONS_MODE=off records and sends nothing");

    // 2. dry run
    process.env.NOTIFICATIONS_MODE = "dry_run";
    const dry = await runReminderJob(now);
    let r = await rows(all);
    check(r.length > 0 && r.every((x) => x.status === "dry_run"), "dry_run records what would send, sends nothing");
    check((dry.candidatesByKind?.meeting_24h ?? 0) >= 2, `dry_run reports per-kind counts (${JSON.stringify(dry.candidatesByKind)})`);
    check(r.filter((x) => x.kind === "meeting_24h").length === 2, "one 24h reminder per participant for the live meeting only (cancelled meeting ignored)");
    check(!r.some((x) => x.kind === "log_followup"), "completed meeting gets no follow-up or missed notice");
    check(!r.some((x) => x.user_id === ids.gone), "deactivated account receives nothing");
    check(!r.some((x) => x.user_id === ids.m2), "the partner of a removed account isn't reminded about that pair either");

    // 3. idempotent
    const count = r.length;
    await runReminderJob(now);
    check((await rows(all)).length === count, "a second run adds nothing (once per event)");

    // 4. reschedule
    const moved = new Date(now.getTime() + 22 * H);
    await sql(`update scheduled_meeting set starts_at = $2 where id = $1`, [m1, moved]);
    await runReminderJob(now);
    r = await rows(all);
    check(r.filter((x) => x.kind === "meeting_24h").length === 4, "a rescheduled meeting gets fresh reminders for the new time");

    // 5. crash during delivery: a stale pending claim is retried, not duplicated
    const crashedKey = `meeting_1h:${m1}:crash-sim:${ids.mentee}`;
    await sql(
      `insert into notification_delivery(dedupe_key, user_id, kind, match_id, status, attempts, created_at)
       values ($1,$2,'meeting_1h',$3,'pending',1, $4)`,
      [crashedKey, ids.mentee, pair.id, new Date(now.getTime() - 2 * H)]
    );
    const before = (await rows(all)).length;
    await runReminderJob(now);
    check((await rows(all)).length === before, "stale pending row is not duplicated by later runs");

    // 6. backlog guard: a gap that began before go-live never emails
    await sql(`update program_setting set value_json = $1 where school='*' and key='notifications_live_since'`, [JSON.stringify(now.toISOString())]);
    await sql(`update "match" set last_interaction_at = $2, first_meeting_at = $2 where id = $1`, [pair.id, new Date(now.getTime() - 40 * 86400000)]);
    await runReminderJob(now);
    check(!(await rows(all)).some((x) => x.kind.startsWith("inactivity")), "pairs that went quiet before go-live are not emailed");
  } finally {
    await sql(`delete from notification_delivery where user_id = any($1)`, [all]);
    await sql(`delete from "match" where mentor_id = any($1) or mentee_id = any($1)`, [all]);
    await sql(`delete from "user" where id = any($1)`, [all]);
    if (liveSincePrev[0]) {
      await sql(`update program_setting set value_json = $1 where school='*' and key='notifications_live_since'`, [liveSincePrev[0].value_json]);
    } else {
      await sql(`delete from program_setting where school='*' and key='notifications_live_since'`);
    }
  }
  console.log(failures ? `${failures} FAILED` : "ALL NOTIFICATION SAFETY CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
