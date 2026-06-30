# BYUI CAN Mentor Connect — Security Overview (factual notes)

> **How to use this doc:** This is a structured fact-dump of every security
> control currently implemented in the app. Paste it into ChatGPT with a prompt
> like *"Turn this into a 1-page security overview for the BYU-Idaho Career and
> Academic Network (CAN) program leadership — plain language, no marketing
> fluff, organized by what users care about (their account, their email, their
> data)."* and it will produce a polished explainer.
>
> Everything below is verified against the source code as of 2026-06-30.
> Anything not listed here is **not implemented** — be careful not to over-claim.

---

## 1. Identity & Sign-In

### Two ways to sign in
- **Email + password** (Credentials provider via Auth.js / NextAuth v5)
- **Magic link** sent by email (Resend provider via Auth.js)

Both providers write to the same `users` table. A user can be created via either path.

### Email domain enforcement
- Sign-up is rejected unless the email ends with `@byui.edu`
- Sign-in (both password and magic-link) is rejected unless the email ends with `@byui.edu`
- The check happens at three layers:
  1. **Form-level** Zod schema in `/api/auth/signup` (`signup/route.ts:19-29`)
  2. **Credentials authorize()** callback in `auth.ts:115`
  3. **Global `signIn` callback** in `auth.ts:137-142` — last line of defense; rejects any sign-in regardless of provider if the email isn't `@byui.edu`

This means even if a misconfiguration let an external email enter the system, it could never establish a session.

### Email verification before access
- New password sign-ups receive a verification email; account cannot access the app until verified
- We use **a separate verification-token table** (`verificationTokens`) namespaced with `verify:` prefix to avoid colliding with Auth.js magic-link rows
- Raw verification token is **32 random bytes (hex)** — 256 bits of entropy
- Only the **SHA-256 hash** of the token is stored in the database
- TTL: **24 hours**
- Single-use: row is deleted on successful verification
- Issuing a new token **wipes any earlier tokens** for the same email, so an attacker can't accumulate multiple valid windows

(`lib/email-verification.ts`)

---

## 2. Password Storage

- **Algorithm**: Node's built-in `scrypt` (FIPS-validated, no external dependency)
- **Cost (N) parameter**: 16,384 (= 2¹⁴), tuned so a single hash takes ~50 ms on modern hardware — fast enough for users, slow enough to make offline cracking expensive
- **Salt**: 16 random bytes per password, generated with `crypto.randomBytes`
- **Derived key length**: 64 bytes
- **Stored format**: `scrypt$N$saltHex$hashHex` (self-describing — can be migrated to a stronger N later without breaking old hashes)
- **Comparison**: `crypto.timingSafeEqual` (constant-time; prevents timing-based password discovery)
- **DoS guard**: passwords over 200 bytes are rejected before scrypt runs (avoids letting an attacker waste CPU with megabyte passwords)

### Password strength rules (enforced on sign-up and on reset)
- Minimum 8 characters
- At least one letter AND one number
- Maximum 200 characters

(`lib/password.ts`, `lib/password-validation.ts`)

---

## 3. Password Reset

- User submits email → if it exists, a reset link is emailed; if it doesn't, we still return success (no account-existence leak)
- Reset token: **32 random bytes (hex)** — 256 bits of entropy
- Only the **SHA-256 hash** of the token is stored in the database (`passwordResetTokens` table)
- TTL: **1 hour** (shorter than verification — reset is a high-value operation)
- Single-use: row deleted after the password is rotated
- Issuing a new reset token **wipes earlier tokens** for the same user

(`lib/password-reset.ts`)

---

## 4. Magic-Link Sign-In

- Powered by Auth.js Resend provider; tokens managed by Auth.js (same hash-at-rest model: stored as a hash, not the raw value)
- TTL: **24 hours**, single-use
- **Link rewriting before sending**: instead of emailing the raw `/api/auth/callback/resend?token=…` URL (which Microsoft Defender Safe Links and Gmail link-preview would silently visit and burn before the user clicks), we wrap it in `/login/verify?token=…`. The verify page shows a "Continue to sign-in" button, and only the user's click actually consumes the token.
- This prevents **scanner-burn** — a known failure mode where corporate mail filters destroy magic links before they reach the recipient

(`auth.ts:55-101`)

---

## 5. Session Management

- **Strategy**: JWT (so the Credentials and magic-link providers can coexist without separate session tables)
- **Cookie name**:
  - Production: `__Secure-authjs.session-token` (the `__Secure-` prefix is a browser-enforced rule that the cookie must be set over HTTPS)
  - Development: `authjs.session-token` (browsers reject `__Secure-` over `http://localhost`)
- **Cookie flags**:
  - `httpOnly: true` — JavaScript on the page cannot read the session token (blocks the most common XSS-to-session-theft path)
  - `sameSite: "lax"` — browser will not send the cookie on cross-site POSTs (CSRF mitigation built into the cookie itself)
  - `secure: true` in production — cookie is only transmitted over HTTPS
  - `path: "/"` — sent on all routes
- **Session JWT** contains the user ID only; every server-side request that needs user data re-fetches from the DB via `getCurrentUser()` (`lib/session.ts`) — so role / privilege changes take effect immediately on the next request

(`auth.ts:35-53`, `lib/session.ts`)

---

## 6. Rate Limiting

Backed by Upstash Redis (`@upstash/ratelimit`). Sliding-window counters keyed independently on **email** and **IP**, so a single attacker can't bypass per-email limits by rotating IPs, and a single victim's inbox can't be flooded by rotating IPs either.

| Action | Per-email limit | Per-IP limit |
|--------|----------------|--------------|
| Magic-link send | 3 / hour | 10 / hour |
| Sign-up | — | 5 / hour |
| Password sign-in attempt | 10 / 5 minutes | 50 / 5 minutes |
| Password reset send | 3 / hour | 10 / hour |

If Upstash is not configured (missing env vars), rate-limiting **silently no-ops** — it never crashes the app, but also never blocks. In production both `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set.

(`lib/rate-limit.ts`)

---

## 7. Authorization (Who can do what)

### Role model
- Every user is a **member** (the default; they can browse mentors and log their own activity)
- A user can additionally be flagged `isMentor` (vetted mentor — can accept mentees)
- A user can additionally be flagged `isAdmin` (program staff — can match-make, manage users)
- An admin is always also a mentor

### Two-layer check
- **Capability layer**: `users.isMentor` and `users.isAdmin` columns in the database — the truth
- **View layer**: an `active-role` cookie (`byui-can-role`) drives which "face" of the app renders (member dashboard vs. mentor dashboard vs. admin panel)

Server-side mutations always check the **capability**, not the cookie:
- `requireUser()` for any authenticated route
- `requireAdmin()` for admin-only routes (throws 403 if not `isAdmin`)
- Role cookie is **re-validated on every read** against the user's actual flags, so cookie tampering can't elevate privileges and a demotion takes effect on the next request

(`lib/session.ts`, `lib/roles.ts`, `lib/roles-server.ts`)

### Privacy-sensitive query scoping
- Mentor / mentee queries are scoped to the **active role** so a user who is both a mentor and a member can't accidentally see the wrong side of a relationship in either view
- Admin-only endpoints (matchmaker, admin management, user cleanup) are gated by `requireAdmin()` in the route handler

---

## 8. Input Validation

- Every API route validates its request body with a **Zod schema** before touching the database
- Schemas reject unknown fields, enforce type and length bounds, and normalize input (emails are trimmed and lowercased at the schema layer, not at the DB layer)
- Drizzle ORM uses **parameterized queries** for everything — SQL injection is structurally impossible
- Profile photo uploads:
  - Client-side cropped/resized to 256×256, re-encoded as WebP or JPEG
  - Server enforces **600,000-character cap** on the data URL (`api/me/route.ts:36-44`)
  - Server rejects anything that isn't `https://` or a `data:image/(png|jpeg|webp);base64,` URL — blocks `javascript:` URLs and other attacker-controlled rendering vectors

---

## 9. Transport Security

- **App ↔ users**: HTTPS only in production (enforced by Vercel; the `__Secure-` cookie prefix would refuse to be set otherwise)
- **App ↔ database (Neon Postgres)**: TLS-encrypted (Neon serverless driver over HTTPS-style fetch)
- **App ↔ Resend (email API)**: HTTPS (`https://api.resend.com/emails`)
- **App ↔ Upstash (rate-limit Redis)**: HTTPS REST API
- No mixed-content surfaces; all third-party scripts are first-party Vercel-hosted or signed-origin SDKs

---

## 10. Email Deliverability & Anti-Phishing

- All transactional email goes through **Resend**, sent from a single dedicated sub-domain (`noreply@byuican.com` by default; configurable via `EMAIL_FROM`)
- Magic-link emails use a **branded HTML template** (logo, brand colors, plain-text fallback) so users can distinguish real mail from impersonation attempts
- Emails carry an `X-Entity-Ref-ID` header so corporate mail filters can thread + de-prioritize as transactional (helps with deliverability against Outlook's Focused Inbox)
- Magic links are **scanner-resistant** (see Section 4 — link rewriting)
- BYU-Idaho IT has the option to whitelist the `byuican.com` sender at the campus mail gateway to bypass spam scoring entirely

---

## 11. What Is NOT Stored

The app deliberately does not collect or store:
- Social Security Numbers, dates of birth, government IDs
- Credit card information or any payment data (the app does not handle money)
- Off-platform messaging content (Teams / call history is held by Microsoft, not us)
- Browsing history, IP addresses beyond what's needed for rate-limiting
- Plain-text passwords (only scrypt hashes are stored)
- Plain-text verification or reset tokens (only SHA-256 hashes are stored)
- Email metadata from Outlook or Gmail (we don't read users' mailboxes)

User-facing PII actually stored: name, BYU-Idaho email, optional phone number, profile photo (compressed to ~25 KB), major/minor/career interests, meeting notes the mentor records.

---

## 12. Operational Security

- **No secrets in source code** — all credentials (Auth.js secret, Resend API key, Neon DATABASE_URL, Upstash tokens) are environment variables in Vercel
- **No third-party analytics or session-recording** that could capture form fields containing passwords or tokens
- Deployment is **immutable** — every push creates a new Vercel deployment; rollback is a single click
- Database is **point-in-time-restore capable** via Neon (last 7 days by default)
- Cron-scheduled job at `0 9 * * *` (`/api/cron/inactivity`) flags inactive matches — runs server-side under Vercel cron auth

---

## 13. Append-only audit log

An `audit_event` table records admin and security-sensitive events. Writes go through `src/lib/audit.ts`, which:

- Hashes the IP with SHA-256 + `AUDIT_IP_HASH_SECRET` before storing. The raw IP is never persisted.
- Sanitizes metadata: keys whose names look like secrets (`password`, `token`, `secret`, `session`, `jwt`, `cookie`, `magic_link`, `bearer`, `authorization`) are replaced with `[redacted]`.
- Caps serialized metadata at 8 KB so a misuse can't bloat the table.
- Is best-effort: a failed audit insert never blocks the user-facing action; failures are logged to Vercel logs.

Events logged today:

- Admin role changes (promote, demote, transfer head)
- Mentor application approve / reject
- Admin-created and admin-removed matches
- Sign-up creation, email verification, sign-in success and failure
- Password reset requested and completed
- Rate-limit triggers on sign-up and sign-in
- Unauthorized admin access attempts (logged when a non-admin hits an admin-gated endpoint)
- CSP violation reports

UPDATE and DELETE on `audit_event` are **denied at the database layer** by Postgres Row-Level Security (see Section 14). An attacker with the application's DB credentials cannot tamper with or remove past audit rows.

Read access is gated to admins at the application layer (`/api/admin/audit-events` and the `/admin/audit` page both call `requireAdmin()`).

## 14. Content Security Policy

A strict CSP is shipped from `middleware.ts`. Mode is controlled by the `CSP_MODE` environment variable:

| `CSP_MODE` | Header sent | When to use |
|-----------|-------------|-------------|
| `disabled` | None | Local dev when HMR fights the policy |
| `report-only` | `Content-Security-Policy-Report-Only` | Production default — observe without blocking |
| `enforce` | `Content-Security-Policy` | Production after report-only run is clean |

If `CSP_MODE` is unset, the default is `disabled` in development and `report-only` everywhere else. Production *never* silently enforces — `enforce` is explicit.

Policy summary (per-request nonce):

```
default-src 'self'
base-uri 'self'
object-src 'none'
frame-ancestors 'none'   ← clickjacking guard
form-action 'self'
script-src 'self' 'nonce-…' 'strict-dynamic'
style-src 'self' 'nonce-…' 'unsafe-inline'
img-src 'self' data: blob: https://api.dicebear.com https://images.unsplash.com
font-src 'self' data:
connect-src 'self' https://vitals.vercel-insights.com
frame-src 'none'
worker-src 'self' blob:
manifest-src 'self'
report-uri /api/security/csp-report
upgrade-insecure-requests   ← production only
```

Violations are POSTed to `/api/security/csp-report`. That endpoint:

- Caps request body at 16 KB.
- Parses both legacy `application/csp-report` and modern Reporting API envelopes.
- Logs a structured `CSP_VIOLATION_REPORTED` audit event (severity `warning`) with a small fixed set of fields (blocked URI, document URI, violated directive, status code).
- Returns `204 No Content` regardless of outcome to prevent retry loops.

## 15. Row-Level Security (Postgres RLS)

RLS is enabled and FORCEd on `audit_event` with permissive INSERT and SELECT policies and no UPDATE or DELETE policies. The absence of those policies, combined with `FORCE ROW LEVEL SECURITY`, makes the table provably append-only at the database layer — even the connection that owns the table cannot tamper with prior rows.

Apply with `npm run db:apply-rls` after any `npm run db:push`. Idempotent.

RLS is **not yet enabled on user, request, match, meeting_log, or other domain tables.** This is a deliberate decision documented in [`security/rls-plan.md`](./security/rls-plan.md): the app's `drizzle-orm/neon-http` driver + single-owner connection model makes per-user RLS infeasible without infrastructure changes (the recommended next step is Neon Authorize with `pg_session_jwt`). For now, app-layer authorization remains the boundary for those tables.

## 16. Known Gaps (still true)

What we have NOT yet implemented:

- **Two-factor authentication** (2FA / TOTP / WebAuthn) — not implemented. Auth is single-factor (password or magic link). Mitigated by mandatory `@byui.edu` domain, 24-hour magic-link TTL, and rate limits.
- **Per-record RLS for domain tables** — not enabled (see Section 15). Authorization for `user`, `match`, `meeting_log`, etc. is at the application layer only.
- **External penetration test** — not yet conducted. The codebase has been reviewed internally but not by an external red team.

These are intentional trade-offs for a free, internally-operated, student-facing tool — but they are real gaps and should be on a "future hardening" list if the program ever expands beyond BYUI or starts handling sensitive data (FERPA records, financial info, etc.).

---

## 17. Compliance Posture

- **FERPA** (student educational records): the app does **not** store grades, transcripts, or any record protected under FERPA. Career interests and meeting notes are not FERPA-covered.
- **HIPAA**: not in scope (no health data).
- **PCI-DSS**: not in scope (no payment data).
- **CCPA / GDPR**: data subjects can request deletion via the head admin; technical implementation exists (`db:cleanup-accounts` script wipes a user and nulls non-cascading FK references).

---

## File References

If reviewers want to verify any claim above, the relevant code lives at:

| Topic | File |
|-------|------|
| Auth providers, session cookie config | `auth.ts` |
| Password hashing | `src/lib/password.ts` |
| Password strength rules | `src/lib/password-validation.ts` |
| Email verification tokens | `src/lib/email-verification.ts` |
| Password reset tokens | `src/lib/password-reset.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Sign-up + domain enforcement | `src/app/api/auth/signup/route.ts` |
| Session helpers + admin gate | `src/lib/session.ts` |
| Roles (capability vs view) | `src/lib/roles.ts`, `src/lib/roles-server.ts` |
| Profile photo upload validation | `src/app/api/me/route.ts` |
| Database client (TLS to Neon) | `src/db/client.ts` |
| Cron schedule | `vercel.json` |
| Audit logging helper | `src/lib/audit.ts` |
| Audit table schema | `src/db/schema.ts` (`auditEvents`) |
| Audit admin viewer (page + API) | `src/app/(app)/admin/audit/page.tsx`, `src/app/api/admin/audit-events/route.ts` |
| CSP middleware | `middleware.ts` |
| CSP report endpoint | `src/app/api/security/csp-report/route.ts` |
| RLS apply script | `scripts/apply-rls.ts` |
| RLS plan / decisions | `docs/security/rls-plan.md` |
