// Email verification tokens — generate a random token, hash it, send the
// raw token in the email URL, store only the hash in the DB. Single-use,
// 24-hour TTL. Reuses the Auth.js `verification_token` table to avoid a
// schema migration; we namespace the identifier with `verify:` so these
// rows don't collide with Auth.js magic-link verification tokens.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { verificationTokens, users } from "@/db/schema";

export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const IDENTIFIER_PREFIX = "verify:";

export function verifyIdentifierFor(email: string): string {
  return `${IDENTIFIER_PREFIX}${email.trim().toLowerCase()}`;
}

function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Issue a fresh verification token for the given email. Wipes any earlier
// verification tokens for the same address so an attacker can't accumulate
// valid windows.
export async function issueVerifyToken(email: string): Promise<string> {
  const identifier = verifyIdentifierFor(email);
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier));

  const raw = generateRawToken();
  await db.insert(verificationTokens).values({
    identifier,
    token: hashToken(raw),
    expires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
  });
  return raw;
}

export type ConsumeVerifyResult =
  | { ok: true; email: string }
  | { ok: false; reason: "not_found" | "expired" };

// Validate a verification token and mark the matching user's email as
// verified. Single-use: the row is deleted on success.
export async function consumeVerifyToken(
  email: string,
  rawToken: string
): Promise<ConsumeVerifyResult> {
  if (!rawToken || rawToken.length < 16) {
    return { ok: false, reason: "not_found" };
  }
  const identifier = verifyIdentifierFor(email);
  const tokenHash = hashToken(rawToken);
  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, tokenHash)
      )
    )
    .limit(1);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expires.getTime() <= Date.now()) {
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, tokenHash)
        )
      );
    return { ok: false, reason: "expired" };
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.email, email.trim().toLowerCase()));
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        eq(verificationTokens.token, tokenHash)
      )
    );
  return { ok: true, email: email.trim().toLowerCase() };
}

// Periodic cleanup helper for stale verification tokens.
export async function purgeExpiredVerifyTokens() {
  await db
    .delete(verificationTokens)
    .where(lt(verificationTokens.expires, new Date()));
}
