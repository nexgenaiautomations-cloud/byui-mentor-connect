"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ACCOMPLISHMENT_GROUPS,
  CELEBRATION_ACCOMPLISHMENTS,
} from "@/lib/possible-actions";

async function celebrate() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 100,
      startVelocity: 35,
      origin: { y: 0.7 },
    });
  }, 220);
}

type Match = {
  id: string;
  menteeName: string | null;
  menteeImage: string | null;
  menteeMajor: string | null;
};

const MEETING_TYPES = [
  { value: "in_person", label: "In person" },
  { value: "video", label: "Video" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other" },
] as const;

function avatarFor(name: string | null) {
  const seed = encodeURIComponent(name || "Mentee");
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=006EB6&textColor=ffffff`;
}

type MentorProps = {
  mode: "mentor";
  matches: Match[];
  initialMatchId?: string;
  // Controlled override: when present, the form is driven by the parent
  // (used by MentorWorkspace so the activity panel and the form share
  // a single selected mentee).
  selectedMatchId?: string;
  onMatchIdChange?: (id: string) => void;
  // Fires after a successful save so the parent can refresh its own data.
  onSaved?: () => void;
};

type MenteeProps = {
  mode: "mentee";
  hasMentor: boolean;
  onSaved?: () => void;
};

export function LogActivityForm(props: MentorProps | MenteeProps) {
  const router = useRouter();
  const isMentor = props.mode === "mentor";
  const matches = isMentor ? props.matches : [];
  const preselect =
    isMentor && props.initialMatchId && matches.some((m) => m.id === props.initialMatchId)
      ? props.initialMatchId
      : matches[0]?.id ?? "";

  const [internalMatchId, setInternalMatchId] = useState(preselect);
  const isControlled = isMentor && typeof props.selectedMatchId === "string";
  const matchId = isControlled ? (props.selectedMatchId as string) : internalMatchId;
  const setMatchId = (id: string) => {
    if (isControlled && isMentor) props.onMatchIdChange?.(id);
    else setInternalMatchId(id);
  };
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetingType, setMeetingType] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [accomplishments, setAccomplishments] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState("");
  const [next, setNext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newlyEarned, setNewlyEarned] = useState<
    { key: string; title: string }[]
  >([]);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === matchId),
    [matches, matchId]
  );

  function toggle(action: string) {
    setAccomplishments((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  }

  function validate(): string | null {
    if (isMentor && !matchId) return "Please select a mentee.";
    if (!date) return "Please choose an activity date.";
    if (accomplishments.size === 0)
      return "Please check at least one accomplishment.";
    return null;
  }

  function onReview(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setConfirmOpen(true);
  }

  // Lock body scroll while the confirmation modal is open + Escape closes it.
  useEffect(() => {
    if (!confirmOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [confirmOpen]);

  async function onConfirmSubmit() {
    setSubmitting(true);
    setError(null);
    const checked = [...accomplishments];
    const shouldCelebrate = checked.some((a) =>
      (CELEBRATION_ACCOMPLISHMENTS as readonly string[]).includes(a)
    );
    const durationNum = duration ? Number(duration) : null;
    const payload: Record<string, unknown> = {
      activityDate: date,
      accomplishments: checked,
      meetingType: meetingType || null,
      durationMinutes: durationNum,
      actionItems: actions || null,
      nextMeetingDate: next || null,
    };
    if (isMentor) payload.matchId = matchId;
    const res = await fetch("/api/meeting-logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.formErrors?.[0] || "Could not save log");
      setSubmitting(false);
      return;
    }
    const body = await res.json();
    setNewlyEarned(body.newlyEarned ?? []);
    setSaved(true);
    setSubmitting(false);
    setConfirmOpen(false);
    setAccomplishments(new Set());
    setActions("");
    setNext("");
    setMeetingType("");
    setDuration("");
    if (shouldCelebrate || (body.newlyEarned ?? []).length > 0) {
      void celebrate();
    }
    router.refresh();
    props.onSaved?.();
    setTimeout(() => {
      setSaved(false);
      setNewlyEarned([]);
    }, 4500);
  }

  return (
    <>
      <form onSubmit={onReview} className="space-y-5">
        {isMentor && matches.length > 0 && (
          <div>
            <label className="label">Mentee</label>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="input w-auto min-w-[180px] flex-none"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                required
              >
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.menteeName ?? "Mentee"}
                  </option>
                ))}
              </select>
              {selectedMatch && (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      selectedMatch.menteeImage ||
                      avatarFor(selectedMatch.menteeName)
                    }
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full border border-byui-blue-light/40 object-cover"
                  />
                  <p className="text-sm font-medium text-slate-700">
                    {selectedMatch.menteeMajor || (
                      <span className="text-slate-400">Major not listed</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Activity date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">
              Type <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              className="input"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
            >
              <option value="">Select…</option>
              {MEETING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              Duration (min){" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              max={600}
              className="input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="space-y-4">
          <legend className="label">Accomplishments</legend>
          <p className="-mt-1 text-xs text-slate-500">
            Check anything you covered. Each section maps to one of the BYUI
            CAN program goals.
          </p>
          {ACCOMPLISHMENT_GROUPS.map((group) => (
            <AccomplishmentGroupBlock
              key={group.key}
              heading={group.heading}
              options={group.options}
              checked={accomplishments}
              onToggle={toggle}
            />
          ))}
        </fieldset>

        <div>
          <label className="label">
            Action items{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            rows={2}
            className="input"
            placeholder={
              isMentor
                ? "What's the mentee doing before next time?"
                : "What's your next step?"
            }
            value={actions}
            onChange={(e) => setActions(e.target.value)}
          />
        </div>

        <div>
          <label className="label">
            Next meeting{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="date"
            className="input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {saved && (
          <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <p className="font-semibold">Logged ✓</p>
            {newlyEarned.length > 0 && (
              <p className="text-xs">
                🏆 New trophy earned:{" "}
                {newlyEarned.map((a) => a.title).join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button type="submit" disabled={submitting} className="btn-primary">
            Log activity
          </button>
        </div>
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden
            onClick={() => !submitting && setConfirmOpen(false)}
            className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-log-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-byui-blue sm:p-6"
          >
            <button
              type="button"
              onClick={() => !submitting && setConfirmOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer disabled:opacity-40"
              disabled={submitting}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6 18 18M18 6 6 18" />
              </svg>
            </button>

            <p className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
              Review
            </p>
            <h2
              id="confirm-log-title"
              className="mt-1 font-display text-xl font-black leading-tight text-byui-blue-dark"
            >
              Confirm Activity Log
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Please review what you recorded before submitting.
            </p>

            <dl className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1 text-sm">
              {isMentor && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Mentee
                  </dt>
                  <dd className="mt-0.5 text-slate-800">
                    {selectedMatch?.menteeName ?? "—"}
                  </dd>
                </div>
              )}
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Activity Date
                </dt>
                <dd className="mt-0.5 text-slate-800">
                  {date
                    ? new Date(date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
              {meetingType && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Type
                  </dt>
                  <dd className="mt-0.5 text-slate-800">
                    {MEETING_TYPES.find((t) => t.value === meetingType)?.label ??
                      meetingType}
                  </dd>
                </div>
              )}
              {duration && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Duration
                  </dt>
                  <dd className="mt-0.5 text-slate-800">{duration} minutes</dd>
                </div>
              )}
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Accomplishments
                </dt>
                <dd className="mt-0.5 text-slate-800">
                  {accomplishments.size > 0 ? (
                    <ul className="list-disc space-y-0.5 pl-4">
                      {[...accomplishments].map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              {actions.trim() && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Action Items
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">
                    {actions}
                  </dd>
                </div>
              )}
              {next && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Next Meeting
                  </dt>
                  <dd className="mt-0.5 text-slate-800">
                    {new Date(next).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              )}
            </dl>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onConfirmSubmit}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-5 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Saving…" : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AccomplishmentGroupBlock({
  heading,
  options,
  checked,
  onToggle,
}: {
  heading: string;
  options: readonly string[];
  checked: Set<string>;
  onToggle: (s: string) => void;
}) {
  return (
    <div className="rounded-xl border border-byui-blue-light/40 bg-slate-50 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-byui-blue-dark">
        {heading}
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        {options.map((a) => {
          const isChecked = checked.has(a);
          return (
            <label
              key={a}
              className={
                "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs leading-snug transition " +
                (isChecked
                  ? "bg-byui-blue/10 text-byui-blue-dark ring-1 ring-byui-blue/40"
                  : "text-slate-700 hover:bg-white")
              }
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(a)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-byui-blue"
              />
              <span>{a}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Retain the old export name so any stale imports keep compiling.
export const LogMeetingForm = LogActivityForm;
