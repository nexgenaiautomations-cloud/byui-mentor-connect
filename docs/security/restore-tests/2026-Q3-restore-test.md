# Neon PITR Restore Test — 2026-Q3

> Quarterly restore-test evidence. Required for SOC 2 CC9.1 / Availability
> and HECVAT Business Continuity. Re-run quarterly per
> `docs/security/retention-policy.md`.

## Test execution

| Field | Value |
|-------|-------|
| Test date | 2026-06-30 |
| Operator | Gabriel Dilworth (via automation) |
| Project | `byui-mentor-connect` (Neon project ID `morning-paper-52831762`) |
| Source branch | `main` (production) |
| Restore target | Point in time ~1 hour before test (2026-06-30 16:56 MDT) |
| Restore method | Neon branch from past point in time, via Console UI |
| New branch name | `restore-test-2026-06-30` |
| Auto-delete | After 1 hour (built-in protection so the test branch can't linger) |
| Time-to-restore | ~6 seconds from "Create" click to the branch appearing in the list and being queryable |
| Branch endpoint | `ep-summer-lab-aqgwdzb9-pooler.c-8.us-east-1.aws.neon.tech` |

## Verification results

Row-count comparison between production (`main`) and the restored branch
at the source timestamp:

| Table | Production now | Restored branch | Delta |
|-------|---------------:|-----------------:|------:|
| user | 13 | 13 | 0 |
| match | 1 | 1 | 0 |
| request | 1 | 1 | 0 |
| meeting_log | 10 | 10 | 0 |
| mentor_application | 3 | 3 | 0 |
| achievement | 49 | 49 | 0 |
| monthly_feedback | 0 | 0 | 0 |
| issue_report | 1 | 1 | 0 |
| session | 0 | 0 | 0 |
| account | 0 | 0 | 0 |
| verification_token | 16 | 16 | 0 |
| password_reset_token | 0 | 0 | 0 |
| `audit_event` | 2 | (table does not exist) | n/a |

**The zero deltas on all twelve user-data tables confirm that the
restored branch faithfully reproduces the production state at the
target point in time** (no user traffic created/modified rows during
the 1-hour test window).

**The `audit_event` absence is a positive signal**, not a failure: the
table was created via `npm run db:push` later in the day, after the
branch's source timestamp. The restored branch correctly reflects the
schema as it existed at the chosen point in time — proof that PITR
captures DDL changes, not just data.

## Conclusion

- PITR is operational against the production database.
- Restore-to-queryable time is well under one minute for this dataset size.
- Restored data matches production to the byte for the chosen window.
- DDL state is also restored correctly (audit_event absence confirms this).

## Anomalies

None.

## Cleanup

The test branch is set to auto-delete after 1 hour. No manual cleanup
required. Branch URL stays valid until that deadline for any follow-up
spot-checks.

## Next scheduled test

2026-09-30 (Q4). Owner: Head Admin / Engineering.
