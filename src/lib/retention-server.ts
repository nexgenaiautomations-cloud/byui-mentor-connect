import "server-only";
// Retention maintenance job. Report-only by default; deletes only rules
// marked `enforce` in src/lib/retention.ts and only with RETENTION_MODE=enforce.
// One run at a time (lease row in program_setting), bounded batches, every
// run audited and its report stored for operators.
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvent } from "@/lib/audit";
import { saveSetting } from "@/lib/program-settings-server";
import {
  BATCH_SIZE,
  LOCK_MINUTES,
  MAX_BATCHES_PER_RULE,
  RETENTION_RULES,
  cutoffFor,
  retentionMode,
  type RetentionRule,
  type RetentionRuleId,
  type RuleResult,
} from "@/lib/retention";

export const RETENTION_REPORT_KEY = "retention_last_run";
const LOCK_KEY = "retention_lock";

type RuleSql = { count: (cutoff: Date) => SQL; deleteBatch?: (cutoff: Date) => SQL };

// Rows of users under an active legal/investigation hold are never eligible.
const notHeld = (userIdExpr: SQL) =>
  sql`not exists (select 1 from "retention_hold" h where h.released_at is null and h.user_id = ${userIdExpr})`;

const RULE_SQL: Record<RetentionRuleId, RuleSql> = {
  expired_verification_tokens: {
    count: (c) => sql`select count(*)::int as n from "verification_token" where "expires" < ${c}`,
    deleteBatch: (c) => sql`
      delete from "verification_token" where ctid in (
        select ctid from "verification_token" where "expires" < ${c} limit ${BATCH_SIZE}
      )`,
  },
  expired_password_reset_tokens: {
    count: (c) => sql`select count(*)::int as n from "password_reset_token" where "expires_at" < ${c}`,
    deleteBatch: (c) => sql`
      delete from "password_reset_token" where "id" in (
        select "id" from "password_reset_token" where "expires_at" < ${c} limit ${BATCH_SIZE}
      )`,
  },
  notification_delivery: {
    count: (c) => sql`select count(*)::int as n from "notification_delivery" d
      where d.created_at < ${c} and ${notHeld(sql`d.user_id`)}`,
  },
  meeting_log_after_match: {
    count: (c) => sql`select count(*)::int as n from "meeting_log" l join "match" m on m.id = l.match_id
      where m.status <> 'active' and m.ended_at < ${c} and ${notHeld(sql`l.student_id`)}`,
  },
  scheduled_meeting_after_match: {
    count: (c) => sql`select count(*)::int as n from "scheduled_meeting" s join "match" m on m.id = s.match_id
      where m.status <> 'active' and m.ended_at < ${c} and ${notHeld(sql`m.mentee_id`)}`,
  },
  mentor_application: {
    count: (c) => sql`select count(*)::int as n from "mentor_application" a
      where a.status <> 'pending' and a.reviewed_at < ${c} and ${notHeld(sql`a.user_id`)}`,
  },
  closed_intervention: {
    count: (c) => sql`select count(*)::int as n from "intervention" i
      where i.status in ('resolved','closed') and i.resolved_at < ${c} and ${notHeld(sql`i.student_id`)}`,
  },
  career_milestone_inactive: {
    count: (c) => sql`select count(*)::int as n from "career_milestone" cm join "user" u on u.id = cm.student_id
      where u.deactivated_at < ${c} and ${notHeld(sql`cm.student_id`)}`,
  },
  audit_event_hot: {
    count: (c) => sql`select count(*)::int as n from "audit_event" where created_at < ${c}`,
  },
  inactive_account: {
    count: (c) => sql`select count(*)::int as n from "user" u where u.deactivated_at < ${c} and ${notHeld(sql`u.id`)}`,
  },
};

async function countOf(q: SQL): Promise<number> {
  const r = await db.execute(q);
  return Number((r.rows[0] as { n?: number } | undefined)?.n ?? 0);
}

// Lease-based lock: works over stateless HTTP connections (advisory locks
// don't, because each query may run on a different session).
async function acquireLock(owner: string, now: Date): Promise<boolean> {
  const until = new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString();
  const value = JSON.stringify({ owner, until });
  const r = await db.execute(sql`
    insert into "program_setting"("school","key","value_json") values ('*', ${LOCK_KEY}, ${value})
    on conflict ("school","key") do update set "value_json" = excluded."value_json", "updated_at" = now()
    where ("program_setting"."value_json"::json ->> 'until')::timestamptz < ${now.toISOString()}::timestamptz
    returning "key"`);
  return r.rows.length > 0;
}

async function releaseLock(owner: string) {
  await db.execute(sql`
    delete from "program_setting" where "school" = '*' and "key" = ${LOCK_KEY}
      and ("value_json"::json ->> 'owner') = ${owner}`);
}

export type RetentionRunReport = {
  mode: "report" | "enforce";
  startedAt: string;
  finishedAt: string;
  results: (RuleResult & Pick<RetentionRule, "table" | "description" | "blockedBy">)[];
  skipped?: "locked";
};

export async function runRetention(opts: { now?: Date; mode?: "report" | "enforce"; actorUserId?: string | null } = {}): Promise<RetentionRunReport> {
  const now = opts.now ?? new Date();
  const mode = opts.mode ?? retentionMode(process.env.RETENTION_MODE);
  const owner = crypto.randomUUID();
  const startedAt = now.toISOString();
  if (!(await acquireLock(owner, now))) {
    return { mode, startedAt, finishedAt: new Date().toISOString(), results: [], skipped: "locked" };
  }
  const results: RetentionRunReport["results"] = [];
  try {
    for (const rule of RETENTION_RULES) {
      const cutoff = cutoffFor(rule, now);
      const q = RULE_SQL[rule.id];
      const base = { id: rule.id, table: rule.table, description: rule.description, blockedBy: rule.blockedBy, cutoff: cutoff.toISOString() };
      try {
        const eligible = await countOf(q.count(cutoff));
        let deleted = 0;
        const enforced = mode === "enforce" && rule.enforce && !!q.deleteBatch;
        if (enforced && eligible > 0) {
          for (let i = 0; i < MAX_BATCHES_PER_RULE; i++) {
            const r = await db.execute(q.deleteBatch!(cutoff));
            const n = r.rowCount ?? 0;
            deleted += n;
            if (n < BATCH_SIZE) break;
          }
        }
        results.push({ ...base, eligible, deleted, enforced });
      } catch (e) {
        // One failing rule doesn't stop the others.
        results.push({ ...base, eligible: 0, deleted: 0, enforced: false, error: e instanceof Error ? e.message.slice(0, 200) : "failed" });
      }
    }
  } finally {
    await releaseLock(owner).catch(() => {});
  }
  const report: RetentionRunReport = { mode, startedAt, finishedAt: new Date().toISOString(), results };
  await saveSetting("*", RETENTION_REPORT_KEY, report, opts.actorUserId ?? null).catch(() => {});
  void auditEvent({
    actorUserId: opts.actorUserId ?? null,
    eventType: "RETENTION_RUN",
    severity: results.some((r) => r.deleted > 0 || r.error) ? "warning" : "info",
    metadata: {
      mode,
      deleted: Object.fromEntries(results.filter((r) => r.deleted).map((r) => [r.id, r.deleted])),
      errors: results.filter((r) => r.error).map((r) => r.id),
    },
  });
  return report;
}
