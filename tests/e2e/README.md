# Browser tests (Playwright)

Two ways to run them. Neither can touch production student records or send
real email.

## 1. Full suite against an isolated database (default)

Use a disposable database, such as a Neon branch, with the app migrations
applied (including `scripts/migrate-2026-11-accountability.ts`).

```bash
export E2E_DATABASE_URL='postgresql://…'        # the disposable branch
export E2E_PASSWORD='a-long-random-password'   # fixture accounts' password

# 1) seed fixture accounts (two synthetic schools: e2e-alpha.edu, e2e-beta.edu)
npx tsx scripts/seed-e2e.ts --confirm=<host of E2E_DATABASE_URL>

# 2) run (Playwright starts `next dev` on :3100 against that database)
npm run test:e2e
```

What keeps this safe:

- **Seeding:** `seed-e2e.ts` refuses unless `--confirm` names the target host. It also refuses the app's main database from `.env.local`.
- **Sentinel:** the global setup refuses to run unless the database carries the sentinel written by the seed script.
- **No email or reminders:**
  - Email is set to log only (`EMAIL_TRANSPORT=log`), and the Resend key is blanked.
  - Reminders are off (`NOTIFICATIONS_MODE=off`).
  - Rate limiting uses no external store.
- **Fixture-only writes:** the seed script resets fixture state on each run. Specs only change `e2e-` fixture rows.

Re-run the seed before each full run.

## 2. Read-only checks against a deployment

```bash
E2E_BASE_URL=https://preview-url.vercel.app npm run test:e2e
```

Only tests tagged `@public` run in this mode: landing, links, CSP, accessibility of public pages, and unauthenticated API checks. They never sign in, sign up or send email.

## Specs

| Spec | Covers |
|------|--------|
| `roles.spec.ts` | Sign-in per role. Members can't reach admin pages, even with a forged role cookie. School isolation. |
| `workflows.spec.ts` | Logging, dictation fallback, meeting confirmation and action items, career stage, touchpoint with a timed next meeting, risk check and outreach, CSV exports, layouts at phone/desktop. |
| `analytics.spec.ts` | Analytics tabs, URL filters, axe (WCAG 2 A/AA) on each analytics view. |
| `mobile-nav.spec.ts` | Bottom bar and drawer per role, sign-out. |
| `auth-lifecycle.spec.ts` | Sign-up → sign-out → sign-in, validation, forgot-password. Signs up on the fixture school only. |
| `a11y`, `buttons`, `csp-smoke`, `landing`, `login`, `security` | Public surface (`@public` where read-only). |
