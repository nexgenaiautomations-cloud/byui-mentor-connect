import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { auditEvents, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

const SEVERITY_TONE: Record<string, string> = {
  info: "bg-slate-100 text-slate-700",
  warning: "bg-amber-100 text-amber-800",
  critical: "bg-rose-100 text-rose-800",
};

const DEFAULT_LIMIT = 100;

// /admin/audit
// Read-only listing of the append-only audit log. Admin-only (the page-level
// redirect protects against accidental clicks; the API behind it also calls
// requireAdmin so a direct fetch is gated too).
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ eventType?: string; severity?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const filterType = params.eventType?.trim() || null;
  const filterSeverity = params.severity?.trim() || null;

  const actor = alias(users, "actor_u");
  const target = alias(users, "target_u");

  const validSeverity =
    filterSeverity === "info" ||
    filterSeverity === "warning" ||
    filterSeverity === "critical"
      ? filterSeverity
      : null;
  // The enum type for eventType is narrow; we apply the filter via raw equality
  // only if it matches one of the known enum strings. Anything else is ignored.
  const knownTypes = auditEvents.eventType.enumValues as readonly string[];
  const validType = filterType && knownTypes.includes(filterType) ? filterType : null;

  // Drizzle returns the column with the enum literal type; the cast tells TS
  // we already validated against the enum membership above.
  const conds = [];
  if (validType) {
    conds.push(
      eq(
        auditEvents.eventType,
        validType as typeof auditEvents.eventType.enumValues[number]
      )
    );
  }
  if (validSeverity) conds.push(eq(auditEvents.severity, validSeverity));

  const rows = await db
    .select({
      id: auditEvents.id,
      createdAt: auditEvents.createdAt,
      eventType: auditEvents.eventType,
      severity: auditEvents.severity,
      actorUserId: auditEvents.actorUserId,
      actorEmail: actor.email,
      targetUserId: auditEvents.targetUserId,
      targetEmail: target.email,
      ipHash: auditEvents.ipHash,
      metadataJson: auditEvents.metadataJson,
    })
    .from(auditEvents)
    .leftJoin(actor, eq(actor.id, auditEvents.actorUserId))
    .leftJoin(target, eq(target.id, auditEvents.targetUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(DEFAULT_LIMIT);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black text-byui-blue-dark sm:text-3xl">
          Audit log
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Append-only record of admin and security-sensitive actions. Showing the
          most recent {DEFAULT_LIMIT} events. UPDATE and DELETE on this table are
          blocked at the database layer by Row-Level Security.
        </p>
      </header>

      <form method="get" className="flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-700">
          Event type
          <select
            name="eventType"
            defaultValue={filterType ?? ""}
            className="mt-1 block min-w-[14rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {knownTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Severity
          <select
            name="severity"
            defaultValue={filterSeverity ?? ""}
            className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-byui-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-byui-blue-dark cursor-pointer"
        >
          Filter
        </button>
        <a
          href="/admin/audit"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Clear
        </a>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold text-slate-700">When</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Event</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Severity</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Actor</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Target</th>
              <th className="px-3 py-2 font-semibold text-slate-700">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={6}>
                  No audit events match the current filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                    {r.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-byui-blue-dark">
                    {r.eventType}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        SEVERITY_TONE[r.severity] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {r.actorEmail || (r.actorUserId ? r.actorUserId : "—")}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {r.targetEmail || (r.targetUserId ? r.targetUserId : "—")}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-slate-500">
                      {r.metadataJson ?? ""}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
