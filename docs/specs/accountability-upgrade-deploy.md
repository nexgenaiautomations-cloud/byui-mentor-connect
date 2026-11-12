# Deploy checklist — accountability upgrade (PR #59)

Branch `feat/accountability-upgrade`. **Nothing here has been run against
production.** Each step marked *(approval)* needs an explicit go-ahead.

## 0. Verified on disposable Neon branches (2026-11-12)

**Migration**, run twice on a fresh copy of production (`dev/migration-verify`):

| Check | Result |
|-------|--------|
| Existing row counts (user 75, match 6, request 14, meeting_log 39, achievement 166, audit_event 1945, …) | Unchanged after both runs |
| Report inputs, achievements, `match.last_activity_at`/status | Byte-identical (md5 fingerprints) |
| Classification | mentor_meeting 5 · independent_activity 26 · system_event 8 · unverified 0 |
| Career milestones | 13 created, 13 distinct (log, type); second run created 0 |
| Broken log→match references | 0 |
| Matches whose `last_interaction_at` disagrees with their logs | 0 |
| Indexes, audit enum values, `app_user` grants | Present / correct |

- The 14th `industry_experiences` log is a mentor's "Helped apply to an internship". It is correctly not counted as an offer.
- `retention_hold` is read-only for `app_user`. This was fixed after the verification showed default privileges granting write access.

**Reminders:** `scripts/verify-notification-safety.ts` ran against the real job, all 11 checks passing:

- `off` sends nothing. `dry_run` records but sends nothing, and reports per-kind counts.
- Each event is reminded once.
- Rescheduled meetings get fresh reminders.
- No reminders for cancelled meetings, and no follow-up for completed ones.
- Removed accounts — and their partners, for that pair — get nothing.
- A stale pending row isn't duplicated.
- Pairs that went quiet before go-live are never emailed.

**Delivery state machine:** unit tested. A crash after Resend accepts a message but before ICAN records it won't re-send, because each send carries `Idempotency-Key` = dedupe key (Resend ignores repeats within 24h).

## 1. Before merging

- [ ] Review PR #59; CI must be green: lint, typecheck, unit tests, build.
- [ ] Run Playwright locally against a seeded disposable branch (`tests/e2e/README.md`).
- [ ] **Preview deployments:** confirm which database the Vercel *Preview* `DATABASE_URL` points to. If it is production, either restrict preview access or point previews at a Neon branch before anyone uses this PR's preview. New code on the old schema will error, and any use writes production data. Previews don't run crons and have no Resend key.

## 2. Production migration *(approval)*

Additive and idempotent: no drops, no renames, never rewrites `last_activity_at`.

```bash
DRY_RUN=1 npx tsx scripts/migrate-2026-11-accountability.ts   # prints statements, writes nothing
npx tsx scripts/migrate-2026-11-accountability.ts             # uses DATABASE_URL_OWNER
```

- [ ] Create a Neon snapshot (or note the restore LSN) right before.
- [ ] Run the migration **before** deploying the code.
- [ ] Compare the printed `event_kind` summary with section 0.

## 3. Deploy with notifications off *(approval)*

- `NOTIFICATIONS_MODE`: **unset**. Reminders only update scheduled-meeting status.
- `RETENTION_MODE`: **unset**. The weekly job only reports.
- Crons (Vercel Pro):
  - `/api/cron/inactivity`: daily 09:00 UTC (now also runs the risk check).
  - `/api/cron/reminders`: hourly.
  - `/api/cron/retention`: Mondays 11:00 UTC.
- [ ] Check the app: sign in per role, `/admin/interventions`, the analytics tabs, and a CSV export.

## 4. Dry run, then live

1. *(approval)* Set `NOTIFICATIONS_MODE=dry_run` and redeploy. Env changes need a redeploy.
2. After a day, review who would have been emailed:

   ```sql
   select kind, status, count(*), count(distinct user_id) people
   from notification_delivery group by 1,2 order by 1,2;
   ```

   The hourly cron response also carries `candidatesByKind`.
3. *(explicit approval)* Set `NOTIFICATIONS_MODE=live` and redeploy.
   - The first live run stores `notifications_live_since`. Gaps that started before then are never emailed.
   - Rows recorded during dry run keep their keys, so those events are not re-sent live.

## 5. Rollback

| Situation | Action | Data impact |
|-----------|--------|-------------|
| Too many / wrong emails | Unset `NOTIFICATIONS_MODE`, redeploy (~2 min). Already-sent rows stay. | None |
| App bug | Vercel → promote the previous production deployment (instant). | Schema stays. The old code ignores the new columns and tables. |
| Re-deploying the new code after a rollback | Re-run the migration. It classifies any rows the old code wrote (`event_kind IS NULL`) using the legacy rules. | None |
| Schema must go | *(approval)* Restore the pre-migration snapshot, **or** drop the new tables/columns by hand. Dropping loses data written since deploy. | Destructive |

The migration only adds things, so rolling the app back never requires a database rollback.

## 6. Known limits / follow-ups

- **Pods:** pods are shared by major name across schools. Pod *names* are visible to every school; members and points are now school-scoped. Admins create pods globally.
- **Orphaned issue reports:** reports from deleted accounts have no school, so only platform admins (`PLATFORM_ADMIN_EMAILS`) see them.
- **Retention:** only expired tokens are deleted automatically, and only with `RETENTION_MODE=enforce`. Every other period needs institutional approval (see `docs/security/retention-policy.md`).
- **Neon branches** to delete after review *(approval)*: `dev/accountability-upgrade` and `dev/migration-verify`.
