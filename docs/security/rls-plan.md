# Row-Level Security Plan

> **Status**: Phase 1 (audit-only) implemented. Phase 2 (per-user RLS for
> domain tables) is deliberately deferred — see Section 4 for the
> infrastructure that would have to land first.

## 1. Where authorization lives today

All access control in BYUI CAN Mentor Connect is enforced at the **application
layer**:

- `requireUser()` and `requireAdmin()` in `src/lib/session.ts` gate every
  route handler that touches non-public data.
- Domain queries are scoped by the active-role cookie or by direct
  `userId === me.id` predicates in the WHERE clause.
- Drizzle uses parameterized queries everywhere, so SQL injection is
  structurally impossible.

This is sufficient as long as **every code path** that reads or writes a
table goes through one of those gates. RLS would be defense-in-depth:
protection against a future code path that forgets to gate, against a
leaked database credential, or against a contractor who runs a `SELECT *`
ad-hoc from a database tool.

## 2. The Neon constraint

This app uses **`drizzle-orm/neon-http`** with a single Neon connection
string. Two facts follow from that choice:

1. **Every query runs as the same Postgres role** — the owner of the
   `public` schema. Per-user RLS policies that reference `current_user` or
   `session_user` cannot distinguish between "Alice" and "Bob" because
   from Postgres's perspective both queries come from the same DB role.

2. **`neon-http` runs each statement as its own HTTP request**, so each
   statement is its own transaction. The standard "set a session variable
   for the current app user, then query under an RLS policy that reads
   that variable" pattern doesn't work because the `SET LOCAL` and the
   `SELECT` end up in different transactions.

These are not Postgres limitations; they are limitations of the driver +
connection model this app picked. We picked this combo because the
neon-http driver works on Vercel's Edge runtime without a connection
pool, which matters more to us than per-record RLS today.

## 3. What we did enable: audit-log RLS policies

`scripts/apply-rls.ts` runs the following:

```sql
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE ROW LEVEL SECURITY;

-- Both policies are permissive (true) by design. Admin gating happens at
-- the application layer (requireAdmin in src/lib/session.ts).
CREATE POLICY audit_event_allow_insert ON audit_event
  FOR INSERT WITH CHECK (true);
CREATE POLICY audit_event_allow_select ON audit_event
  FOR SELECT USING (true);

-- No UPDATE policy → denied for non-BYPASSRLS roles.
-- No DELETE policy → denied for non-BYPASSRLS roles.
```

Run the script after any `npm run db:push`:

```bash
npm run db:apply-rls
```

## 4. Role separation — the runtime connection bypasses RLS no longer

Background (history): when the policies first landed, the production
`DATABASE_URL` connected as `neondb_owner`, which Neon ships with
`BYPASSRLS=true`. Per Postgres semantics, a `BYPASSRLS` role bypasses
all RLS policies including `FORCE ROW LEVEL SECURITY`. That meant the
declared policies didn't actually bind the app's own queries — they
were defense-in-depth for hypothetical future non-owner connections, but
the app credentials themselves could tamper with audit rows. `ALTER
ROLE neondb_owner NOBYPASSRLS` was refused by Neon (`neondb_owner`
lacks the `CREATEROLE` + `ADMIN` privilege to alter itself).

Resolution (2026-06-30): A second Postgres role `app_user` was created
with `NOBYPASSRLS LOGIN`, granted the CRUD permissions the runtime
actually needs (no DDL), and the production `DATABASE_URL` was swapped
to it. The original owner URL is preserved as `DATABASE_URL_OWNER` for
migrations and scripts.

### What the app role can and cannot do

| Operation | `app_user` (runtime) | `neondb_owner` (migrations) |
|-----------|----------------------|------------------------------|
| SELECT / INSERT / UPDATE / DELETE on user, match, request, meeting_log, etc. | ✓ | ✓ |
| SELECT on `audit_event` | ✓ (policy permits) | ✓ (BYPASSRLS) |
| INSERT on `audit_event` | ✓ (policy permits) | ✓ (BYPASSRLS) |
| **UPDATE on `audit_event`** | **✗ blocked by RLS — 0 rows affected** | ✓ (BYPASSRLS) |
| **DELETE on `audit_event`** | **✗ blocked by RLS — 0 rows affected** | ✓ (BYPASSRLS) |
| CREATE TABLE, ALTER TABLE, CREATE POLICY | ✗ (no DDL) | ✓ |

Empirical verification (2026-06-30): a canary INSERT-then-UPDATE-then-
DELETE cycle from the `app_user` connection succeeded on the insert,
returned **0 rows** on both UPDATE and DELETE, and the canary row was
intact when re-read. Reproducible by re-running the same SQL from any
`NOBYPASSRLS` Neon role.

### How to use the two URLs

- Application runtime (`src/db/client.ts`) reads `DATABASE_URL` — points
  at `app_user`.
- `drizzle.config.ts` and `scripts/apply-rls.ts` prefer
  `DATABASE_URL_OWNER` (then fall back to `DATABASE_URL`) — so
  `npm run db:push` and `npm run db:apply-rls` run with DDL privileges.
- One-off scripts (`scripts/cleanup-accounts.ts`,
  `scripts/delete-user.ts`) run via `tsx` and pick up
  `process.env.DATABASE_URL` — they continue to work as `app_user`
  because none of them write to `audit_event` directly (they only call
  `auditEvent()` which is an INSERT).

## 5. Application-layer protections still apply

Independent of RLS state:

- Audit-log **read** access is gated by `requireAdmin()` in
  `/admin/audit` and `/api/admin/audit-events`.
- The app never calls `UPDATE` or `DELETE` on `audit_event` from any
  route. The closest it comes is a future archival cron (not yet
  implemented).
- Drizzle parameterized queries make SQL injection structurally
  impossible.

## 6. Future: per-record RLS on user data

The per-user RLS approach for `user`, `match`, `meeting_log`, etc. is
still deferred. The recommended path is Neon Authorize +
`pg_session_jwt` — see prior revisions of this doc for the design.
Effort: ~1 week. Best fit when the program expands beyond BYUI-only or
starts handling more sensitive data categories.

## 4. What we did NOT enable, and why

The following tables hold user data that ideally would be RLS-scoped per
user:

- `user`
- `request`, `match`
- `meeting_log`, `monthly_feedback`, `achievement`
- `mentor_application`
- `password_reset_token`, `verification_token`
- `issue_report`

For these, the **strong** policy you would want is something like:

```sql
CREATE POLICY user_read_own ON "user"
  FOR SELECT USING (id = current_setting('app.user_id', true));
```

That policy can't be enforced with our current driver. To make per-user
RLS work we would need one of the following:

### Option A — Neon's `pg_session_jwt` (recommended path forward)

Neon ships an extension (`pg_session_jwt`) and a feature called Neon
Authorize that lets you pass an Auth.js / NextAuth JWT to Postgres
on every connection. The DB can then verify the JWT and read
`auth.user_id()` inside RLS policies. This is the cleanest fit because:

- It works with `drizzle-orm/neon-http` (which already speaks HTTP).
- It uses our existing JWT session strategy.
- Policies stay in plain SQL.

Effort: ~1 week. Requires enabling the extension on the Neon project,
adding the JWT public key, and rewriting any query that wants to read
across users (e.g. admin dashboards) to use a service-role connection
that bypasses RLS.

### Option B — Switch off neon-http to a pooled `pg` connection

If we use `pg` or `postgres.js` instead of neon-http we get real
transactions. We could then `SET LOCAL app.user_id = '<id>'` at the
start of every request and have RLS policies read
`current_setting('app.user_id', true)`.

Costs:
- Loses Vercel Edge compatibility for the routes that use it.
- Adds a connection-pool dependency (PgBouncer / Neon pooled endpoint)
  to keep concurrency from exhausting Postgres connections.

Not preferred — the operational cost outweighs the security benefit
for a low-traffic single-tenant app.

### Option C — Separate roles per request

In principle we could create one PG role per user and connect as that
role. In practice this is infeasible for an app with rolling sign-ups
(the role count grows unbounded, and Auth.js wouldn't manage role
creation atomically with user creation).

## 5. What we believe is safe right now

- App-layer authorization (`requireUser`, `requireAdmin`, role-scoped
  queries) is exhaustively used at every read/write path. A code audit
  has not found a gap as of the most recent review.
- `audit_event` is append-only at the database layer.
- Drizzle parameterized queries eliminate SQL injection.
- Session cookies are `httpOnly + Secure + SameSite=Lax` with
  domain-pinned naming (`__Secure-` in production).
- No application code stores raw IPs (only hashed) or raw tokens (only
  SHA-256 hashes).

## 6. Decision

**Now**: ship audit-log RLS. The protection is meaningful, the policies
are simple, and the implementation is idempotent.

**Later**: when one of the following becomes true, revisit Section 4
and pick Option A (Neon Authorize):

- The program expands beyond BYU-Idaho (multi-tenant).
- We start storing FERPA-covered records, financial data, or health
  data (anything where a database-credential leak would be an incident
  requiring disclosure under FERPA / HIPAA / state law).
- A second engineer joins and direct database access starts being a
  routine support tool — at that point the "everyone gates through
  requireAdmin" assumption starts to weaken.

## 7. How to verify the current state

After running `npm run db:apply-rls`, you can verify the audit-log
policies from `npm run db:studio` or directly with `psql`:

```sql
-- Should list audit_event_allow_insert and audit_event_allow_select only.
SELECT policyname, cmd FROM pg_policies
  WHERE tablename = 'audit_event';

-- Should fail with: ERROR: new row violates row-level security policy
-- (or similar) — confirming UPDATE is denied at the DB level.
UPDATE audit_event SET severity = 'info' WHERE id = (
  SELECT id FROM audit_event LIMIT 1
);

-- Same for DELETE.
DELETE FROM audit_event WHERE id = (
  SELECT id FROM audit_event LIMIT 1
);
```

If the UPDATE or DELETE succeeds, the RLS policy is missing or RLS is
not FORCE'd. Re-run `npm run db:apply-rls` and check the output for the
`audit_event policies on audit_event` summary.
