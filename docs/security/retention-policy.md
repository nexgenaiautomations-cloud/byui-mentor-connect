# Data Retention Policy — BYUI CAN Mentor Connect

> Records what we keep, for how long, and why. Reviewers (SOC 2, HECVAT,
> BYU-Idaho IT Security) expect explicit retention rules in writing.

## Summary

| Category | Retention | Rationale |
|----------|-----------|-----------|
| **Audit log** (`audit_event`) | 365 days hot in Postgres; archive offline indefinitely | Forensic + SOC 2 Type 2 observation evidence |
| **Active user profiles** (`user`) | Lifetime of program participation + 1 year inactive | Program records, mentorship continuity |
| **Inactive accounts** (no sign-in for 24 months) | Reviewed quarterly; archived after notice | Reduces breach surface |
| **Meeting logs** (`meeting_log`) | Lifetime of match + 2 years post-match | Career-development longitudinal record |
| **Match records** (`match`) | Lifetime + indefinite | Anonymized analytics value |
| **Mentor applications** (`mentor_application`) | Lifetime + 3 years | Program improvement, decision provenance |
| **Verification tokens** (`verification_token`, `password_reset_token`) | TTL only (24h / 1h); cleaned on use | Security; longer retention adds no value |
| **Session JWTs** | 14-day TTL (JWT-encoded, not stored server-side) | Reduces stolen-session window |
| **Vercel deployment logs** | Vercel platform retention (~30 days) | Operational debugging |
| **Vercel runtime logs** | Vercel platform retention (~3 days for free, longer paid) | Incident response |
| **Neon point-in-time backups** | Neon plan tier (7 days free; longer on paid) | Disaster recovery |
| **Resend email send logs** | Resend platform retention (~30 days) | Deliverability troubleshooting |
| **Upstash rate-limit counters** | Sliding window (1 min — 1 hr depending on key) | Abuse mitigation; no longer-term value |

## Audit log specifically

The `audit_event` table is the most retention-sensitive surface because it
contains the forensic record of admin and security activity. Rules:

1. **Hot retention**: 365 days in the production Postgres database.
2. **Archive**: At the start of each calendar quarter, export rows older
   than 365 days to a dated CSV (`audit-archive-YYYY-Q.csv`), stored in
   the program's institutional document store with admin-only access.
3. **Permanent deletion**: No rows are deleted from the active table or
   archive without head-admin approval and a documented reason.
4. **Append-only enforcement**: Postgres Row-Level Security on
   `audit_event` blocks `UPDATE` and `DELETE` at the DB layer (see
   `scripts/apply-rls.ts`). Retention archival must therefore happen via
   `SELECT INTO` to a CSV / external store; rows then expire naturally
   from hot storage via the cron once it's implemented (see TODO below).

### TODO — automated archival job

Currently archival is manual. A scheduled job that exports
`created_at < now() - interval '365 days'` rows to S3 / Vercel Blob and
records the archive run in a second-tier table is a future hardening
item. Until that lands, the head admin does this quarterly.

## Right-to-deletion (user-initiated)

If a BYU-Idaho student requests their data be deleted (FERPA / institutional
policy / personal request):

1. **Verify** the request comes from the account owner (BYU-Idaho email auth
   on the request channel, or face-to-face with ID).
2. **Approve** via head admin.
3. **Execute**: `npx tsx scripts/delete-user.ts <email>` (dry-run first,
   then `--apply`).
4. **Audit**: Script automatically writes an `ADMIN_DELETED_USER` row.
5. **Confirm** to the requester within 14 days.

Note: deletion does **not** remove the user's row from prior audit-log
entries — those rows reference the user by ID and get the FK set to
`NULL` on delete (per the `audit_event.actor_user_id ON DELETE SET NULL`
constraint). The user's actions are preserved as anonymous audit history.
This is the correct posture: audit logs are evidence and may not be
tampered with even on a deletion request.

## Cleanup scripts

Two destructive scripts exist; both write an audit row when run:

- `scripts/delete-user.ts <email> [--dry-run]` — one user, cascade delete
- `scripts/cleanup-accounts.ts [--apply]` — bulk wipe except keep-list

Neither is wired to a cron. They run from an operator shell on demand.

## Last reviewed

2026-06-30. Re-review when (a) the program changes scope, (b) BYU-Idaho IT
Security issues new institutional retention guidance, or (c) at least
annually.
