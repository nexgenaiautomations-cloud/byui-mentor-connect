import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";

// db.execute() records the rendered SQL and answers from a script.
const fake = vi.hoisted(() => ({
  executed: [] as string[],
  params: [] as unknown[][],
  lockFree: true,
  failOn: null as string | null,
  eligible: 3,
  rowCount: 3,
}));
vi.mock("@/db/client", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  return {
    db: {
      execute: vi.fn(async (q: SQL) => {
        const { sql, params } = dialect.sqlToQuery(q);
        fake.executed.push(sql);
        fake.params.push(params);
        if (fake.failOn && sql.includes(fake.failOn)) throw new Error("boom");
        if (sql.includes(`"retention_lock"`) || params.includes("retention_lock")) {
          if (sql.trim().startsWith("insert")) return { rows: fake.lockFree ? [{ key: "retention_lock" }] : [] };
          return { rows: [] };
        }
        if (sql.trim().startsWith("delete")) return { rows: [], rowCount: fake.rowCount };
        return { rows: [{ n: fake.eligible }] };
      }),
    },
  };
});
vi.mock("@/lib/audit", () => ({ auditEvent: vi.fn() }));
vi.mock("@/lib/program-settings-server", () => ({ saveSetting: vi.fn(async () => {}) }));

import { RETENTION_RULES, cutoffFor, retentionMode } from "@/lib/retention";
import { runRetention } from "@/lib/retention-server";

const now = new Date("2026-11-12T12:00:00Z");
const deletes = () => fake.executed.filter((s) => s.trim().startsWith("delete") && !s.includes("program_setting"));

beforeEach(() => {
  fake.executed.length = 0;
  fake.params.length = 0;
  fake.lockFree = true;
  fake.failOn = null;
  fake.eligible = 3;
  fake.rowCount = 3;
});

describe("retention rules", () => {
  it("only expired-token rules may ever delete automatically", () => {
    expect(RETENTION_RULES.filter((r) => r.enforce).map((r) => r.id).sort()).toEqual([
      "expired_password_reset_tokens",
      "expired_verification_tokens",
    ]);
  });
  it("the audit log is never enforceable and explains why", () => {
    const audit = RETENTION_RULES.find((r) => r.id === "audit_event_hot")!;
    expect(audit.enforce).toBe(false);
    expect(audit.blockedBy).toMatch(/Row Level Security/);
  });
  it("every report-only rule says what is blocking it", () => {
    for (const r of RETENTION_RULES.filter((x) => !x.enforce)) expect(r.blockedBy, r.id).toBeTruthy();
  });
  it("mode is report unless explicitly enforce; cutoffs are exact", () => {
    expect(retentionMode(undefined)).toBe("report");
    expect(retentionMode("yes")).toBe("report");
    expect(retentionMode("ENFORCE")).toBe("enforce");
    expect(cutoffFor({ days: 1 }, now).toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});

describe("runRetention", () => {
  it("report mode counts every rule and deletes nothing", async () => {
    const r = await runRetention({ now, mode: "report" });
    expect(r.results).toHaveLength(RETENTION_RULES.length);
    expect(r.results.every((x) => x.deleted === 0 && x.eligible === 3)).toBe(true);
    expect(deletes()).toEqual([]);
  });

  it("enforce mode deletes only the approved token tables, in bounded batches", async () => {
    const r = await runRetention({ now, mode: "enforce" });
    const d = deletes();
    expect(d.length).toBe(2);
    expect(d.every((s) => /verification_token|password_reset_token/.test(s))).toBe(true);
    expect(d.every((s) => /limit \$\d+/.test(s))).toBe(true);
    expect(r.results.filter((x) => x.deleted > 0).map((x) => x.id).sort()).toEqual([
      "expired_password_reset_tokens",
      "expired_verification_tokens",
    ]);
  });

  it("never deletes audit events, meeting logs or matches, even in enforce mode", async () => {
    await runRetention({ now, mode: "enforce" });
    for (const s of deletes()) expect(s).not.toMatch(/audit_event|meeting_log|"match"|"user"|intervention/);
  });

  it("only counts ended mentorships and skips people under a legal hold", async () => {
    await runRetention({ now, mode: "report" });
    const logCount = fake.executed.find((s) => s.includes("from \"meeting_log\""))!;
    expect(logCount).toMatch(/m\.status <> 'active'/);
    expect(logCount).toMatch(/retention_hold/);
  });

  it("skips entirely when another run holds the lock", async () => {
    fake.lockFree = false;
    const r = await runRetention({ now, mode: "enforce" });
    expect(r.skipped).toBe("locked");
    expect(deletes()).toEqual([]);
  });

  it("a failing rule is reported and the others still run", async () => {
    fake.failOn = "mentor_application";
    const r = await runRetention({ now, mode: "report" });
    expect(r.results.find((x) => x.id === "mentor_application")?.error).toBe("boom");
    expect(r.results.filter((x) => !x.error)).toHaveLength(RETENTION_RULES.length - 1);
  });

  it("stops batching once a batch comes back short", async () => {
    fake.rowCount = 500; // full batches until the cap
    const r = await runRetention({ now, mode: "enforce" });
    const tokens = r.results.find((x) => x.id === "expired_verification_tokens")!;
    expect(tokens.deleted).toBe(500 * 20); // MAX_BATCHES_PER_RULE caps a run
  });
});

