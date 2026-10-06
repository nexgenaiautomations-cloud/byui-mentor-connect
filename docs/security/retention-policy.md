# Data Retention Policy — BYUI CAN Mentor Connect

> Records what we keep, for how long, and why. Reviewers (SOC 2, HECVAT,
> BYU-Idaho IT Security) expect explicit retention rules in writing.
>
> **Related:** [../privacy/pseudonymization-standard.md](../privacy/pseudonymization-standard.md)
> — how exports and telemetry are de-identified ·
> [information-security-policy.md](./information-security-policy.md)

## Summary

| Category | Retention | Rationale |
|----------|-----------|-----------|
| **Audit log** (`audit_event`) | 365 days hot in Postgres; archive offline indefinitely | Forensic + SOC 2 Type 2 observation evidence |
| **Active user profiles** (`user`) | Lifetime of program participation + 1 year inactive | Program records, mentorship continuity |
| **Inactive accounts** (no sign-in for 24 months) | Reviewed quarterly; archived after notice | Reduces breach surface |
| **Meeting logs** (`meeting_log`) | Lifetime of match + 2 years post-match | Career-development longitudinal record |
| **Match records** (`match`) | Lifetime + indefinite | Pseudonymous (coded) analytics value |
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
   Run it with:

   ```
   npm run audit:archive -- --dry-run     # review the manifest first
   npm run audit:archive                  # write the CSV
   ```

   The export is **de-identified at the boundary** — opaque user IDs only,
   hashed IPs without the salt, user agents reduced to browser/OS family,
   email patterns scrubbed. See
   [../privacy/pseudonymization-standard.md](../privacy/pseudonymization-standard.md)
   §4.1 for the full rule set and the reasoning. Record the manifest the
   script prints (row count, date range, SHA-256, operator, timestamp)
   alongside the archive so its integrity can be checked later.

   The resulting file is **pseudonymous, not anonymous**: it is handled as
   restricted data, and `audit-archive-*.csv` is git-ignored so it cannot
   be committed by accident.
3. **Permanent deletion**: No rows are deleted from the active table or
   archive without head-admin approval and a documented reason. The export
   script never deletes anything.
4. **Append-only enforcement**: Postgres Row-Level Security on
   `audit_event` blocks `UPDATE` and `DELETE` at the DB layer (see
   `scripts/apply-rls.ts`). Archival is therefore export-only; rows are
   removed from hot storage only under rule 3.

### Open hardening item — scheduling

The export is scripted and repeatable but **operator-run**: the head admin
triggers it quarterly. There is no cron job, and no second-tier table
recording archive runs. Scheduling it is a future hardening item; it is
listed here rather than in a TODO comment so the manual step is visible.

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
constraint). The user's actions are preserved as audit history that no longer
points at a person. This is the correct posture: audit logs are evidence and
may not be tampered with even on a deletion request.

The residual rows are **pseudonymous, not anonymous** — the retained
`ip_hash` is still reversible by the holder of the salt. The term matters to
reviewers, so it is used precisely here and throughout
[../privacy/pseudonymization-standard.md](../privacy/pseudonymization-standard.md).

## Cleanup scripts

Two destructive scripts exist; both write an audit row when run:

- `scripts/delete-user.ts <email> [--dry-run]` — one user, cascade delete
- `scripts/cleanup-accounts.ts [--apply]` — bulk wipe except keep-list

Neither is wired to a cron. They run from an operator shell on demand.

## Last reviewed

2026-10-06 — audit-archive procedure replaced the manual TODO with a scripted,
de-identified export (`npm run audit:archive`); added the pseudonymization
standard as a related document; corrected "anonymized" to "pseudonymous"
where records remain coded. Previously reviewed 2026-06-30.

Re-review when (a) the program changes scope, (b) BYU-Idaho IT Security
issues new institutional retention guidance, or (c) at least annually.
