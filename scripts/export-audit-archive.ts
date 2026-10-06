// Quarterly pseudonymized audit-log archive.
//
// Usage:
//   npx tsx scripts/export-audit-archive.ts [--older-than-days=365] [--out=FILE] [--dry-run]
//   npm run audit:archive -- --dry-run
//
// Implements step 2 of the audit-log retention rules in
// docs/security/retention-policy.md, de-identified per
// docs/privacy/pseudonymization-standard.md.
//
// THIS SCRIPT NEVER DELETES ANYTHING. It reads rows older than the cutoff and
// writes them to a CSV. Removing rows from the hot table requires head-admin
// approval and a documented reason (retention policy, step 3), and Postgres
// RLS blocks DELETE on `audit_event` outright.
//
// The exported CSV is pseudonymous, not anonymous: rows carry the opaque
// `user.id` UUID, and the AUDIT_IP_HASH_SECRET that would let anyone
// re-derive an IP is deliberately NOT exported — it stays in Vercel env.
// Treat the CSV as restricted and store it admin-only.
import "./load-env"; // must precede the db client import — see load-env.ts
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { asc, lt } from "drizzle-orm";
import { db } from "../src/db/client";
import { auditEvents } from "../src/db/schema";
import { toCsv } from "../src/lib/audit-archive";

function parseIntArg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.split("=")[1]);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`--${name} must be a non-negative integer`);
    process.exit(1);
  }
  return value;
}

function quarterLabel(d: Date): string {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

async function main() {
  const olderThanDays = parseIntArg("older-than-days", 365);
  const dryRun = process.argv.includes("--dry-run");
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const now = new Date();
  const cutoff = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000);
  const outPath = outArg
    ? outArg.split("=")[1]
    : `audit-archive-${quarterLabel(now)}.csv`;

  console.log(`Cutoff: rows created before ${cutoff.toISOString()}`);
  console.log(`(older than ${olderThanDays} days)\n`);

  const rows = await db
    .select()
    .from(auditEvents)
    .where(lt(auditEvents.createdAt, cutoff))
    .orderBy(asc(auditEvents.createdAt));

  if (rows.length === 0) {
    console.log("No rows older than the cutoff. Nothing to archive.");
    return;
  }

  const csv = toCsv(rows);
  const digest = createHash("sha256").update(csv).digest("hex");
  const first = rows[0].createdAt.toISOString();
  const last = rows[rows.length - 1].createdAt.toISOString();

  console.log("--- archive manifest (record this with the archive) ---");
  console.log(`File:        ${outPath}`);
  console.log(`Rows:        ${rows.length}`);
  console.log(`Date range:  ${first}  ..  ${last}`);
  console.log(`SHA-256:     ${digest}`);
  console.log(`Exported at: ${now.toISOString()}`);
  console.log(`Exported by: ${process.env.USER ?? process.env.USERNAME ?? "unknown"}`);
  console.log("De-identification: opaque user IDs only; no names, emails, or");
  console.log("  phone numbers; IPs hashed (salt not included); user agents");
  console.log("  reduced to browser+OS family; email patterns scrubbed.");
  console.log("------------------------------------------------------\n");

  if (dryRun) {
    console.log("[dry-run] CSV not written.");
    return;
  }

  writeFileSync(outPath, csv, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(
    "\nNext: move this file to the program's institutional document store\n" +
      "with admin-only access, then log the manifest above in the archive\n" +
      "record. Do not leave it on a workstation or in the repository."
  );
}

// Let the process end on its own rather than calling process.exit(), which
// tears down the Neon fetch handle mid-close and makes libuv print an
// assertion failure after an otherwise successful run.
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
