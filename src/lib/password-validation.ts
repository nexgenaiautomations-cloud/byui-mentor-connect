// Pure password validation — no Node-only imports so it can be used from
// client components (signup-form, reset-form) without dragging `node:crypto`
// into the browser bundle. The actual hashing/verification lives in
// `lib/password.ts` (server-only).
//
// The policy is institution-configurable (HECVAT AAAI-03) via NEXT_PUBLIC_*
// environment variables, which Next.js inlines into BOTH the client and
// server bundles at build time — so the form and the API always enforce the
// same rules. Defaults preserve the original policy (8+ chars, letter+number).
// A floor of 8 is enforced so misconfiguration can never weaken the policy.

const MAX_PASSWORD_BYTES = 200;

function configuredMinLength(): number {
  const raw = parseInt(process.env.NEXT_PUBLIC_PASSWORD_MIN_LENGTH ?? "8", 10);
  if (Number.isNaN(raw)) return 8;
  return Math.min(Math.max(raw, 8), 64);
}

const MIN_LENGTH = configuredMinLength();
const REQUIRE_SYMBOL =
  process.env.NEXT_PUBLIC_PASSWORD_REQUIRE_SYMBOL === "true";
const REQUIRE_MIXED_CASE =
  process.env.NEXT_PUBLIC_PASSWORD_REQUIRE_MIXED_CASE === "true";

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < MIN_LENGTH) {
    issues.push(`Password must be at least ${MIN_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_BYTES) {
    issues.push(`Password must be ${MAX_PASSWORD_BYTES} characters or fewer.`);
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    issues.push("Password must include at least one letter and one number.");
  }
  if (REQUIRE_SYMBOL && !/[^A-Za-z0-9]/.test(password)) {
    issues.push("Password must include at least one symbol.");
  }
  if (REQUIRE_MIXED_CASE && !(/[a-z]/.test(password) && /[A-Z]/.test(password))) {
    issues.push("Password must include both upper- and lower-case letters.");
  }
  return issues;
}
