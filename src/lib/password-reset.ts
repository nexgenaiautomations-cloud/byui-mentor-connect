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
import { and, eq, lt, sql } from "drizzle-orm";
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

  // Consume the token and rotate the password in ONE statement. The neon-http
  // driver can't run multi-statement transactions, but a single statement is
  // atomic — so a crash can never leave the password changed while the token
  // stays valid (or vice versa). The DELETE in the CTE also acts as the
  // concurrency gate: only one caller can consume a given token row.
  const result = await db.execute(sql`
    WITH consumed AS (
      DELETE FROM ${passwordResetTokens}
      WHERE ${passwordResetTokens.id} = ${row.id}
      RETURNING user_id
    )
    UPDATE ${users} SET password_hash = ${newPasswordHashed}
    FROM consumed
    WHERE ${users.id} = consumed.user_id
    RETURNING ${users.id} AS user_id
  `);
  if (result.rows.length === 0) {
    // Token was consumed by a concurrent request between our SELECT and now.
    return { ok: false, reason: "not_found" };
  }

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
