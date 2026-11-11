# Mentor waitlist + pledge for everyone (2026-11-11)

Requested by Gabriel after client review of PR #58.

## Pledge
- Admins are **not** exempt. Everyone signs the 3-2-1 pledge once:
  members/mentors after onboarding, admins on next visit (even if never onboarded).

## Existing members find a mentor
- After signing the pledge, any plain member (not mentor, not admin) continues to
  `/choose-mentor`. Members who already have a mentor or a pending request are sent on to the dashboard.
- If mentors have room they pick one to continue (same as new sign-ups).

## No mentor available
- If no mentor has an open spot, the member is told so, is put on the waitlist
  (`user.mentor_waitlisted_at`), and keeps using the app.
- When a mentor **in the member's major** (same school) has an open spot, the member gets an
  email linking to `/choose-mentor` and a dashboard card. `mentor_wait_notified_at` throttles emails to
  one per 7 days.
- Checked when: a mentor application is approved, an admin makes someone a mentor,
  an admin ends a match, and daily in the inactivity cron (covers everything else).
- Members who have an active match or a pending request are never notified.
- Admins can still match waitlisted members by hand (existing matchmaker).
