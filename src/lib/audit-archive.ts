// Pseudonymized export of audit rows for off-platform archival.
//
// The retention policy keeps `audit_event` rows hot in Postgres for 365 days
// and archives older rows to a CSV held in the program's institutional
// document store. That CSV crosses a trust boundary: it leaves the database
// where the identified `user` table lives and lands in a file store. So the
// export is de-identified at the boundary, per
// docs/privacy/pseudonymization-standard.md:
//
//   * Rows are keyed by the opaque `user.id` UUID only. This module's input
//     type is `AuditEvent`, which has no name, email, or phone field — so no
//     accidental join can widen the export without a type error.
//   * `ip_hash` is already SHA-256(ip + AUDIT_IP_HASH_SECRET). The secret is
//     NOT exported and stays in Vercel env, which is what keeps the archive
//     pseudonymous rather than merely obfuscated.
//   * `user_agent` is reduced to browser + OS family. Full UA strings are a
//     fingerprinting vector and their version detail has no forensic value
//     once the row is a year old.
//   * Email-shaped substrings are stripped from metadata. Call sites pass
//     booleans and IDs rather than addresses, and `sanitizeMetadata()` in
//     audit.ts filters by key name — but that is a review-enforced
//     convention, not a mechanical guarantee, so the export re-checks the
//     values on the way out.

import type { AuditEvent } from "@/db/schema";

export const ARCHIVE_COLUMNS = [
  "id",
  "created_at",
  "event_type",
  "severity",
  "actor_user_id",
  "target_user_id",
  "ip_hash",
  "user_agent",
  "metadata_json",
] as const;

export type ArchiveColumn = (typeof ARCHIVE_COLUMNS)[number];
export type ArchiveRow = Record<ArchiveColumn, string>;

// Ordered longest-match-first: Edge's UA contains "Chrome", and Chrome's
// contains "Safari", so the specific families must be tested before the
// generic ones.
const BROWSER_FAMILIES: ReadonlyArray<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//i, "Edge"],
  [/\bOPR\/|\bOpera\//i, "Opera"],
  [/\bChrome\/|\bCriOS\//i, "Chrome"],
  [/\bFirefox\/|\bFxiOS\//i, "Firefox"],
  [/\bSafari\//i, "Safari"],
];

const OS_FAMILIES: ReadonlyArray<[RegExp, string]> = [
  [/\bWindows\b/i, "Windows"],
  [/\biPhone\b|\biPad\b|\biPhone OS\b|\biOS\b/i, "iOS"],
  [/\bAndroid\b/i, "Android"],
  [/\bMac OS X\b|\bMacintosh\b/i, "macOS"],
  [/\bLinux\b|\bX11\b/i, "Linux"],
];

// Reduce a user-agent string to "<browser> on <os>", discarding versions and
// every other fingerprintable token. Returns null for a null input.
export function normalizeUserAgent(ua: string | null | undefined): string | null {
  if (ua === null || ua === undefined) return null;
  const browser = BROWSER_FAMILIES.find(([re]) => re.test(ua))?.[1] ?? "other";
  const os = OS_FAMILIES.find(([re]) => re.test(ua))?.[1] ?? "unknown";
  return `${browser} on ${os}`;
}

// Defence in depth: replace anything address-shaped with a marker so a
// metadata value can never carry an identifier out of the database.
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function scrubMetadata(metadataJson: string | null | undefined): string {
  if (!metadataJson) return "";
  return metadataJson.replace(EMAIL_PATTERN, "[redacted-email]");
}

// Map one audit row to its archive representation. Null columns become empty
// strings so the CSV has a uniform shape.
export function toArchiveRow(event: AuditEvent): ArchiveRow {
  return {
    id: event.id,
    created_at: event.createdAt.toISOString(),
    event_type: event.eventType,
    severity: event.severity,
    actor_user_id: event.actorUserId ?? "",
    target_user_id: event.targetUserId ?? "",
    ip_hash: event.ipHash ?? "",
    user_agent: normalizeUserAgent(event.userAgent) ?? "",
    metadata_json: scrubMetadata(event.metadataJson),
  };
}

// RFC 4180 field escaping.
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(events: readonly AuditEvent[]): string {
  const lines = [ARCHIVE_COLUMNS.join(",")];
  for (const event of events) {
    const row = toArchiveRow(event);
    lines.push(ARCHIVE_COLUMNS.map((c) => escapeCsvField(row[c])).join(","));
  }
  return lines.join("\n") + "\n";
}
