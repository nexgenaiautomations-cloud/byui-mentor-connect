// Pure password validation — no Node-only imports so it can be used from
// client components (signup-form, reset-form) without dragging `node:crypto`
// into the browser bundle. The actual hashing/verification lives in
// `lib/password.ts` (server-only).

const MAX_PASSWORD_BYTES = 200;

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) {
    issues.push("Password must be at least 8 characters.");
  }
  if (password.length > MAX_PASSWORD_BYTES) {
    issues.push(`Password must be ${MAX_PASSWORD_BYTES} characters or fewer.`);
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    issues.push("Password must include at least one letter and one number.");
  }
  return issues;
}
