# Data Retention Policy — BYUI CAN Mentor Connect

> Records what we keep, for how long, and why. Reviewers (SOC 2, HECVAT,
> BYU-Idaho IT Security) expect explicit retention rules in writing.

## Summary

**What is enforced automatically:** only the expiry of sign-in, email-verification and password-reset tokens. Every other period below is a policy target. The weekly retention job (`/api/cron/retention`, `src/lib/retention.ts`) **counts** eligible rows and stores the report. It does not delete them until the institution approves the period and the rule is switched to `enforce` in code.

| Category | Retention target | Enforced? | Rationale |
|----------|------------------|-----------|-----------|
| **Audit log** (`audit_event`) | 365 days hot; then archive | **No — cannot be deleted by the app** (append-only RLS). Job reports archive candidates. | Forensic + SOC 2 evidence |
| **Active user profiles** (`user`) | Program participation + 1 year after removal | Report only (`inactive_account`). Deletion is manual (`scripts/delete-user.ts`). | Program records |
| **Inactive accounts** (no sign-in for 24 months) | Reviewed quarterly | Manual review. Not tracked by the job (no last-sign-in column). | Breach surface |
| **Meeting logs** (`meeting_log`) | Match end + 2 years | Report only (`meeting_log_after_match`). **Needs institutional approval** (FERPA records schedule). | Longitudinal career record |
| **Scheduled meetings** (`scheduled_meeting`) | Match end + 2 years | Report only. Follows the meeting-log decision. | Reminder history |
| **Match records** (`match`) | Indefinite | — | Analytics |
| **Mentor applications** (`mentor_application`) | Review + 3 years | Report only. Needs approval. | Decision provenance |
| **Career milestones** (`career_milestone`) | Participation + 2 years; students can delete their own self-reported rows at any time | Report only. Needs approval. | Outcome reporting; no salary or financial data |
| **Intervention cases + trail** (`intervention`, `intervention_event`) | 3 years after the case closes | Report only. Needs program sign-off. | Staff accountability record |
| **Notification delivery log** (`notification_delivery`) | Proposed 18 months | Report only. Needs program sign-off (ROI history uses it). | Idempotency, retries, ROI counts; no email content |
| **Verification tokens** (`verification_token`, `password_reset_token`) | Until expiry (24h / 1h); deleted on use | **Yes.** The job deletes tokens 1+ day past expiry when `RETENTION_MODE=enforce`. | No value after expiry |
| **Program settings** (`program_setting`) | Until changed | — | Configuration |
| **Voice dictation** | Not stored | n/a — audio never reaches ICAN; only the text the user submits is saved | Privacy by design |
| **Session JWTs** | 14-day TTL (not stored server-side) | Yes (by design) | Stolen-session window |
| **Vercel deployment / runtime logs** | Platform retention | Vercel | Operations |
| **Neon point-in-time backups** | Plan tier | Neon | Disaster recovery |
| **Resend email send logs** | Platform retention (~30 days) | Resend | Deliverability |
| **Upstash rate-limit counters** | Sliding window | By design | Abuse mitigation |

### Retention job (operators)

- **Schedule:** `/api/cron/retention`, Mondays 11:00 UTC. Protected by `CRON_SECRET`.
- **Modes:**
  - `RETENTION_MODE` unset (default): report only.
  - `RETENTION_MODE=enforce`: deletes **only** the rules marked `enforce: true` in `src/lib/retention.ts`. Today that is expired tokens.
- **Safety:**
  - Deletes in batches of 500, at most 20 batches per rule per run.
  - One run at a time: a lease row in `program_setting`. A second concurrent run is skipped.
  - A failing rule is recorded and the others still run.
  - Never touches active matches.
- **Legal / investigation holds:** add a row to `retention_hold` (owner DB role). Held people's records are never eligible until `released_at` is set.
- **Visibility:**
  - Every run writes a `RETENTION_RUN` audit event.
  - The last report is stored at `program_setting('*','retention_last_run')`.
  - Platform admins can read it, or run a report-only pass, at `/api/admin/retention`.
- **Enforcing another rule:** first get written institutional approval for the period, then set `enforce: true` and add its batched delete in `retention-server.ts`, with tests, in a reviewed PR.

## Audit log specifically

The `audit_event` table holds the forensic record of admin and security activity.

1. **Append-only, enforced:** Postgres Row Level Security (`scripts/apply-rls.ts`) blocks `UPDATE` and `DELETE` for every role, including the table owner (`FORCE ROW LEVEL SECURITY`).
   - The application cannot delete audit rows.
   - No privileged deletion path has been added for convenience, and none should be.
2. **Hot window:** 365 days is a target.
   - The retention job reports how many rows are older (`audit_event_hot`).
   - It never deletes them.
3. **Archive:** not automated. An archive export needs approval and an encrypted, access-restricted store, and neither has been approved or configured. Until then, nothing leaves the database.
   - Once approved, the export must record a row count and a SHA-256 hash of each archive file.
   - It must be verified by re-reading the archive before anything is considered archived.
4. **Deleting archived rows** would mean temporarily changing the RLS policy. That needs head-admin approval, a documented reason and a verified archive. It is a manual, audited operation, not a cron job.

**Previously documented, not implemented:** an earlier version of this policy said audit rows would "expire naturally from hot storage via the cron". That can't happen under the RLS policy above, and no such job exists.

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

Neither is wired to a cron. They run from an operator shell on demand. The
retention job above never deletes users.

## Last reviewed

2026-11-12 (automated-vs-manual audit; retention job added). Previously
2026-06-30. Re-review when (a) the program changes scope, (b) BYU-Idaho IT
Security issues new institutional retention guidance, or (c) at least
annually.
