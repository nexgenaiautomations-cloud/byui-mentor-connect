# External Config Runbook — Phase 4

> Things that can't be done from the codebase. Each is **5–60 minutes** of
> work in a vendor dashboard. Do them all once; future reviewers will check
> for evidence of these specifically.

## 1. Branch protection on `master` (GitHub) — **5 min**

Why it matters: SOC 2 CC8.1 wants evidence that code changes go through
review before reaching production. Without branch protection, anyone with
push access can land code on `master` and the git log will show it.

Steps:

1. Go to https://github.com/nexgenaiautomations-cloud/byui-mentor-connect/settings/branches
2. Click **Add branch ruleset** (or **Add rule** in classic UI).
3. Target: `master`.
4. Toggle on:
   - ✓ **Require a pull request before merging**
   - ✓ **Require approvals** → set to 1
   - ✓ **Dismiss stale approvals when new commits are pushed**
   - ✓ **Require status checks to pass before merging** → add `build` once
     a CI workflow exists; skip for now if none configured
   - ✓ **Require linear history** (optional but cleaner)
   - ✓ **Do not allow bypassing the above settings** → blocks even admins
     from force-pushing
5. Save.

Verify: try to push directly to `master` from a terminal — it should be
rejected with "protected branch hook declined".

**Note**: solo-developer projects can keep branch protection but allow the
repo owner to merge their own PR (just no direct push). The audit-friendly
log entry is "PR opened, PR merged" instead of "commit pushed directly."

## 2. Document a Neon point-in-time restore test — **30–60 min**

Why it matters: Reviewers ask "when did you last test recovery?" An untested
backup is not a backup.

Steps:

1. Note the current production timestamp (`SELECT now();` in Neon SQL editor).
2. In Neon dashboard → your project → **Branches** → **Create branch** →
   choose **From a specific point in time** → pick a timestamp 1 hour ago.
   This creates an isolated branch with no impact on production.
3. Run a sanity check on the branch:
   ```sql
   SELECT count(*) FROM "user";
   SELECT max(created_at) FROM audit_event;
   ```
   Compare counts to current production.
4. Document the test in a new file:
   `docs/security/restore-tests/2026-Q3-restore-test.md` with:
   - Date, operator name, source timestamp, recovery target.
   - Result: row counts matched / didn't match.
   - Time-to-recover (when did you start vs. when was the branch queryable).
   - Any anomalies.
5. Delete the test branch when done so you don't pay for it.
6. **Repeat quarterly.** Add a recurring calendar reminder.

## 3. Enable Dependabot (GitHub) — **5 min**

Why it matters: Reviewers check for automated dependency scanning. A
`package.json` with stale vulnerable packages is a guaranteed finding.

Steps:

1. Go to https://github.com/nexgenaiautomations-cloud/byui-mentor-connect/settings/security_analysis
2. Toggle on:
   - ✓ **Dependabot alerts**
   - ✓ **Dependabot security updates**
   - ✓ **Dependabot version updates** → opens an editor to create
     `.github/dependabot.yml`. Use this minimal config:
     ```yaml
     version: 2
     updates:
       - package-ecosystem: "npm"
         directory: "/"
         schedule:
           interval: "weekly"
         open-pull-requests-limit: 5
         labels: ["dependencies"]
     ```
3. Commit the file. Dependabot will start opening PRs for outdated /
   vulnerable packages.

## 4. Set `AUDIT_IP_HASH_SECRET` in Vercel — **2 min**

Why it matters: Without a salt, audit-log IP hashes can be brute-forced
against the IPv4 space (4 billion hashes = trivial on a GPU).

Steps:

1. Generate a secret locally:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Go to https://vercel.com/dashboard → your project → **Settings** →
   **Environment Variables**.
3. Add a new variable:
   - **Name**: `AUDIT_IP_HASH_SECRET`
   - **Value**: paste the hex string
   - **Environments**: Production, Preview, Development (all three)
4. Redeploy to pick up the new env var (push an empty commit or use
   "Redeploy" in the Vercel UI).

## 5. Run the schema + RLS push against Neon — **5 min**

Why it matters: The `audit_event` table and its append-only RLS policies
don't exist in your Neon database yet — they only exist in the schema
file. Until you run these, the application's `auditEvent()` calls will
throw "relation does not exist" and best-effort-fail silently.

Steps (from a shell with `.env.local` pointing at production `DATABASE_URL`):

```bash
cd app
npm run db:push        # creates audit_event table + enums + indexes
npm run db:apply-rls   # enables RLS, FORCEs it, allows INSERT/SELECT,
                       # denies UPDATE/DELETE — idempotent
```

Verify in Neon SQL editor:

```sql
-- Should list audit_event_allow_insert and audit_event_allow_select only.
SELECT policyname, cmd FROM pg_policies
 WHERE tablename = 'audit_event';

-- Should fail with: ERROR: new row violates row-level security policy
-- (or similar) — confirming UPDATE is denied at the DB level.
UPDATE audit_event SET severity = 'info'
 WHERE id = (SELECT id FROM audit_event LIMIT 1);
```

If the `UPDATE` succeeds, RLS didn't apply — re-run `npm run db:apply-rls`
and check the output.

## 6. Subprocessor SOC 2 reports / DPAs — **30 min**

Why it matters: HECVAT Section 2 and SOC 2 vendor management both expect
you to have collected evidence that your subprocessors are themselves
compliant.

Download and store in your institutional document store:

| Vendor | Where |
|--------|-------|
| Vercel | https://vercel.com/security → SOC 2 Type 2 report (NDA required, request via support) |
| Neon | https://neon.tech/trust → SOC 2 Type 2 report (NDA required) |
| Resend | https://resend.com/legal → security page + DPA |
| Upstash | https://upstash.com/trust → SOC 2 report |
| GitHub | https://github.com/security → public SOC 2 + ISO 27001 summary |

Store these alongside `docs/SECURITY-OVERVIEW.md` in your institutional
docs folder (NOT in the repo — they're under NDA).

## 7. Flip CSP from report-only to enforce — **after 1–2 weeks**

Why it matters: report-only CSP is monitoring; enforce-mode CSP is the
actual security control reviewers expect.

Steps:

1. Watch `/admin/audit?eventType=CSP_VIOLATION_REPORTED` for 1–2 weeks
   after the security hardening commits go live.
2. If the violation list is empty (or only contains expected sources you
   trust), set `CSP_MODE=enforce` in Vercel env vars.
3. Redeploy.
4. Watch the audit log for 24 hours — any user-impacting blocks will
   surface as `CSP_VIOLATION_REPORTED` rows AND will (now) actually
   block content. Browse the app yourself first.

## Done-when-checklist

- [ ] `master` branch protection turned on
- [ ] First Neon PITR restore test documented under `docs/security/restore-tests/`
- [ ] Dependabot enabled + first weekly PR received
- [ ] `AUDIT_IP_HASH_SECRET` set in Vercel for all environments
- [ ] `npm run db:push` + `npm run db:apply-rls` run against production Neon
- [ ] Subprocessor compliance reports archived institutionally
- [ ] `CSP_MODE=enforce` set in Vercel after report-only period

Once all seven are checked, the items most likely to be flagged during SOC 2
/ HECVAT review are closed. Combined with the in-repo work from Phases 1–3,
the readiness package documents in `docs/SECURITY-OVERVIEW.md` will be
backed by actually-implemented controls.
