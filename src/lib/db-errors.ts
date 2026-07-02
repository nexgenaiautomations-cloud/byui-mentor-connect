// Postgres error-code helpers. The neon-http driver throws NeonDbError with a
// `code` property; drizzle sometimes wraps it, putting the original error on
// `cause`. Check both so callers don't depend on the wrapping behavior.

export function isUniqueViolation(e: unknown): boolean {
  return pgCode(e) === "23505";
}

function pgCode(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const direct = (e as { code?: unknown }).code;
  if (typeof direct === "string") return direct;
  const cause = (e as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === "string") return nested;
  }
  return null;
}
