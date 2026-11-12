import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import {
  ISSUE_CATEGORIES,
  acknowledgementSummary,
  categoryLabel,
  isIssueCategory,
  isIssueStatus,
} from "@/lib/issues";
import {
  listAdmins,
  listIssuesNewestFirst,
  listReceipts,
} from "@/lib/issues-server";
import { IssueActions } from "./issue-actions";

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-100 text-amber-900",
  addressed: "bg-emerald-100 text-emerald-900",
};

function fmt(d: Date) {
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Denver",
  });
}

// /admin/issues: every reported issue, newest first, with the per-admin
// acknowledgement record (docs/specs/admin-issue-reports.md).
export default async function AdminIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");

  const params = await searchParams;
  const category = params.category && isIssueCategory(params.category) ? params.category : null;
  const status = params.status && isIssueStatus(params.status) ? params.status : null;

  const [allIssues, receipts, admins] = await Promise.all([
    listIssuesNewestFirst(adminScopeFor(me)!),
    listReceipts(adminScopeFor(me)!),
    listAdmins(adminScopeFor(me)!),
  ]);
  const issues = allIssues.filter(
    (i) => (!category || i.category === category) && (!status || i.status === status)
  );
  const adminName = new Map(admins.map((a) => [a.id, a.name ?? a.email]));
  for (const r of receipts) {
    if (!adminName.has(r.adminId)) adminName.set(r.adminId, r.adminName ?? r.adminEmail ?? "Former admin");
  }
  const openCount = allIssues.filter((i) => i.status === "open").length;
  const unseenByMe = allIssues.filter(
    (i) => !receipts.some((r) => r.issueId === i.id && r.adminId === me.id)
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-black text-brand-dark sm:text-3xl">
          Reported issues
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Every issue reported in ICAN (IT, mentor, mentee, or other), newest
          first. Each issue is emailed to every admin and pops up until every
          admin confirms they have seen it. Each confirmation is recorded with the
          time.
        </p>
        <p className="mt-2 text-sm font-semibold text-slate-800">
          {openCount} open · {allIssues.length} total
          {unseenByMe > 0 && ` · ${unseenByMe} you haven't acknowledged`}
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-700">
          Category
          <select
            name="category"
            defaultValue={category ?? ""}
            className="mt-1 block min-h-10 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
          >
            <option value="">All categories</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Status
          <select
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 block min-h-10 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="addressed">Addressed</option>
          </select>
        </label>
        <button
          type="submit"
          className="min-h-10 cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Filter
        </button>
        {(category || status) && (
          <a
            href="/admin/issues"
            className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Clear
          </a>
        )}
      </form>

      {issues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-slate-800">
            {allIssues.length === 0 ? "No issues have been reported." : "No issues match these filters."}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Reports from the &ldquo;Report an issue&rdquo; button will show up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {issues.map((i) => {
            const { seen, notSeen } = acknowledgementSummary(i.id, admins, receipts);
            const iHaveSeen = seen.some((r) => r.adminId === me.id);
            const role = !i.reporterId
              ? "Deleted user"
              : i.reporterIsAdmin
                ? "Admin"
                : i.reporterIsMentor
                  ? "Mentor"
                  : "Member";
            return (
              <li
                key={i.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-light/30 px-2.5 py-0.5 text-xs font-bold text-brand-dark">
                    {categoryLabel(i.category)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_TONE[i.status] ?? "bg-slate-100 text-slate-800"}`}
                  >
                    {i.status === "addressed" ? "Addressed" : "Open"}
                  </span>
                  <span className="ml-auto text-xs text-slate-600">{fmt(i.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {i.reporterName ?? i.reporterEmail ?? "Deleted user"}
                  </span>
                  {i.reporterEmail && i.reporterName ? ` · ${i.reporterEmail}` : ""} · {role}
                </p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
                  {i.message}
                </p>

                {i.status === "addressed" && (
                  <p className="mt-3 text-sm text-emerald-900">
                    Addressed by{" "}
                    <strong>{(i.addressedById && adminName.get(i.addressedById)) ?? "a former admin"}</strong>
                    {i.addressedAt ? ` on ${fmt(i.addressedAt)}` : ""}
                    {i.resolutionNote ? `: ${i.resolutionNote}` : ""}
                  </p>
                )}

                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-bold uppercase tracking-wider text-slate-600">
                      Seen by ({seen.length})
                    </p>
                    {seen.length === 0 ? (
                      <p className="mt-1 text-slate-600">No admin yet</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-slate-800">
                        {seen.map((r) => (
                          <li key={r.adminId}>
                            {adminName.get(r.adminId)} · {fmt(r.seenAt)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-bold uppercase tracking-wider text-slate-600">
                      Not yet seen by ({notSeen.length})
                    </p>
                    {notSeen.length === 0 ? (
                      <p className="mt-1 text-emerald-800">Every admin has seen this</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-rose-800">
                        {notSeen.map((a) => (
                          <li key={a.id}>{a.name ?? a.email}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {(!iHaveSeen || i.status !== "addressed") && (
                  <IssueActions
                    issueId={i.id}
                    canMarkSeen={!iHaveSeen}
                    canMarkAddressed={i.status !== "addressed"}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
