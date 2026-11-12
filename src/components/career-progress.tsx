"use client";

// Student career journey card (docs/specs/accountability-upgrade.md §4).
// Shows the current stage, recent milestones and a next step, with a small
// inline form to update. Optional fields only; no salary or financial data.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  CAREER_STAGES,
  NEXT_ACTION,
  OPPORTUNITY_LABEL,
  OPPORTUNITY_TYPES,
  STAGE_LABEL,
  currentStage,
  stageIndex,
  stageNeedsOpportunity,
  type CareerStage,
  type OpportunityType,
} from "@/lib/career";

export type MilestoneView = {
  id: string;
  studentId: string;
  stage: string;
  opportunityType: string | null;
  employer: string | null;
  positionTitle: string | null;
  careerField: string | null;
  occurredOn: string; // ISO
  source: string;
  verification: string;
  relatedMilestoneId: string | null;
};

export function CareerProgress({
  milestones,
  applicationsLogged,
}: {
  milestones: MilestoneView[];
  applicationsLogged: number;
}) {
  const router = useRouter();
  const parsed = useMemo(
    () => milestones.map((m) => ({ ...m, occurredOn: new Date(m.occurredOn) })),
    [milestones]
  );
  const stage = currentStage(parsed);
  const idx = stage ? stageIndex(stage) : -1;
  const [open, setOpen] = useState(false);

  return (
    <section className="card" aria-labelledby="career-progress-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Career journey</p>
          <h2 id="career-progress-title" className="mt-0.5 font-display text-lg font-bold text-brand-dark">
            {stage ? STAGE_LABEL[stage] : "Where are you in your search?"}
          </h2>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-outline min-h-[44px]">
          {open ? "Close" : stage ? "Update my status" : "Add my status"}
        </button>
      </div>

      {/* Stage track */}
      <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Career stages">
        {CAREER_STAGES.map((s, i) => {
          const reached = i <= idx;
          const current = i === idx;
          return (
            <li key={s} className="flex flex-col items-center gap-1 text-center">
              <span
                aria-hidden
                className={
                  "h-2 w-full rounded-full " +
                  (current ? "bg-gold-500" : reached ? "bg-plum-600" : "bg-slate-200")
                }
              />
              <span
                className={
                  "hidden text-[10px] leading-tight sm:block " +
                  (current ? "font-bold text-plum-800" : reached ? "text-slate-700" : "text-slate-500")
                }
              >
                {STAGE_LABEL[s]}
              </span>
              <span className="sr-only">
                {STAGE_LABEL[s]}
                {current ? " (current)" : reached ? " (reached)" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 rounded-lg bg-plum-50 px-3 py-2 text-sm text-plum-900">
        <span className="font-semibold">Next step: </span>
        {NEXT_ACTION[stage ?? "none"]}
      </p>

      {applicationsLogged > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          You&apos;ve logged {applicationsLogged} application{applicationsLogged === 1 ? "" : "s"} in your activity log.
        </p>
      )}

      {open && (
        <MilestoneForm
          offers={parsed.filter((m) => m.stage === "offer_received")}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}

      {parsed.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {parsed.slice(0, 4).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-800">
                <strong>{STAGE_LABEL[m.stage as CareerStage] ?? m.stage}</strong>
                {m.opportunityType ? ` · ${OPPORTUNITY_LABEL[m.opportunityType as OpportunityType] ?? m.opportunityType}` : ""}
                {m.employer ? ` · ${m.employer}` : ""}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-600">
                {m.verification === "verified" ? (
                  <span className="pill-accepted">Verified</span>
                ) : m.source === "activity_log" ? (
                  <span className="pill">From activity log</span>
                ) : null}
                {m.occurredOn.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !open && (
          <p className="mt-3 text-sm text-slate-600">
            Nothing yet. Tell ICAN where you are — exploring, applying, interviewing — and your mentor can help with the right next step.
          </p>
        )
      )}
    </section>
  );
}

function MilestoneForm({
  offers,
  onSaved,
}: {
  offers: (Omit<MilestoneView, "occurredOn"> & { occurredOn: Date })[];
  onSaved: () => void;
}) {
  const [stage, setStage] = useState<CareerStage>("exploring");
  const [type, setType] = useState<OpportunityType | "">("");
  const [related, setRelated] = useState("");
  const [employer, setEmployer] = useState("");
  const [title, setTitle] = useState("");
  const [field, setField] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLink = (stage === "offer_accepted" || stage === "started") && offers.length > 0;
  const needsType = stageNeedsOpportunity(stage) && !related;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (needsType && !type) {
      setError("Choose internship, part-time or full-time.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/career", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stage,
        opportunityType: type || null,
        relatedMilestoneId: related || null,
        employer: employer || null,
        positionTitle: title || null,
        careerField: field || null,
        occurredOn: date,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error?.formErrors?.[0] ?? "Couldn't save — please try again.");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-plum-100 bg-white p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cp-stage" className="label">Where are you now?</label>
          <select id="cp-stage" className="input" value={stage} onChange={(e) => setStage(e.target.value as CareerStage)}>
            {CAREER_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cp-date" className="label">When</label>
          <input id="cp-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {canLink && (
        <div>
          <label htmlFor="cp-related" className="label">Which offer?</label>
          <select id="cp-related" className="input" value={related} onChange={(e) => setRelated(e.target.value)}>
            <option value="">A different offer</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {OPPORTUNITY_LABEL[o.opportunityType as OpportunityType] ?? "Offer"}
                {o.employer ? ` — ${o.employer}` : ""} ({o.occurredOn.toLocaleDateString()})
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">Linking keeps the same offer from being counted twice.</p>
        </div>
      )}
      {(needsType || (!stageNeedsOpportunity(stage) && stageIndex(stage) >= stageIndex("applying"))) && (
        <fieldset>
          <legend className="label">
            Type of role {needsType ? "" : <span className="font-normal text-slate-500">(optional)</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {OPPORTUNITY_TYPES.map((t) => (
              <label key={t} className={"inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm " + (type === t ? "border-brand bg-brand/10 text-brand-dark" : "border-slate-200 hover:bg-plum-50")}>
                <input type="radio" name="cp-type" value={t} checked={type === t} onChange={() => setType(t)} className="accent-brand" />
                {OPPORTUNITY_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-plum-700">Add details (optional)</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="cp-field" className="label">Field or industry</label>
            <input id="cp-field" className="input" maxLength={120} value={field} onChange={(e) => setField(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cp-employer" className="label">Employer</label>
            <input id="cp-employer" className="input" maxLength={120} value={employer} onChange={(e) => setEmployer(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cp-title" className="label">Position title</label>
            <input id="cp-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Please don&apos;t add pay or other financial details.</p>
      </details>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary min-h-[44px]">
          {saving ? "Saving…" : "Save update"}
        </button>
      </div>
    </form>
  );
}
