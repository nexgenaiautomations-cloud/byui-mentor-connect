// Password hashing using Node's built-in scrypt. No external dependency —
// scrypt is FIPS-validated and intentionally slow, which is exactly what you
// want for password storage.
//
// Hash format: "scrypt$N$saltHex$hashHex"
//   N           — scrypt cost (16384 by default — ~50ms on modern hw)
//   saltHex     — 16 bytes random, hex-encoded
//   hashHex     — 64-byte derived key, hex-encoded
//
// Constant-time comparison via timingSafeEqual.
//
// SERVER-ONLY: do not import this module from a "use client" component — it
// pulls `node:crypto`, which doesn't exist in the browser bundle. For form
// validation, import `passwordIssues` from `./password-validation` instead.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Re-export the pure validator so server-side code can still import from
// here — the existing call sites (signup route, reset route) keep working.
export { passwordIssues } from "./password-validation";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number }
) => Promise<Buffer>;

const KEYLEN = 64;
const COST = 16384; // 2^14 — tuned so a single hash takes ~50ms
const SALT_BYTES = 16;
const MAX_PASSWORD_BYTES = 200;

export async function hashPassword(password: string): Promise<string> {
  if (password.length > MAX_PASSWORD_BYTES) {
    throw new Error("password too long");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEYLEN, { N: COST });
  return `scrypt$${COST}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (!stored || typeof stored !== "string") return false;
  // Reject overlong inputs before they reach scrypt — cheap DoS guard.
  if (password.length > MAX_PASSWORD_BYTES) return false;

  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(cost) || cost < 1024) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[2], "hex");
    expected = Buffer.from(parts[3], "hex");
  } catch {
    return false;
  }
  if (salt.length !== SALT_BYTES || expected.length !== KEYLEN) return false;

  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, KEYLEN, { N: cost });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

