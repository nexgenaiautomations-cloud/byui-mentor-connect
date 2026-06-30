// Idempotent script that applies Row-Level Security to the `audit_event`
// table. Drizzle's `db:push` workflow doesn't manage policies, so this
// script is run separately after the schema has been pushed.
//
// What it does:
//   * Enables RLS on `audit_event`.
//   * FORCEs RLS so the table owner (the app's DB user, which is the only
//     role this codebase uses) is also subject to policies. Without FORCE,
//     the owner bypasses RLS entirely and the protection is moot.
//   * Adds an INSERT policy that permits every connection — the app needs
//     to append audit rows from many handlers.
//   * Adds a SELECT policy that permits every connection — the admin viewer
//     queries through the app's connection, and read-access is gated by
//     requireAdmin() at the route layer.
//   * Deliberately omits UPDATE and DELETE policies. With FORCE RLS on, the
//     absence of a policy denies the action for everyone, including the
//     table owner. Net effect: even with the app's DB credentials, neither
//     the app nor an attacker can tamper with or remove existing audit
//     rows.
//
// What it does NOT do:
//   * It does not enable RLS on user, match, request, meeting_log, or any
//     other table. See `docs/security/rls-plan.md` for why those need a
//     different approach (Neon's neon-http driver + a single shared owner
//     role cannot enforce per-user RLS without additional infrastructure).
//
// Run:
//   npx tsx scripts/apply-rls.ts
//
// Re-running is safe. Every statement uses `IF NOT EXISTS` semantics or is
// guarded with a DO block so a second run is a no-op.

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set — check .env.local");
  }
  const sql = neon(url);

  console.log("[rls] enabling RLS on audit_event…");
  await sql(`ALTER TABLE "audit_event" ENABLE ROW LEVEL SECURITY`);
  await sql(`ALTER TABLE "audit_event" FORCE ROW LEVEL SECURITY`);

  console.log("[rls] ensuring INSERT policy…");
  await sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'audit_event'
           AND policyname = 'audit_event_allow_insert'
      ) THEN
        CREATE POLICY audit_event_allow_insert
          ON "audit_event"
          FOR INSERT
          WITH CHECK (true);
      END IF;
    END$$;
  `);

  console.log("[rls] ensuring SELECT policy…");
  await sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'audit_event'
           AND policyname = 'audit_event_allow_select'
      ) THEN
        CREATE POLICY audit_event_allow_select
          ON "audit_event"
          FOR SELECT
          USING (true);
      END IF;
    END$$;
  `);

  // Sanity check: list the policies that are now in place so the operator
  // can verify UPDATE/DELETE are absent (and therefore denied).
  const policies = await sql(`
    SELECT policyname, cmd
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'audit_event'
     ORDER BY cmd, policyname
  `);

  console.log("[rls] policies on audit_event:");
  for (const row of policies as Array<{ policyname: string; cmd: string }>) {
    console.log(`  - ${row.cmd}: ${row.policyname}`);
  }
  console.log("[rls] done. UPDATE and DELETE are denied by absence of policy.");
}

main().catch((err) => {
  console.error("[rls] failed:", err);
  process.exit(1);
});
