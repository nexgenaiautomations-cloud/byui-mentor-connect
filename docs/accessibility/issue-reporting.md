# Accessibility Issue Reporting & Tracking

> **Owner:** Gabriel Dilworth (Program Owner / Developer)
> **Documented:** 2026-07-01

## How users report accessibility issues

Two channels, both available to every signed-in user:

1. **In-app "Report an issue" button** — present in the app sidebar on
   every page. Submissions are stored in the `issue_report` database table
   with category, free-text description, and an optional contact email.
   Accessibility problems should be reported under any category with a
   description of the barrier encountered; no special wording is needed.
2. **Email** — the program contact listed on the public accessibility
   statement (`/accessibility`).

Users who cannot operate the in-app reporter because of the very barrier
they are reporting should use the email channel or ask any CAN program
staff member to file on their behalf.

## How reports are tracked and resolved

- Every in-app report is a persistent database row (`issue_report`),
  reviewable by program admins. Reports are never silently dropped.
- **Triage target:** within 5 business days of submission.
- **Resolution target:** barriers that block a core task (sign-in,
  browsing mentors, requesting a mentor, logging activity) are treated as
  defects and prioritized ahead of feature work. Non-blocking issues are
  scheduled on the [accessibility roadmap](./roadmap.md).
- The reporter receives a response at their contact email when one is
  provided.

## Verification

The reporting pipeline is exercised by the app's normal issue-report flow
(`src/components/report-issue-button.tsx` → `POST /api/issues` →
`issue_report` table). Any admin can confirm receipt of a test report
end-to-end in under a minute.
