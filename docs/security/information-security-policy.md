# Information Security Policy — Nexgen Ai Integrations

> **Effective:** 2026-09-09 · **Version:** 1.0
> **Owner:** Gabriel Dilworth, Owner / Developer, Nexgen Ai Integrations
> **Applies to:** all personnel, contractors, and third parties with access to
> systems or data of BYUI CAN Mentor Connect (currently: Gabriel Dilworth)
> **Review cadence:** annually, or on any material change to the system,
> the subprocessor set, or the data we hold
> **Related:** [incident-response.md](./incident-response.md) ·
> [business-continuity.md](./business-continuity.md) ·
> [retention-policy.md](./retention-policy.md) ·
> [rls-plan.md](./rls-plan.md) ·
> [../privacy/change-review.md](../privacy/change-review.md) ·
> [SECURITY-OVERVIEW.md](../SECURITY-OVERVIEW.md) (control inventory)

## 1. Purpose and scope

This policy is the top-level statement of how Nexgen Ai Integrations protects
the information entrusted to it by BYU-Idaho and by the students and mentors
who use BYUI CAN Mentor Connect. The topical documents listed above sit
underneath it and carry the operational detail.

**In scope:** the Mentor Connect application and its production data; the
managed services it runs on (Vercel, Neon Postgres, Resend, Upstash, GitHub);
the source repository; and any workstation used to access production.

**Out of scope:** physical and environmental controls. Nexgen operates no
offices, servers, or datacenters. Those controls are inherited from the
managed providers and are evidenced by their own audit reports, not by ours.

## 2. Roles and accountability

Nexgen Ai Integrations is a single-person company. Gabriel Dilworth holds
every security role — policy owner, incident commander, and administrator of
record — and is accountable to the BYUI CAN head admin, who coordinates on the
institution side and escalates to BYU-Idaho IT Security.

There is no separate security office and no security staff. This is stated
plainly rather than implied: the compensating control is a small, fully
documented system with a short recovery path, not a larger team.

## 3. Data classification

| Class | Examples in this system | Handling |
|---|---|---|
| Student PII | Name, `@byui.edu` email, optional phone, photo, major, career interests, match records, meeting notes | Least-privilege access only; never exported without cause; never pasted into third-party or AI tools |
| Operational | Audit events, hashed security telemetry | Retained per the retention policy; must contain no secrets and no raw IPs |
| Secrets | Database URLs, API keys, auth secrets | Vercel environment variables only; never in code, commits, tickets, or notes |
| Public | Marketing pages, privacy notice, accessibility statement | No restriction |

The system deliberately does not store SSNs, birth dates, government IDs,
payment data, grades, transcripts, message content, plaintext passwords or
tokens, or raw IP addresses.

## 4. Access control

- Application sign-in is restricted to `@byui.edu` addresses, enforced at three
  independent layers so that no single misconfiguration can admit an outside
  account.
- Passwords are hashed; verification and reset tokens are stored only as
  SHA-256 hashes, are single-use, and expire.
- Administrative actions are role-gated in the application and recorded in the
  audit log.
- **Known limitation — there is no multi-factor authentication anywhere in
  this system today.** The application does not offer MFA or institutional
  SSO to its end users, and MFA is not yet enabled on the provider accounts
  (Vercel, Neon, GitHub, Resend, Upstash) that hold production access.
  Both are disclosed gaps rather than oversights. Enabling MFA on every
  provider account is the nearer-term of the two and is tracked as an open
  action item. Until it is done, the compensating controls are that there is
  exactly one account holder, credentials exist only in the platform secret
  store, and the rotation runbook has been exercised end to end.
- Access is granted on the narrowest scope that accomplishes the task. Direct
  database access is used only when the work genuinely requires it.
- Departure or role change means access is revoked and affected credentials
  rotated the same day.

## 5. Change management

Every change reaches production through a pull request against main; nothing
is edited live. The hosting platform builds each pull request as a preview
deployment, and type and lint errors fail that build, so they cannot reach
production. Changes that touch stored fields, subprocessors, retention,
deletion, authorization scope, or user tracking additionally pass the written
privacy review checklist before merge. Accessibility changes pass their own
SDLC checklist. Database invariants (row-level security, indexes) are
re-applied after any schema push.

Branch protection is enabled on the default branch: a required approving
review, linear history, required conversation resolution, and force pushes and
deletions blocked (verified 2026-09-09).

**Stated limits.** This is a single-developer project, so pull requests are
self-reviewed. Branch protection does not currently apply to administrators,
so the repository owner can bypass it. The unit, end-to-end, and accessibility
test suites live in the repository and are run before merge, but they are
**not** wired as required status checks that block a merge on failure — the
only automated checks are the preview build and the weekly security scan.
Wiring them in, and enforcing protection for admins, are open action items.

## 6. Cryptography and secrets

Traffic is TLS-encrypted end to end; data at rest is encrypted by the managed
providers. Secrets live in Vercel environment variables and nowhere else. If a
credential may have been exposed, the response is to rotate first and
investigate second. The full rotation runbook — auth secret, cron secret, both
database role passwords, email and cache credentials — was exercised end to
end on 2026-07-01.

## 7. Logging and monitoring

Security-relevant actions are written to an append-only audit log retained for
365 days and archived thereafter. Rate limiting protects authentication
endpoints. Vercel WAF rules block automated scanners and known exploit probes.
An OWASP ZAP baseline scan runs weekly in CI against the deployed application,
and dependency advisories are raised weekly by the dependency bot and reviewed
as they arrive. A content security policy is deployed and **enforcing** in
production, built on per-request nonces with `strict-dynamic`, `default-src
'self'`, and `object-src`/`frame-ancestors` set to `'none'`, with a violation
report endpoint. Verified live 2026-09-09, along with HSTS (2-year max-age,
includeSubDomains, preload) and the WAF rules, which return 403 for exploit
probes and AI-crawler user agents while normal traffic returns 200.

**Open remediation gap (2026-09-09):** dependency scanning runs weekly and is
working, but patching has fallen behind it. A backlog of open advisories
exists, including critical ones in the authentication library dating to July
2026. Clearing it is the highest-priority action item.

## 8. Vendor and subprocessor management

Five subprocessors are material: Vercel (hosting), Neon (database), Resend
(email), Upstash (rate limiting, hashed identifiers only), and GitHub (source
code, no student data). Each is reviewed against its published trust
documentation, and that evidence is refreshed quarterly. No new service
touches student data until it has passed a written privacy review and been
added to the public privacy notice.

## 9. Resilience

Recovery objectives, provider-by-provider continuity mechanisms, and tested
recovery procedures are set out in the business continuity plan. Database
restore drills run quarterly; the most recent was executed on 2026-06-30.

## 10. Incident response

Detection, severity tiers, the contact tree, containment steps, and
notification commitments to BYU-Idaho and affected users are set out in the
incident response runbook. Any incident involving credentials, student data,
or institutional reputation is escalated to BYU-Idaho IT Security early rather
than late.

## 11. Personnel

Anyone with access to BYU-Idaho data completes privacy and data-protection
training before that access is granted, and annually thereafter. Everyone with
access is bound by the confidentiality terms of the agreement with BYU-Idaho;
any future contractor signs a non-disclosure agreement as well. Violating
either ends access immediately.

## 12. What this policy is not

Nexgen Ai Integrations does not hold a SOC 2 attestation, ISO 27001
certification, or any other third-party security certification, and has not
commissioned an external penetration test. Nothing in this document should be
read as claiming otherwise. Where a control is inherited from a managed
provider, that provider's own audit report is the evidence, not this policy.

## Revision history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-09 | Initial policy. Consolidates the existing topical security and privacy documents under one owned, dated statement. |
