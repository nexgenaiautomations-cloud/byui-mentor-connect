# Incident Response Runbook — BYUI CAN Mentor Connect

> One-page operational runbook for handling security incidents. Optimized for
> a small team running on managed infrastructure. Keep this short — long
> runbooks don't get read mid-incident.

## Severity tiers

| Severity | Examples | Initial response time |
|---------|----------|-----------------------|
| **SEV-1** — Active compromise / data exposure | Confirmed unauthorized account access, exposed PII, leaked DB credentials, ransomware-style activity on infra | Immediate (< 30 min) |
| **SEV-2** — Suspected compromise / repeated abuse | Brute-force pattern hitting a single account, anomalous admin action, multiple `UNAUTHORIZED_ADMIN_ATTEMPT` rows from one IP/user | Same business day (< 4 hr) |
| **SEV-3** — Low-impact anomaly | Single failed sign-in surge, isolated CSP violation, rate-limit fire from an unfamiliar IP | Same week (< 5 business days) |

## On-call contact tree

1. **Primary**: Head Admin (`harrelld@byui.edu`)
2. **Engineering**: Project owner (`gabrieldilworth32@gmail.com`)
3. **Escalation**: BYU-Idaho IT Security (route through institution-side contact)

The head admin coordinates. Engineering executes containment. BYU-Idaho IT
is looped in for any incident involving credentials, FERPA-adjacent data,
or institutional reputation.

## Standard response steps

For SEV-1 or SEV-2:

### 1. Contain (first 30 minutes)

Pick the smallest action that stops the bleeding:

- **Suspected compromised admin account** → Demote via `/admin/admins`, then revoke session by signing out from a fresh browser, then rotate credentials. Audit row: `ADMIN_DEMOTED_USER`.
- **Suspected compromised member account** → Run `npx tsx scripts/delete-user.ts <email> --dry-run`, review the cascade preview, then `--apply` if appropriate. Or temporarily mark `emailVerified=null` via Neon SQL to block sign-in without destroying data.
- **Active credential leak in code** → Force-rotate the affected env var in Vercel, push an empty commit to trigger a fresh deploy. For `DATABASE_URL`: rotate the Neon connection string via the Neon dashboard, update Vercel, redeploy.
- **DDoS / runaway traffic** → Tighten Upstash rate limits temporarily (smaller window, lower allowance), push, redeploy.

### 2. Preserve evidence

Before doing anything destructive:

```sql
-- Snapshot the audit log around the incident window
SELECT * FROM audit_event
 WHERE created_at BETWEEN '<start>' AND '<end>'
 ORDER BY created_at DESC;
```

Export from `/admin/audit` to CSV (right-click → Save Page As works) or run
the SQL above via Neon dashboard. Save Vercel runtime logs from the same
window via the Vercel dashboard.

### 3. Notify

- SEV-1: Email primary + engineering + BYU-Idaho IT Security within 1 hour of confirmation. If FERPA-protected data is exposed, BYU-Idaho's privacy office must be looped in per institutional policy.
- SEV-2: Email primary + engineering within 24 hours.
- SEV-3: Note in the incident log; no immediate notification required.

### 4. Remediate

Apply the permanent fix. Code change → PR → review → deploy. Schema
change → migration → `db:push` → `db:apply-rls`.

### 5. Close

Write a one-paragraph closure note in the incident log:
- What happened (1 sentence)
- What we did (1 sentence)
- Why it won't happen the same way again (1 sentence)
- Owner + date

## Where to look first

Common starting points by symptom:

| Symptom | First place to check |
|---------|---------------------|
| Unfamiliar admin action | `/admin/audit` filtered by `eventType=ADMIN_*` |
| Account I don't recognize | `/admin/members`; cross-check `created_at` against the audit log |
| Repeated sign-in failures | `/admin/audit?eventType=LOGIN_FAILED` + `?eventType=RATE_LIMIT_TRIGGERED` |
| App slow / down | Vercel deployments tab → recent deploys; Neon dashboard → operations log |
| Email not arriving | Resend dashboard → message log; verify sender domain auth + BYUI inbound filter |

## Incident log

Maintain a running CSV at `docs/security/incident-log.csv` (or a Neon table
once one exists) with columns: `incident_id`, `opened_at`, `severity`,
`summary`, `closed_at`, `closure_note`, `owner`. Auditors will ask for
this during any future SOC 2 Type 2 observation period.

## Drill cadence

- **Quarterly**: walk through this runbook against one simulated SEV-2 scenario (use ChatGPT to generate a plausible attacker scenario, work through containment + evidence steps, write a closure note).
- **After every real incident**: revisit this document and update the affected section. The runbook only stays useful if it reflects the last real incident.

## Last reviewed

2026-06-30. Re-review at least every six months.
