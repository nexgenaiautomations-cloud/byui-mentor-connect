// The pseudonymization salt, in one place.
//
// `AUDIT_IP_HASH_SECRET` is the single piece of "additional information" that
// makes the hashed identifiers in this system pseudonymous rather than
// reversible — see docs/privacy/pseudonymization-standard.md §5. It keys:
//
//   * `audit_event.ip_hash`           (src/lib/audit.ts)
//   * Upstash rate-limit key names    (src/lib/rate-limit.ts)
//
// Both of those read the salt through this module so there is one definition
// of "configured" and one place that complains when it isn't.
//
// WHY THE LOUD WARNING: if the variable is unset, hashing still happens but
// with an empty salt. For IPs that is weak (the IPv4 space is enumerable);
// for email addresses it is effectively no protection at all, because
// `firstname.lastname@byui.edu` is a small, guessable space. The failure is
// silent by nature — the hashes still look like hashes — so production
// announces it in the logs instead.
//
// WHY IT DOESN'T THROW: audit writes are best-effort and wrapped in
// try/catch, so throwing here would silently drop audit events, replacing a
// weak-salt problem with a missing-audit-trail problem. Rate limiting would
// fail open the same way. Degrading loudly beats failing quietly.

// A salt shorter than this is treated as unconfigured. 16 bytes of entropy is
// the floor the external-config runbook provisions.
export const MIN_HASH_SECRET_LENGTH = 16;

const ENV_NAME = "AUDIT_IP_HASH_SECRET";

let warned = false;

// True only when the salt is present and long enough to be meaningful.
// Safe to call from a health check or an operational script.
export function isHashSecretConfigured(): boolean {
  const raw = process.env[ENV_NAME];
  return !!raw && raw.trim().length >= MIN_HASH_SECRET_LENGTH;
}

// The salt as the hashing call sites need it. Returns "" when unconfigured so
// that callers still hash rather than ever persisting a raw identifier.
// IMPORTANT: callers must not change their hash construction — doing so
// invalidates every digest already written.
export function getHashSecret(): string {
  if (!isHashSecretConfigured() && process.env.NODE_ENV === "production") {
    if (!warned) {
      warned = true;
      console.error(
        `[security] ${ENV_NAME} is unset or too short in production. ` +
          `Hashed IPs and rate-limit keys are being written with an empty ` +
          `salt, which makes them reversible and breaks the pseudonymization ` +
          `control in docs/privacy/pseudonymization-standard.md. ` +
          `Set ${ENV_NAME} (>= ${MIN_HASH_SECRET_LENGTH} chars) in the Vercel ` +
          `project environment and redeploy. See ` +
          `docs/security/external-config-runbook.md section 4.`
      );
    }
  }
  return process.env[ENV_NAME] ?? "";
}
