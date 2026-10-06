# Pseudonymization and De-identification Standard — BYUI CAN Mentor Connect

> **Effective:** 2026-10-06 · **Version:** 1.0
> **Owner:** Gabriel Dilworth, Owner / Developer, Nexgen Ai Integrations
> **Applies to:** all production data of BYUI CAN Mentor Connect
> **Review cadence:** annually, or on any change to the data we hold, the
> subprocessor set, or the reporting we provide to BYU-Idaho
> **Sits under:** [../security/information-security-policy.md](../security/information-security-policy.md)
> **Related:** [../security/retention-policy.md](../security/retention-policy.md) ·
> [requests-and-complaints.md](./requests-and-complaints.md) ·
> [change-review.md](./change-review.md) ·
> [../security/rls-plan.md](../security/rls-plan.md)

## 1. Purpose

This standard states where BYUI CAN Mentor Connect replaces identifying data
with a code, where it deliberately does not, and how the additional
information needed to reverse a code is kept separate and secured. It is
written to answer the pseudonymization control in the BYU-Idaho vendor
assessment (TrustArc, PID00100385) and to govern the practice going forward.

Two definitions are used throughout, in the GDPR Art. 4(5) sense:

- **Pseudonymized** — identifiers are replaced by a code; re-identification
  is still possible, but only with separately held additional information.
- **Anonymized** — re-identification is not reasonably possible by anyone,
  including us. A record that we can still trace back to a student is
  pseudonymous, not anonymous, and this document never calls it anonymous.

## 2. Scope boundary: what must stay identified, and why

Mentor Connect exists to introduce a named student to a named mentor so they
can meet. A mentor must see who requested them, a mentee must see who accepted
them, and the head admin must be able to confirm a real BYU-Idaho student is
participating in a BYU-Idaho program. Name and `@byui.edu` address are
therefore **functional data, not incidental metadata**, and the following
remain identified in the production database by design:

| Data | Why it cannot be pseudonymized |
|---|---|
| `user.name`, `user.email` | The matching, introduction, and email notification functions all operate on them. A coded mentee cannot be introduced to a mentor. |
| `user.phone`, `preferredContactMethod` | Optional, student-supplied, and exist solely so a matched pair can make contact. Disclosed only post-match. |
| `user.major`, `semesterLevel`, `careerInterests` | Inputs to matching. Identifying in combination, so treated as student PII, not as "operational" data. |
| Meeting logs, match records | Program records attributable to a specific pair; their evidentiary value for the program depends on that attribution. |

This is a deliberate, documented acceptance rather than a gap. Pseudonymizing
these fields would not harden the product; it would remove its function. The
controls that protect them are access control, least privilege, encryption in
transit and at rest, and retention limits — not pseudonymization.

**What the system does not hold at all**, and so never needs to pseudonymize:
SSNs, birth dates, government or student ID numbers, I-numbers, payment data,
grades, transcripts, message content, and raw IP addresses. No student
identifier from a BYU-Idaho system of record is imported or stored.

## 3. Pseudonymization in force

These are implemented and verifiable in the source repository.

### 3.1 Opaque surrogate keys everywhere

`user.id` is a randomly generated UUID (`src/db/schema.ts`), not an email, not
an I-number, not a sequential integer. Every dependent record — matches,
meeting logs, mentor applications, achievements, requests, password-reset
tokens, audit events — references that UUID. The practical effect is that
every table other than `user` holds coded references only; the mapping from
code to person exists in exactly one place.

**Rule:** a natural identifier is never used as a primary or foreign key. New
tables reference `user.id`.

### 3.2 IP addresses are stored only as keyed hashes

`audit_event.ip_hash` is `SHA-256(ip + AUDIT_IP_HASH_SECRET)`
(`src/lib/audit.ts`). The raw address is never written to the database. The
salt is the "additional information kept separately" in the regulatory sense:
it is held as a Vercel environment variable, outside the database, so a
disclosure of the database alone does not permit re-identification of an
address. Hashes remain groupable, which preserves the forensic value — "the
same client hit this endpoint 40 times" — without revealing who.

**Custody and rotation:** see §5.

### 3.3 Rate limiting sees hashed keys only

Upstash Redis receives hashed identifiers rather than email addresses or IPs
(`src/lib/rate-limit.ts`). This is stated in the public privacy notice. The
subprocessor therefore holds no readable identifier.

### 3.4 Secrets and tokens are stored as hashes, never values

Passwords are scrypt-hashed with a per-user salt. Email-verification and
password-reset tokens are stored as SHA-256 digests with the raw value sent
only to the student's inbox (`src/lib/email-verification.ts`,
`src/lib/password-reset.ts`). A database disclosure yields no usable
credential.

### 3.5 Deletion leaves pseudonymous audit history

On a verified deletion request, `audit_event.actor_user_id` and
`target_user_id` are set to `NULL` by foreign-key action
(`src/db/schema.ts`), so the security record of what happened survives while
ceasing to point at a person. The behaviour is disclosed in the privacy
notice and the retention policy rather than being a silent exception.

### 3.6 Audit metadata carries no identifiers

`sanitizeMetadata()` in `src/lib/audit.ts` strips any metadata key whose name
resembles a secret, and the helper caps payload size. Call sites pass
booleans, enum strings, and record IDs rather than addresses — for example
`{ byEmail: true }` rather than the address itself.

Stated precisely: the helper filters by **key name**, not by value content.
Keeping addresses out of metadata is therefore a convention enforced at code
review, not a mechanical guarantee. The export control in §4.1 compensates by
re-checking values at the boundary.

### 3.7 No third-party analytics, tracking, or AI processing

The application has no analytics or tracking dependency and no AI/ML
dependency. No student record, pseudonymized or otherwise, is sent to an
advertising network, analytics vendor, or model provider. Student PII is never
pasted into third-party or AI tools; this is a standing rule in the
information security policy.

## 4. De-identification at the boundary

Pseudonymizing a table inside a database that necessarily holds the
identified `user` table beside it buys little: an attacker with the database
has the mapping. The controls that matter are applied where data **leaves**
the database. Two such boundaries exist.

### 4.1 Audit-log archive exports

The retention policy keeps audit rows hot for 365 days and archives older
rows to a CSV in the program's institutional document store. That file leaves
the database, so it is de-identified on the way out by
`scripts/export-audit-archive.ts` (`npm run audit:archive`):

- Opaque `user.id` values only. The export's input type has no name, email,
  or phone field, so no widened query can smuggle one in without a type
  error, and a unit test asserts no such column exists.
- `ip_hash` passes through; the salt is **not** exported.
- `user_agent` is reduced to browser and OS family ("Chrome on Windows").
  Full UA strings are a fingerprinting vector and their version detail has no
  forensic value in a year-old row.
- Email-shaped substrings in metadata are replaced with `[redacted-email]`.
- The script never deletes rows; removal from the hot table requires
  head-admin approval and a documented reason, and Postgres RLS blocks
  `DELETE` on `audit_event` outright.
- Each run prints a manifest — row count, date range, SHA-256 of the file,
  operator, timestamp — to be recorded with the archive so its integrity can
  be checked later.
- `audit-archive-*.csv` is git-ignored, so an export cannot be committed by
  accident.

The resulting file is **pseudonymous, not anonymous**, and is handled as
restricted: admin-only access in the institutional store, never left on a
workstation.

### 4.2 Program reporting and statistics

Any participation or outcome reporting provided to BYU-Idaho or used for
program evaluation is **aggregate only**:

- Counts, rates, averages and distributions — never row-level extracts.
- No direct identifiers, and no free-text student content (bios, meeting
  notes, application motivations).
- **Minimum cell size of 5.** A figure covering fewer than five students is
  suppressed or merged into a broader category, because "the one mechanical
  engineering senior who logged four meetings" is identifying even with the
  name removed. Small-cohort combinations of major, semester level, and
  graduation term are the specific risk this guards against.
- The in-app admin analytics view shows aggregates; row-level member data is
  reachable only through the admin member views, which are access-controlled
  and audited.

**Rule:** no row-level export of student records to any party, including
BYU-Idaho, without a documented institutional request handled under
[requests-and-complaints.md](./requests-and-complaints.md).

## 5. Custody of the re-identification keys

Pseudonymization is only as good as the separation of the additional
information. There is exactly one such secret in this system.

| Key | What it reverses | Where it lives | Who holds it |
|---|---|---|---|
| `AUDIT_IP_HASH_SECRET` | Hashed IPs in `audit_event` and rate-limit keys | Vercel environment variables (production scope), outside the database | Gabriel Dilworth, Owner / Developer |

Rules:

1. The salt is never committed to the repository, written into a document,
   pasted into a ticket or email, or included in any export.
2. It is never stored in the same system as the data it reverses. A database
   backup therefore contains no means of re-identification.
3. It is rotated on operator change, on suspected exposure, and otherwise on
   the same annual cycle as this document's review. Rotation is one-way by
   design: previously written hashes become permanently non-reversible, which
   is acceptable and is the expected outcome.
4. Access to Vercel environment variables is protected by multi-factor
   authentication on the provider account.
5. Nexgen does not re-identify a hashed value except during an active
   security investigation under
   [../security/incident-response.md](../security/incident-response.md), and
   the re-identification is itself recorded in the incident log.

## 6. Obligations when things change

- **New table or column.** Decide at design time whether the field is
  functional (§2) or operational. Operational data is coded or hashed; a
  natural identifier is never a key.
- **New export, report, or integration.** It crosses the boundary in §4 and
  must be de-identified before it ships. Aggregates follow the minimum cell
  size of 5.
- **New subprocessor.** Record what identifiers it will receive and whether
  they can be hashed first, per
  [change-review.md](./change-review.md). Material changes are communicated
  to the BYUI CAN head admin before they take effect.
- **New telemetry.** Raw IPs and full user-agent strings are not persisted.

## 7. Known limitations, stated plainly

1. **Core member records are identified by design** (§2). This is the
   intended architecture of a mentorship matching program, not a deficiency
   to be remediated.
2. **Auth.js writes magic-link verification rows keyed by email address.**
   The `verification_token.identifier` column holds the raw address for
   magic-link sign-in, because that is the upstream Auth.js / Resend provider
   convention and changing it would mean forking the adapter. Exposure is
   bounded: rows carry a 24-hour TTL, are single-use, are deleted on use, and
   the same address already exists in the `user` table in the same database,
   so the row adds no disclosure that is not already present. Accepted and
   disclosed rather than silently hashed.
3. **Metadata cleanliness is review-enforced**, not mechanically guaranteed
   inside the database (§3.6). The boundary export compensates (§4.1).
4. **Archival is operator-run, not scheduled.** The export is now scripted
   and repeatable, but the head admin triggers it quarterly; there is no cron
   job. A scheduled job remains a hardening item.
5. **Pseudonymous, not anonymous.** Nothing in this document claims
   anonymization. Archives and hashed telemetry remain re-identifiable by the
   holder of the salt, which is why §5 exists.

## 8. Verification

| Control | How to verify |
|---|---|
| Surrogate keys | `src/db/schema.ts` — `user.id` is `crypto.randomUUID()`; dependent tables reference it |
| IP hashing | `src/lib/audit.ts` — `hashIp()`; `tests/unit/audit.test.ts` |
| Export de-identification | `npm run test -- audit-archive`; `npm run audit:archive -- --dry-run` |
| Append-only audit log | `scripts/apply-rls.ts`; [../security/rls-plan.md](../security/rls-plan.md) |
| Deletion leaves coded history | `scripts/delete-user.ts --dry-run`; retention policy |
| No tracking or AI dependencies | `package.json` |

## 9. Last reviewed

2026-10-06 — initial issue, in response to the BYU-Idaho vendor assessment
remediation task on pseudonymization.
