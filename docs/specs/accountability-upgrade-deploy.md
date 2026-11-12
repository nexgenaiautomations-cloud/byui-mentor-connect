# Deploy checklist — accountability upgrade

Branch `feat/accountability-upgrade`. Nothing here has been run against
production. Do the steps in order.

## 1. Before merging

- [ ] Review the PR. Check the copy on the log form ("Who was involved?") and
      in `src/lib/notification-email.ts` with the program lead.
- [ ] Confirm the event-kind backfill rules in
      `docs/specs/accountability-upgrade.md` §1. Legacy mentee self-logs
      attached to a match with a meeting type of video, phone or in person
      become `unverified`, not meetings.

## 2. Database (production, needs approval)

The migration is additive and idempotent. It drops nothing, renames
nothing, and never rewrites `match.last_activity_at`.

```bash
# preview: prints every statement, writes nothing
DRY_RUN=1 npx tsx scripts/migrate-2026-11-accountability.ts
# apply (uses DATABASE_URL_OWNER)
npx tsx scripts/migrate-2026-11-accountability.ts
```

- [ ] Take a Neon snapshot or note the restore point first.
- [ ] Run the migration **before** the new code deploys. The new code reads
      the new columns.
- [ ] Check the printed `meeting_log by event_kind` summary looks right.
      On the 2026-11-12 copy it was 5 `mentor_meeting`, 26
      `independent_activity` and 8 `system_event`, plus 13 offer milestones.

## 3. Vercel environment

- [ ] `NOTIFICATIONS_MODE` — leave **unset** (off) for the first deploy.
- [ ] `NOTIFICATIONS_MAX_PER_RUN` — optional, defaults to 50.
- [ ] `CRON_SECRET`, `AUTH_RESEND_KEY`, `EMAIL_FROM`, `AUTH_URL` — already
      set; the new hourly job reuses them.
- [ ] `vercel.json` adds `/api/cron/reminders` hourly (`0 * * * *`). The
      team is on the Pro plan, so hourly crons are allowed.

## 4. Turn reminders on gradually

1. Deploy with notifications off. The hourly job only updates
   scheduled-meeting status (completed or missed).
2. Set `NOTIFICATIONS_MODE=dry_run` and redeploy. After a day, inspect:
   ```sql
   select kind, status, count(*) from notification_delivery group by 1,2;
   ```
3. Set `NOTIFICATIONS_MODE=live`. The first live (or dry-run) run stores
   `program_setting('*','notifications_live_since')`. Inactivity nudges only
   go out for thresholds crossed after that moment, so existing quiet pairs
   are not emailed all at once.
   - Rows recorded during dry run keep their dedupe keys and will not be
     re-sent live.
   - To roll back, set the mode back to `off`. Takes effect on the next run.

## 5. Resend

- [ ] No new domain is needed. Emails go out from the existing `EMAIL_FROM`.
- [ ] Optional: add a Resend webhook later for bounces. Delivery failures are
      already logged in `notification_delivery.last_error` and retried up
      to 3 times.

## 6. After deploy

- [ ] Open `/admin/interventions` and press **Run risk check now**. On the
      copied data, 4 of 6 active pairs opened cases.
- [ ] Review the thresholds panel on the same page.
- [ ] Spot-check `/admin/analytics/executive`. Meeting counts will fall
      compared with the old Analytics page; that is the fix, not a
      regression.

## Known limits / follow-ups

- The older admin pages (Members, Matches, Meetings, Activity, Reports,
  Analytics → Activity) are still not school-scoped. Everything added in this
  upgrade is school-scoped.
- `tests/e2e/demo-login.spec.ts` uses "Sign in as …" buttons that no longer
  exist. It was already stale before this branch.
