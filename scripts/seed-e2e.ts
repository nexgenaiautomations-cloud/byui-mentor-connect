// Seed fixture accounts for Playwright on a DISPOSABLE database (e.g. a Neon
// branch with the accountability migration applied). Never run this against
// production: it resets every `e2e-` fixture's activity on each run.
//
//   E2E_DATABASE_URL=... E2E_PASSWORD=... \
//     npx tsx scripts/seed-e2e.ts --confirm=<host of E2E_DATABASE_URL>
//
// Safety:
//   * --confirm must equal the target host, so the operator has to name it.
//   * Refuses when the target is the app's main database (DATABASE_URL /
//     DATABASE_URL_OWNER in .env.local).
//   * Writes a sentinel (program_setting e2e_fixture) that the Playwright
//     global setup requires before any test may run.
//   * Only touches rows belonging to `e2e-` users and two synthetic schools.
import { readFileSync, existsSync } from "node:fs";
import { parse } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../src/lib/password";
import { TERMS_VERSION } from "../src/lib/disclaimers";

export const E2E_SCHOOLS = { alpha: "e2e-alpha.edu", beta: "e2e-beta.edu" } as const;

type Person = {
  id: string;
  school: keyof typeof E2E_SCHOOLS;
  first: string;
  last: string;
  admin?: boolean;
  mentor?: boolean;
  exec?: boolean;
};

export const E2E_PEOPLE: Person[] = [
  { id: "e2e-admin", school: "alpha", first: "Avery", last: "Admin", admin: true, mentor: true },
  { id: "e2e-exec", school: "alpha", first: "Emery", last: "Executive", mentor: true, exec: true },
  { id: "e2e-mentor", school: "alpha", first: "Morgan", last: "Mentor", mentor: true },
  { id: "e2e-member", school: "alpha", first: "Riley", last: "Member" },
  { id: "e2e-solo", school: "alpha", first: "Sky", last: "Solo" },
  { id: "e2e-beta-admin", school: "beta", first: "Bailey", last: "Betaadmin", admin: true, mentor: true },
  { id: "e2e-beta-member", school: "beta", first: "Blake", last: "Betamember" },
];

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

async function main() {
  const url = process.env.E2E_DATABASE_URL;
  const password = process.env.E2E_PASSWORD;
  if (!url || !password) throw new Error("Set E2E_DATABASE_URL and E2E_PASSWORD.");
  const host = hostOf(url);
  if (!host || arg("confirm") !== host) {
    throw new Error(`Refusing: pass --confirm=${host} to seed that database.`);
  }
  if (existsSync(".env.local")) {
    const local = parse(readFileSync(".env.local"));
    const main = [hostOf(local.DATABASE_URL), hostOf(local.DATABASE_URL_OWNER)];
    if (main.includes(host)) throw new Error("Refusing: that is the app's main database from .env.local.");
  }

  const sql = neon(url);
  const cols = (await sql(
    `select 1 from information_schema.columns where table_name='meeting_log' and column_name='event_kind'`
  )) as unknown[];
  if (cols.length === 0) throw new Error("Run scripts/migrate-2026-11-accountability.ts on this database first.");

  const hash = await hashPassword(password);
  const now = new Date();
  const ids = E2E_PEOPLE.map((p) => p.id);

  for (const [, domain] of Object.entries(E2E_SCHOOLS)) {
    await sql(
      `insert into school_domain(domain, school_name, active) values ($1, $2, true)
       on conflict (domain) do update set active = true`,
      [domain, `E2E ${domain}`]
    );
  }
  for (const p of E2E_PEOPLE) {
    const email = `${p.id}@${E2E_SCHOOLS[p.school]}`;
    await sql(
      `insert into "user"(id,email,name,first_name,last_name,email_verified,major,semester_level,expected_graduation,
         career_interests,preferred_contact_method,is_mentor,is_executive_mentor,is_admin,onboarded_at,password_hash,
         terms_accepted_version,terms_accepted_at,pledge_signed_name,pledge_signed_at,mentor_available,deactivated_at)
       values ($1,$2,$3,$4,$5,$6,'Accounting','Junior','Spring 2027',array['Audit'],'email',$7,$8,$9,$6,$10,$11,$6,$3,$6,true,null)
       on conflict (id) do update set password_hash=$10, is_mentor=$7, is_executive_mentor=$8, is_admin=$9,
         terms_accepted_version=$11, deactivated_at=null`,
      [p.id, email, `${p.first} ${p.last}`, p.first, p.last, now, !!p.mentor, !!p.exec, !!p.admin, hash, TERMS_VERSION]
    );
  }

  // Reset everything tests may have changed on previous runs.
  await sql(`delete from intervention where student_id = any($1) or mentor_id = any($1)`, [ids]);
  await sql(`delete from notification_delivery where user_id = any($1)`, [ids]);
  await sql(`delete from career_milestone where student_id = any($1)`, [ids]);
  await sql(`delete from meeting_log where student_id = any($1) or mentor_id = any($1)`, [ids]);
  await sql(`delete from notification_preference where user_id = any($1)`, [ids]);
  await sql(`delete from "match" where mentor_id = any($1) or mentee_id = any($1)`, [ids]);

  // One active pair at alpha: matched 25 days ago, one meeting 18 days ago
  // with open action items (mentor logged it; mentee hasn't confirmed).
  const started = new Date(now.getTime() - 25 * 86400000);
  const met = new Date(now.getTime() - 18 * 86400000);
  const [m] = (await sql(
    `insert into "match"(mentor_id, mentee_id, started_at, last_activity_at, first_meeting_at, last_meeting_at, last_interaction_at)
     values ('e2e-mentor','e2e-member',$1,$2,$2,$2,$2) returning id`,
    [started, met]
  )) as { id: string }[];
  await sql(
    `insert into meeting_log(match_id, mentor_id, mentee_id, student_id, created_by, accomplishment_group, meeting_date,
       meeting_type, duration_minutes, topics_discussed, action_items, event_kind, mentor_confirmed)
     values ($1,'e2e-mentor','e2e-member','e2e-member','mentor','career_tasks',$2,'video',45,'Helped with resumes',
       'Send the updated resume','mentor_meeting',true)`,
    [m.id, met]
  );
  // A beta pair that went quiet long ago (so the risk check has a case).
  await sql(
    `insert into "match"(mentor_id, mentee_id, started_at, last_activity_at) values ('e2e-beta-admin','e2e-beta-member',$1,$1)`,
    [new Date(now.getTime() - 90 * 86400000)]
  );

  // Fixture admins have already seen any pre-existing issue reports, so the
  // mandatory-acknowledgement popup doesn't cover the pages under test.
  await sql(
    `insert into issue_report_receipt(issue_id, admin_id)
     select r.id, u.id from issue_report r cross join "user" u where u.id = any($1) and u.is_admin
     on conflict do nothing`,
    [ids]
  );
  await sql(
    `insert into program_setting(school, key, value_json) values ('*','e2e_fixture','true')
     on conflict (school, key) do update set value_json='true', updated_at=now()`
  );
  console.log(`[seed-e2e] seeded ${E2E_PEOPLE.length} fixture users on ${host}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
