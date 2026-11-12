# Mentorship accountability, career outcomes & program analytics

Status: in build on `feat/accountability-upgrade` (2026-11-12).
Migration: `scripts/migrate-2026-11-accountability.ts` (additive, idempotent).

## 1. Event classification (`meeting_log.event_kind`)

`meeting_log` keeps its name and every column. A new `event_kind` column says
what a row actually is:

| kind | meaning | counts as mentor engagement? |
|------|---------|------------------------------|
| `mentor_meeting` | a mentor and mentee actually met | yes (meeting + interaction) |
| `touchpoint` | call / message / quick check-in between the pair | yes (interaction only) |
| `independent_activity` | student did something on their own | no |
| `system_event` | auto "goal completed" logs, achievements | no |
| `unverified` | legacy row we cannot classify honestly | no |

New rows always get an explicit kind:
- Mentor form ("Log a Meeting"): mentor picks *Meeting* (default) or *Touchpoint*.
- Member form ("Log an Activity"): *On my own* (default) — or, when the member
  has a mentor, *Met with my mentor* / *Quick touchpoint with my mentor*.
- Auto-logs: `system_event`.

Legacy backfill (only rows where `event_kind IS NULL`):
1. `is_system_generated` or `created_by = 'system'` → `system_event`
2. `created_by IN ('mentor','admin')` and `match_id` set → `mentor_meeting`
   (the mentor form has always been "Log a Meeting" for a specific mentee)
3. `created_by = 'mentee'` and no `match_id` → `independent_activity`
4. `created_by = 'mentee'` with a `match_id` and `meeting_type = 'other'` →
   `independent_activity` (the self-log default; no evidence of a meeting)
5. everything else → `unverified` (never invented as a meeting)

Confirmation: `mentor_confirmed` / `mentee_confirmed`. The logger's side is set
automatically; the other participant can confirm from My Mentors / My Mentees.
A meeting is **recorded** when logged and **verified** when both confirmed.

Action items: `action_items_done_at` lets the student mark a meeting's action
items complete (feeds "stalled actions" risk and ROI follow-ups completed).

## 2. Match timestamps

| column | updated by |
|--------|------------|
| `first_meeting_at` | first `mentor_meeting` |
| `last_meeting_at` | `mentor_meeting` |
| `last_interaction_at` | `mentor_meeting`, `touchpoint` |
| `last_student_activity_at` | `independent_activity` from the mentee |
| `last_activity_at` (legacy) | meetings, touchpoints, monthly check-ins — **no longer** independent activity |

Inactivity UI, reminders, risk detection and retention use
`coalesce(last_interaction_at, started_at)`. Recomputed from logs (not
incremented) on create / edit / delete, so edits can't drift it. The 180-day
auto-disconnect keeps reading `last_activity_at`; existing values are not
rewritten.

## 3. Notifications

Tables: `notification_preference`, `scheduled_meeting`, `notification_delivery`,
`program_setting`.

- `NOTIFICATIONS_MODE` = `off` (default) | `dry_run` | `live`. `dry_run` records
  what *would* send in `notification_delivery` (status `dry_run`) without
  calling Resend. Deploying the code sends nothing until this is set to `live`.
- Backlog guard: the first live run stores `notifications_live_since`. An
  inactivity threshold only fires if it was crossed *after* that instant, so
  enabling never blasts existing stale pairs.
- Idempotency: each notification has a deterministic `dedupe_key` with a unique
  index; the job claims it with `INSERT … ON CONFLICT DO NOTHING` before
  sending. Failed sends retry up to 3 attempts on later runs.
- Caps: `NOTIFICATIONS_MAX_PER_RUN` (default 50); max 3 notifications per user
  per rolling 24h; inactivity nudges at most once per threshold per gap.
- Opt-outs per category in Settings. Emails carry no notes, ratings or action
  item text — only "you have something to do in ICAN" plus a plain link.
- Cron `/api/cron/reminders` hourly (`0 * * * *`, Vercel Pro), same
  `CRON_SECRET` bearer check as the existing job.

Reminder kinds:
- `meeting_24h` — between 24h and start (date-only: the day before, from 9am
  in the scheduler's timezone).
- `meeting_1h` — only when a time was given.
- `log_followup` — meeting time passed (+2h; date-only: next day 9am) with no
  meeting/touchpoint logged for that match → ask the mentor to log it.
  7 days later with still nothing → scheduled meeting marked `missed`.
- `confirm_meeting` — the other participant is asked to confirm a logged meeting.
- `action_items` — student reminded of action items 3 days after the meeting if
  not marked done.
- `inactivity_first_meeting` (7d, no meeting yet), `inactivity_checkin` (14d),
  `inactivity_concern` (30d) — to both participants. 60d opens an
  intervention case (no email blast to admins).

Thresholds live in `program_setting` per school (`*` = default) and are
editable on the Intervention Center settings panel.

## 4. Career pipeline

`career_milestone` rows: stage (`exploring`, `preparing`, `applying`,
`interviewing`, `offer_received`, `offer_accepted`, `started`),
`opportunity_type` (`internship` | `part_time` | `full_time`), optional
field/employer/title/date, `source` (`self_reported` | `activity_log` |
`admin`), `verification` (`self_reported` | `verified`).

- Existing offer accomplishments (`internship_offer`, `part_time_offer`,
  `full_time_offer`) create one `offer_received` milestone per log per type
  (unique on `source_log_id, opportunity_type`) — backfilled once, never
  double-counted. Editing / deleting the log removes its derived milestone.
- Offers are counted as distinct milestones; accepting an offer links back to
  it (`related_milestone_id`) so it is not counted as a second offer.
- No salary or other financial data is collected.
- Admins may mark a milestone verified; reports always split self-reported vs
  verified.

## 5. Intervention Center

`intervention` (one open case per match, partial unique index) +
`intervention_event` (append-only trail). Risk reasons:
`no_first_meeting`, `interaction_gap`, `missed_meeting`,
`unanswered_reminders`, `low_satisfaction`, `stalled_actions`.
Statuses `new → reviewing → contacted → awaiting_response → resolved | closed`
(any open status may move to any other; closed/resolved can reopen to
`reviewing`). Outreach recorded within 48h by another admin returns 409 unless
the admin confirms. Mentoring notes and feedback answers are never shown —
only the rating band.

Access: school admins see their school's cases; platform admins see all.
Assignment targets: admins or executive mentors of the same school.

## 6. Analytics

Charts (2026-11-12 redesign) follow these rules:

- **Chart types:** heatmaps for group × time, smooth line/area trends for time series, horizontal bars only for direct comparisons, no donut or pie charts.
- **Components:** shadcn/ui chart primitives on Recharts 3.8 (`src/components/ui/chart.tsx`, `src/components/analytics-charts.tsx`). Pages aggregate on the server (`src/lib/analytics-series.ts`), so only small series reach the browser.

`src/lib/effectiveness.ts` (pure, unit-tested) + `effectiveness-server.ts`
(scoped loader). Pages: `/admin/effectiveness` (Program Effectiveness),
`/admin/executive`, `/admin/roi`. Definitions:

- First meeting within 7/14/30d: denominator = matches started in the cohort
  month that are at least N days old; numerator = those whose
  `first_meeting_at - started_at <= N days`. Immature cohorts shown as "—".
- Retention at 30/60/90d: matches at least N days old where an interaction
  happened in the window (N-30, N] days after start. Separate from
  `status = 'active'`.
- Groups smaller than 5 students are suppressed (`k = 5`) on every breakdown.
- Funnel counts **unique students** who ever reached each stage; event counts
  shown separately.
- Outcome comparisons are labelled as descriptive associations; suppressed
  when either group has < 5 students.
- ROI: tracked numbers vs modeled estimates in separate columns; every dollar
  figure shows its assumptions.

## 7. School scoping

A school is the domain of the user's verified email (`school-scope.ts`).
Users can't change their email in the app, and sign-up is limited to
registered school domains.

- **One boundary everywhere:** `src/lib/admin-scope.ts` and `admin-scope-server.ts` cover every admin page, API, export and analytics query, old and new. Program admins see only their school. Platform admins (`PLATFORM_ADMIN_EMAILS`, checked server-side) may choose a school; a school sent by any other client is ignored.
- **Out-of-scope records** answer 404, exactly like missing ones, and the attempt is audited.
- **Audit events** belong to a school through their actor or target. Anonymous security events are platform-only.
- **Member-facing:** the pod leaderboard, mentor search, requests and the waitlist are same-school only.
- **Tests:** `tests/unit/school-isolation.test.ts` (negative tests), plus the cross-school browser check in `tests/e2e/roles.spec.ts`.

## 8. Voice dictation

Client-only Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
Starts only on a button press, no audio stored, text lands in the editable
textarea. A notice explains that some browsers (Chrome, Safari) send speech to
the vendor's servers for recognition. Unsupported browsers show the plain text
box with a short explanation. Keyword-based checkbox **suggestions** — the user
must click to apply each.
