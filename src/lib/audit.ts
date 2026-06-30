// Append-only audit log helper. All writes go through `auditEvent()` so
// per-route handlers don't have to think about IP hashing, metadata
// validation, or failure modes. The function is best-effort: if the audit
// insert fails, the caller's user-facing action still succeeds. We log a
// warning to the server console so the failure is visible in Vercel logs.
//
// SAFETY INVARIANTS (do not violate without updating this comment):
//   * No raw IPs are stored — only SHA-256(ip + AUDIT_IP_HASH_SECRET).
//   * No passwords, raw tokens, magic links, or session JWTs in metadata.
//   * No free-form private content (meeting notes, mentee bios, etc).
//   * Metadata is stringified JSON with a hard size cap so an attacker can't
//     bloat the audit table.
//
// READS are gated to admins at the API/UI layer (`/api/admin/audit-events`,
// `/admin/audit`). Postgres-level RLS additionally blocks UPDATE and DELETE
// for everyone, including the app role, so the log is provably append-only
// once `scripts/apply-rls.ts` has been run.

import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";

// Keep this union in lockstep with the Postgres enum in schema.ts.
export type AuditEventType =
  | "ADMIN_PROMOTED_USER"
  | "ADMIN_DEMOTED_USER"
  | "ADMIN_TRANSFERRED_HEAD"
  | "ADMIN_APPROVED_MENTOR"
  | "ADMIN_REJECTED_MENTOR"
  | "ADMIN_CREATED_MATCH"
  | "ADMIN_REMOVED_MATCH"
  | "ADMIN_DELETED_USER"
  | "ADMIN_CLEANED_USER_DATA"
  | "USER_SIGNUP_CREATED"
  | "USER_EMAIL_VERIFIED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "LOGIN_SUCCEEDED"
  | "LOGIN_FAILED"
  | "MAGIC_LINK_REQUESTED"
  | "RATE_LIMIT_TRIGGERED"
  | "ROLE_COOKIE_REJECTED"
  | "UNAUTHORIZED_ADMIN_ATTEMPT"
  | "CSP_VIOLATION_REPORTED";

export type AuditSeverity = "info" | "warning" | "critical";

// Hard cap on stringified metadata — 8 KB is enough for structured context
// (event_type names, IDs, short reasons) without letting a misuse bloat the
// table. Anything longer is truncated and a marker is appended.
const MAX_METADATA_BYTES = 8 * 1024;

// Keys we refuse to persist regardless of where they came from. Case-
// insensitive substring match — "passwordHash" and "password_hash" both hit.
const FORBIDDEN_METADATA_KEY_FRAGMENTS = [
  "password",
  "token",
  "secret",
  "magiclink",
  "magic_link",
  "session",
  "jwt",
  "authorization",
  "bearer",
  "cookie",
];

export type AuditMetadata = Record<string, unknown>;

export interface AuditEventInput {
  actorUserId?: string | null;
  targetUserId?: string | null;
  eventType: AuditEventType;
  severity?: AuditSeverity;
  // Pass the incoming Request (or a Headers-like object) so we can extract
  // IP + user-agent. Optional — flows without a request (cron, server scripts)
  // can omit it.
  request?: { headers: Headers } | Headers;
  metadata?: AuditMetadata;
}

// Extract the IP address from standard proxy headers. Returns `null` if no
// trusted header is present — we never fall back to direct socket inspection
// because every prod deploy of this app is behind Vercel/Edge proxies.
export function extractIp(req: AuditEventInput["request"]): string | null {
  if (!req) return null;
  const h = "headers" in req ? req.headers : req;
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip");
}

// SHA-256(ip + secret). The secret is read from env so an attacker who
// gets a DB dump cannot brute-force the IP space (4 billion IPv4 hashes
// are otherwise trivial). If the secret is unset (local dev), we still
// hash — without the salt — so we never accidentally store the raw IP.
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const secret = process.env.AUDIT_IP_HASH_SECRET ?? "";
  return createHash("sha256").update(`${ip}:${secret}`).digest("hex");
}

function extractUserAgent(req: AuditEventInput["request"]): string | null {
  if (!req) return null;
  const h = "headers" in req ? req.headers : req;
  const ua = h.get("user-agent");
  if (!ua) return null;
  // UA strings are bounded by browsers, but cap defensively against a custom
  // client that sends a megabyte of garbage.
  return ua.slice(0, 512);
}

// Walk the metadata object and strip any key whose name looks like a
// secret. Values aren't inspected for content because legitimate IDs and
// emails could share characters with secrets; we only filter by key shape.
// Returns a *new* object so the caller's input is never mutated.
export function sanitizeMetadata(meta: AuditMetadata | undefined): AuditMetadata {
  if (!meta || typeof meta !== "object") return {};
  const out: AuditMetadata = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase().replace(/[^a-z]/g, "");
    if (FORBIDDEN_METADATA_KEY_FRAGMENTS.some((f) => lower.includes(f))) {
      out[key] = "[redacted]";
      continue;
    }
    if (value === null || value === undefined) {
      out[key] = value;
      continue;
    }
    // Recursively sanitize nested objects but not arrays (arrays of IDs are
    // common and safe). Numbers, strings, booleans pass through.
    if (typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeMetadata(value as AuditMetadata);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function serializeMetadata(meta: AuditMetadata): string | null {
  const sanitized = sanitizeMetadata(meta);
  if (Object.keys(sanitized).length === 0) return null;
  let serialized: string;
  try {
    serialized = JSON.stringify(sanitized);
  } catch {
    // Circular ref or other JSON failure — never lose the event over it.
    return JSON.stringify({ _meta_error: "serialize_failed" });
  }
  if (serialized.length > MAX_METADATA_BYTES) {
    // Wrap the truncated payload as a fresh, valid JSON object so anyone
    // parsing audit rows later doesn't have to special-case malformed JSON.
    // We keep a prefix of the original for forensic value, capped so the
    // whole envelope still fits under the cap.
    return JSON.stringify({
      _truncated: true,
      _original_length: serialized.length,
      _head: serialized.slice(0, MAX_METADATA_BYTES - 200),
    });
  }
  return serialized;
}

// Fire-and-forget audit write. Never throws; on failure, logs to the server
// console so the issue is visible in Vercel logs. Returns `true` on success
// so tests can assert behavior; callers can ignore the return value.
export async function auditEvent(input: AuditEventInput): Promise<boolean> {
  try {
    const ip = extractIp(input.request);
    const ipHash = hashIp(ip);
    const userAgent = extractUserAgent(input.request);
    const metadataJson = input.metadata
      ? serializeMetadata(input.metadata)
      : null;

    await db.insert(auditEvents).values({
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      eventType: input.eventType,
      severity: input.severity ?? "info",
      ipHash,
      userAgent,
      metadataJson,
    });
    return true;
  } catch (err) {
    // Best-effort: do not propagate. Log so we see it in Vercel logs.
    console.warn(
      "[audit] insert failed; event was not recorded",
      input.eventType,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}
