# Business Continuity Plan — BYUI CAN Mentor Connect

> **Owner:** Gabriel Dilworth (Program Owner / Developer)
> **Escalation:** BYUI CAN head admin → BYU-Idaho IT Security
> **Documented:** 2026-07-01 · **First annual test due:** 2027-Q3 (tabletop)
> **Related:** [incident-response.md](./incident-response.md), [retention-policy.md](./retention-policy.md), [restore-tests/](./restore-tests/)

## Service model

The application is a hosted SaaS with no self-managed servers. Continuity
is built on managed-provider redundancy plus documented recovery paths:

| Layer | Provider | Continuity mechanism |
|-------|----------|----------------------|
| App runtime | Vercel | Immutable deployments; one-click rollback to any prior deployment |
| Database | Neon Postgres | Point-in-time restore (7-day window on current tier); branch-based restore testing |
| Email | Resend | Stateless — outage delays mail but loses no data |
| Rate limiting | Upstash Redis | Fail-open by design: an outage disables throttling, never the app |
| Source + config | GitHub + Vercel env vars | Full rebuild possible from repo + env inventory |

## Recovery objectives

- **RPO (data):** ≤ 24 hours (Neon PITR granularity is effectively minutes;
  24h is the committed worst case).
- **RTO (app):** ≤ 4 hours for provider-level failures (rollback or
  redeploy); ≤ 1 business day for database restore scenarios.

## Scenarios and procedures

### 1. Bad deployment / app regression
Vercel dashboard → Deployments → promote the last known-good deployment.
Verified capability: production has been redeployed multiple times with
zero downtime (most recently 2026-07-01).

### 2. Database corruption or bad migration
Neon console → Restore: create a branch from a pre-incident timestamp,
validate row counts, then promote. This exact procedure was executed as a
drill on 2026-06-30 — see
[restore-tests/2026-Q3-restore-test.md](./restore-tests/2026-Q3-restore-test.md).
Restore drills repeat quarterly.

### 3. Credential compromise
Full rotation runbook exercised for real on 2026-07-01: Auth.js secret,
cron secret, both Postgres role passwords, Resend API key, and Upstash
credentials rotated with zero data loss and ~1 minute of rate-limiter
downtime. Session invalidation (AUTH_SECRET rotation) is the accepted
side effect.

### 4. Provider outage (Vercel / Neon / Resend / Upstash)
No action can shorten a provider outage; the plan is containment:
Upstash and Resend degrade gracefully (open rate limits, delayed email).
A Vercel or Neon regional outage takes the app down until the provider
recovers — accepted risk for an internal tool; status pages are monitored
(vercel-status.com, neonstatus.com).

### 5. Operator unavailability (single-owner risk)
The known weakest point of the current model. Mitigations in place:
- The CAN **head admin** holds in-app admin control (user management,
  matching, audit access) independent of the developer.
- All infrastructure is reconstructable from the GitHub repository plus
  the Vercel environment-variable inventory; no knowledge exists only in
  the operator's head that is required for day-to-day operation.
- End-of-service: data export/deletion procedures are documented in the
  retention policy and can be executed by any operator BYU-Idaho
  authorizes with database access.

**Open item:** name and onboard a technical successor (target: before any
expansion beyond the current program scope).

## Test schedule

| Exercise | Cadence | Last run | Next due |
|----------|---------|----------|----------|
| Database restore drill | Quarterly | 2026-06-30 | 2026-Q4 |
| Deployment rollback | Continuous (every deploy is a rollback candidate) | 2026-07-01 | — |
| Credential rotation | Annual or on suspicion of exposure | 2026-07-01 | 2027-Q3 |
| Full BCP tabletop (all scenarios, with head admin) | Annual | — (first cycle) | 2027-Q3 |

## Review

Re-review this document annually, on any provider change, or when the
program's scope changes. Reviewed: 2026-07-01.
