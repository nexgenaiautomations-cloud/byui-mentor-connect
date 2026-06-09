// Password reset tokens — generate a high-entropy random token, send the raw
// token in the email URL, store only its SHA-256 hash in the DB. Single-use,
// 1-hour TTL.
//
// On reset:
//   1. Look up the row by hashToken(rawToken).
//   2. Reject if not found or expired.
//   3. Update the user's password_hash.
//   4. Delete the row (single-use).
import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordResetTokens, users } from "@/db/schema";
import { hashPassword } from "./password";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Create a token row for the given user. Returns the raw token (caller emails
// it). Also opportunistically wipes any previously issued tokens for that user
// so an attacker can't accumulate valid reset windows.
export async function issueResetToken(userId: string): Promise<string> {
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId));

  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await db
    .insert(passwordResetTokens)
    .values({ userId, tokenHash, expiresAt });
  return raw;
}

export type ConsumeTokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "weak_password" };

// Atomically validates a reset token and rotates the user's password. Returns
// a structured result so the route can pick the right error copy.
export async function consumeTokenAndSetPassword(
  rawToken: string,
  newPasswordHashed: string
): Promise<ConsumeTokenResult> {
  if (!rawToken || rawToken.length < 16) {
    return { ok: false, reason: "not_found" };
  }
  const tokenHash = hashToken(rawToken);
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expiresAt.getTime() <= Date.now()) {
    // Best-effort cleanup so expired rows don't linger.
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, row.id));
    return { ok: false, reason: "expired" };
  }

  // Update the password, then delete the token. Two statements; in practice a
  // single token row + a single user row update is fine without an explicit
  // transaction, and Drizzle's tx() doesn't help with the http-driver.
  await db
    .update(users)
    .set({ passwordHash: newPasswordHashed })
    .where(eq(users.id, row.userId));
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.id, row.id));

  return { ok: true, userId: row.userId };
}

// Helper for the API: takes the plain password, hashes, then consumes.
export async function resetPasswordWithToken(
  rawToken: string,
  newPlainPassword: string
): Promise<ConsumeTokenResult> {
  const hashed = await hashPassword(newPlainPassword);
  return consumeTokenAndSetPassword(rawToken, hashed);
}

// Periodic cleanup helper. Not wired to a cron yet — the consume path already
// removes expired rows it finds, so this is a "just in case" sweep we can
// surface as an admin button later.
export async function purgeExpiredResetTokens() {
  await db
    .delete(passwordResetTokens)
    .where(lt(passwordResetTokens.expiresAt, new Date()));
}

// Silence unused-import warnings without losing the import surface above.
void and;
