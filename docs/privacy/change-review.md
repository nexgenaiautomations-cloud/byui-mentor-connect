# Privacy Review in Change Management

> **In force since:** 2026-07-01 · **Owner:** Gabriel Dilworth (Nexgen Ai Integrations)
> Companion to the accessibility [SDLC checklist](../accessibility/sdlc-checklist.md);
> together they form the pre-merge review gates for every change.

## When a change requires privacy review

Any pull request that does one of the following gets the checklist below
applied before merge:

- Adds, removes, or changes a **stored data field** about a user
- Changes what data is **sent to a subprocessor** (Vercel, Neon, Resend,
  Upstash, GitHub) or adds a new third-party service
- Changes **retention, deletion, or export** behavior
- Changes **who can see** a piece of user data (authorization scope)
- Adds any **tracking, analytics, or logging** of user behavior

## Review checklist

- [ ] Is the new data actually needed for the program's purpose? (data
      minimization — collect nothing "because it might be useful")
- [ ] Is it reflected in the public privacy notice (`/privacy`)? Update the
      notice and its effective date in the same PR if not.
- [ ] Is the retention policy (`docs/security/retention-policy.md`) still
      accurate? Update in the same PR if not.
- [ ] Does deletion (`scripts/delete-user.ts`) still remove everything it
      should?
- [ ] Do audit-log writes stay free of secrets and raw IPs?
- [ ] New subprocessor? Add it to the subprocessor review evidence and the
      privacy notice before the feature ships.

## Interim risk mitigation

If a privacy risk is found that cannot be resolved immediately, the same
escape hatch as the accessibility checklist applies: file it via the issue
process with a named owner and fix date, and mitigate in the interim by the
narrowest available means (gate the feature off, restrict the field to
admins, or shorten retention). Silent acceptance of a privacy risk is not
permitted.

## Records

The PR itself is the review record — reviewers note "privacy: reviewed" in
the PR description when the checklist ran. This document is re-reviewed
annually or when the program's data scope changes.
