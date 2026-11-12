import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { adminScopeFor } from "@/lib/admin-scope";
import { assignableStaff, caseEvents, interventionCounts, listCases } from "@/lib/interventions-server";
import { getThresholds } from "@/lib/program-settings-server";
import { RISK_LABEL, STATUS_LABEL, type InterventionStatus, type RiskReason } from "@/lib/interventions";
import { DAY_MS } from "@/lib/engagement";
import { StatTile } from "@/components/stat-card";
import { SettingsForm } from "@/components/settings-form";
import { CasePanel, RefreshRiskButton } from "./case-panel";

export const dynamic = "force-dynamic";

type Search = Record<string, string | undefined>;

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "mine", label: "Assigned to me" },
  { value: "closed", label: "Resolved & closed" },
  { value: "all", label: "All" },
] as const;

const STATUS_PILL: Record<string, string> = {
  new: "bg-rose-100 text-rose-800 border-rose-200",
  reviewing: "bg-amber-100 text-amber-900 border-amber-200",
  contacted: "bg-sky-100 text-sky-900 border-sky-200",
  awaiting_response: "bg-violet-100 text-violet-900 border-violet-200",
  resolved: "bg-emerald-100 text-emerald-900 border-emerald-200",
  closed: "bg-slate-100 text-slate-700 border-slate-200",
};

const THRESHOLD_FIELDS = [
  { key: "firstMeetingNudgeDays", label: "First-meeting nudge", hint: "Days after matching with no meeting", min: 1, max: 90, suffix: "days" },
  { key: "checkInNudgeDays", label: "Check-in nudge", hint: "Days without interaction", min: 1, max: 180, suffix: "days" },
  { key: "concernNudgeDays", label: "Concern nudge", hint: "Days without interaction", min: 1, max: 365, suffix: "days" },
  { key: "adminAttentionDays", label: "Open a case after", hint: "Days without interaction", min: 1, max: 365, suffix: "days" },
  { key: "noFirstMeetingRiskDays", label: "No first meeting — open a case after", min: 1, max: 180, suffix: "days" },
  { key: "unansweredReminders", label: "Unanswered reminders", hint: "Reminders sent since last interaction", min: 1, max: 20 },
  { key: "lowRatingMax", label: "Low satisfaction at or below", hint: "Mentee monthly rating (1–5)", min: 1, max: 4 },
  { key: "stalledActionDays", label: "Action items stalled after", min: 1, max: 180, suffix: "days" },
  { key: "expectedMeetingIntervalDays", label: "Expected meeting cadence", hint: "Used for health and cadence charts", min: 1, max: 120, suffix: "days" },
];

function daysAgo(d: Date | null, now: Date) {
  if (!d) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY_MS));
}

export default async function InterventionCenterPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/dashboard");
  const params = await searchParams;
  const scope = adminScopeFor(me, params.school)!;
  const view = VIEWS.some((v) => v.value === params.view) ? (params.view as (typeof VIEWS)[number]["value"]) : "open";
  const now = new Date();

  const [cases, counts, staff, thresholds] = await Promise.all([
    listCases({
      school: scope.school,
      status: view === "mine" ? "open" : view,
      assignedTo: view === "mine" ? me.id : undefined,
    }),
    interventionCounts(scope.school),
    assignableStaff(scope.school),
    getThresholds(scope.school),
  ]);
  const events = await caseEvents(cases.map((c) => c.id));
  const eventsByCase = new Map<string, typeof events>();
  for (const e of events) eventsByCase.set(e.interventionId, [...(eventsByCase.get(e.interventionId) ?? []), e]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Accountability</p>
          <h1 className="mt-1 font-display text-2xl font-black text-plum-800 sm:text-3xl">Intervention Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Mentorships that may need a hand, based on real meetings and check-ins — not students&apos; independent activity.
            {scope.platform ? ` Showing ${scope.school ?? "all schools"}.` : ""}
          </p>
        </div>
        <RefreshRiskButton />
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(["new", "reviewing", "contacted", "awaiting_response", "resolved", "closed"] as InterventionStatus[]).map((s) => (
          <StatTile
            key={s}
            label={STATUS_LABEL[s]}
            value={counts[s] ?? 0}
            tone={s === "new" ? "rose" : s === "resolved" ? "emerald" : s === "closed" ? "slate" : "navy"}
          />
        ))}
      </section>

      <nav aria-label="Case views" className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={`/admin/interventions?view=${v.value}${params.school ? `&school=${encodeURIComponent(params.school)}` : ""}`}
            aria-current={view === v.value ? "page" : undefined}
            className={
              "inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-semibold transition cursor-pointer " +
              (view === v.value ? "bg-plum-700 text-white" : "text-plum-700 hover:bg-plum-50")
            }
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {cases.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="font-display text-lg font-bold text-plum-800">
            {view === "open" ? "No mentorships need attention right now" : "Nothing here"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Cases open automatically each morning when a pair crosses a risk threshold below, or when you run the risk check.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {cases.map((c) => {
            const lastSeen = daysAgo(c.lastInteractionAt, now);
            const trail = eventsByCase.get(c.id) ?? [];
            const reasons = c.reasons as RiskReason[];
            const outreachRecent = c.lastOutreachAt && now.getTime() - c.lastOutreachAt.getTime() < 2 * DAY_MS;
            return (
              <li key={c.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-plum-800">
                      {c.studentName ?? "Student"} <span className="font-normal text-slate-500">with mentor</span> {c.mentorName ?? "Mentor"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Matched {c.startedAt.toLocaleDateString()} · {c.meetingCount} meeting{c.meetingCount === 1 ? "" : "s"} ·{" "}
                      {lastSeen === null ? "never interacted" : `last interaction ${lastSeen} day${lastSeen === 1 ? "" : "s"} ago`}
                      {c.matchStatus !== "active" ? ` · match ${c.matchStatus}` : ""}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_PILL[c.status] ?? STATUS_PILL.closed}`}>
                    {STATUS_LABEL[c.status as InterventionStatus] ?? c.status}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reasons.length === 0 ? (
                    <span className="pill-accepted">Risk cleared — consider resolving</span>
                  ) : (
                    reasons.map((r) => (
                      <span key={r} className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                        {RISK_LABEL[r] ?? r}
                      </span>
                    ))
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="font-semibold text-slate-500">Owner</dt>
                    <dd className="text-slate-800">{c.assignedToName ?? "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Last reminder</dt>
                    <dd className="text-slate-800">{c.lastReminderAt ? c.lastReminderAt.toLocaleDateString() : "None sent"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Last outreach</dt>
                    <dd className={outreachRecent ? "font-semibold text-amber-800" : "text-slate-800"}>
                      {c.lastOutreachAt ? `${c.lastOutreachAt.toLocaleDateString()} by ${c.lastOutreachByName ?? "an admin"}` : "None yet"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500">Follow up</dt>
                    <dd className="text-slate-800">{c.followUpOn ? c.followUpOn.toISOString().slice(0, 10) : "—"}</dd>
                  </div>
                </dl>

                <details className="mt-2">
                  <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-sm font-semibold text-plum-700">
                    Manage case
                  </summary>
                  <CasePanel
                    id={c.id}
                    status={c.status as InterventionStatus}
                    assignedToId={c.assignedToId}
                    followUpOn={c.followUpOn ? c.followUpOn.toISOString().slice(0, 10) : null}
                    staff={staff}
                    studentEmail={c.studentEmail}
                    mentorEmail={c.mentorEmail}
                  />
                  {trail.length > 0 && (
                    <ol className="mt-3 space-y-1 border-l-2 border-plum-100 pl-3 text-xs text-slate-700" aria-label="Case history">
                      {trail.map((e) => (
                        <li key={e.id}>
                          <span className="text-slate-500">{e.createdAt.toLocaleString()}</span> ·{" "}
                          <strong>{e.actorName ?? "System"}</strong> {e.action.replace(/_/g, " ")}
                          {e.toStatus ? ` → ${STATUS_LABEL[e.toStatus as InterventionStatus] ?? e.toStatus}` : ""}
                          {e.note ? <span className="text-slate-600"> — {e.note}</span> : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <details className="card">
        <summary className="cursor-pointer font-display text-base font-bold text-plum-800">Risk and reminder thresholds</summary>
        <p className="mt-1 text-xs text-slate-600">
          {scope.platform && !scope.school
            ? "Editing the default every school inherits."
            : `Applies to ${scope.school}. Leave a value unchanged to keep the program default.`}
        </p>
        <div className="mt-4">
          <SettingsForm settingKey="thresholds" fields={THRESHOLD_FIELDS} initial={thresholds} school={scope.platform ? scope.school ?? undefined : undefined} />
        </div>
      </details>
    </div>
  );
}
