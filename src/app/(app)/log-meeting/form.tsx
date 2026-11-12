"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  groupsForRole,
  celebrationKind,
  type CelebrationKind,
} from "@/lib/possible-actions";
import {
  AchievementToast,
  fireConfetti,
  OfferCelebration,
  type TrophyToast,
} from "@/components/celebration";
import { DictationButton } from "@/components/dictation-button";
import { suggestAccomplishments } from "@/lib/dictation";
import { useClientValue } from "@/lib/use-client-value";

type LogKind = "mentor_meeting" | "touchpoint" | "independent_activity";

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver";
  } catch {
    return "America/Denver";
  }
}

// What the log is. Mentors log meetings or quick touchpoints; members log
// their own activity, or (when they have a mentor) a meeting/touchpoint.
// Only meetings and touchpoints count as mentor engagement.
const KIND_OPTIONS: Record<"mentor" | "mentee", { value: LogKind; label: string; hint: string }[]> = {
  mentor: [
    { value: "mentor_meeting", label: "Meeting", hint: "You met (in person, video or phone)" },
    { value: "touchpoint", label: "Touchpoint", hint: "Quick call, message or check-in" },
  ],
  mentee: [
    { value: "independent_activity", label: "On my own", hint: "Something you did yourself" },
    { value: "mentor_meeting", label: "Met my mentor", hint: "You and your mentor met" },
    { value: "touchpoint", label: "Mentor touchpoint", hint: "Quick call, message or check-in" },
  ],
};

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
  const mentorMatches = isMentor ? props.matches : null;
  const matches = useMemo(() => mentorMatches ?? [], [mentorMatches]);
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
  const [nextTime, setNextTime] = useState("");
  const hasMentor = isMentor || (props.mode === "mentee" && props.hasMentor);
  const [kind, setKind] = useState<LogKind>(isMentor ? "mentor_meeting" : "independent_activity");
  const isInteraction = kind !== "independent_activity";
  // The browser's zone, so a meeting time means what the user meant.
  const timeZone = useClientValue(browserTimeZone, "America/Denver");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newlyEarned, setNewlyEarned] = useState<
    { key: string; title: string }[]
  >([]);
  // Achievement toast surfaces *all* newly-earned trophies in a single
  // Xbox-style banner. Cleared when the toast auto-dismisses.
  const [toastTrophies, setToastTrophies] = useState<TrophyToast[]>([]);
  // Offer celebration: trophy pop (internship), fireworks (part-time) or
  // the "HIRED!" seal (full-time). Null when nothing is playing.
  const [celebration, setCelebration] = useState<CelebrationKind | null>(null);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === matchId),
    [matches, matchId]
  );

  // Role-aware label groups. Mentees see "Worked on my resume", mentors see
  // "Helped with resumes" — same stable key under the hood.
  const roleGroups = useMemo(
    () => groupsForRole(isMentor ? "mentor" : "mentee"),
    [isMentor]
  );

  function toggle(action: string) {
    setAccomplishments((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  }

  const allLabels = useMemo(() => roleGroups.flatMap((g) => g.options), [roleGroups]);
  const suggestions = useMemo(
    () => suggestAccomplishments(actions, isMentor ? "mentor" : "mentee", allLabels, accomplishments),
    [actions, isMentor, allLabels, accomplishments]
  );

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
    const offerKind = celebrationKind(checked);
    const durationNum = duration ? Number(duration) : null;
    const payload: Record<string, unknown> = {
      activityDate: date,
      accomplishments: checked,
      meetingType: meetingType || null,
      durationMinutes: durationNum,
      actionItems: actions || null,
      nextMeetingDate: isInteraction && next ? next : null,
      nextMeetingTime: isInteraction && next && nextTime ? nextTime : null,
      nextMeetingTimezone: isInteraction && next ? timeZone : null,
      eventKind: kind,
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
    const earned: { key: string; title: string }[] = body.newlyEarned ?? [];
    setNewlyEarned(earned);
    setSaved(true);
    setSubmitting(false);
    setConfirmOpen(false);
    setAccomplishments(new Set());
    setActions("");
    setNext("");
    setNextTime("");
    if (!isMentor) setKind("independent_activity");
    setMeetingType("");
    setDuration("");
    // Offers get their own celebration (with its own confetti); every other
    // submission gets the small default burst.
    if (offerKind) setCelebration(offerKind);
    else void fireConfetti();
    // Xbox-style trophy toast when a new achievement was earned.
    if (earned.length > 0) {
      setToastTrophies(
        earned.map((t) => ({ key: t.key, title: t.title }))
      );
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
      <AchievementToast
        trophies={toastTrophies}
        onDismiss={() => setToastTrophies([])}
      />
      <OfferCelebration kind={celebration} onDone={() => setCelebration(null)} />
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
                    className="h-10 w-10 shrink-0 rounded-full border border-brand-light/40 object-cover"
                  />
                  <p className="text-sm font-medium text-slate-700">
                    {selectedMatch.menteeMajor || (
                      <span className="text-slate-500">Major not listed</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {hasMentor && (
          <fieldset>
            <legend className="label">{isMentor ? "What happened?" : "Who was involved?"}</legend>
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
              {KIND_OPTIONS[isMentor ? "mentor" : "mentee"].map((o) => {
                const on = kind === o.value;
                return (
                  <label
                    key={o.value}
                    className={
                      "flex min-h-[44px] cursor-pointer flex-col rounded-lg border px-3 py-2 transition focus-within:ring-2 focus-within:ring-plum-500 " +
                      (on
                        ? "border-brand bg-brand/10 text-brand-dark"
                        : "border-slate-200 bg-white text-slate-700 hover:border-plum-200 hover:bg-plum-50")
                    }
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="radio"
                        name="log-kind"
                        value={o.value}
                        checked={on}
                        onChange={() => setKind(o.value)}
                        className="h-4 w-4 cursor-pointer accent-brand"
                      />
                      {o.label}
                    </span>
                    <span className="pl-6 text-[11px] text-slate-600">{o.hint}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {isMentor || isInteraction ? (
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
                Type <span className="font-normal text-slate-500">(optional)</span>
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
                <span className="font-normal text-slate-500">(optional)</span>
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
        ) : (
          // Mentees report independent work — Type and Duration don't apply
          // (they're meeting-specific). Just an activity date.
          <div className="max-w-xs">
            <label className="label">Activity date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        )}

        <fieldset className="space-y-4">
          <legend className="label">
            {isMentor ? "Discussion topics" : "What you worked on"}
          </legend>
          <p className="-mt-1 text-xs text-slate-500">
            {isMentor
              ? "Check anything you covered together. Each section maps to one of the ICAN program goals."
              : "Check anything you worked on. Each section maps to one of the ICAN program goals."}
          </p>
          {roleGroups.map((group) => (
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
            {isMentor ? "Action items" : "Other activity"}{" "}
            <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="log-notes"
            rows={3}
            className="input"
            placeholder={
              isMentor
                ? "What's the mentee doing before next time?"
                : "Add anything else you worked on or want to remember."
            }
            value={actions}
            onChange={(e) => setActions(e.target.value)}
          />
          <div className="mt-2">
            <DictationButton value={actions} onChange={setActions} />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-2 rounded-lg border border-plum-100 bg-plum-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-plum-800">
                Did you also do any of these? Tap to check — nothing is added unless you choose it.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    className="min-h-[32px] rounded-full border border-plum-200 bg-white px-3 py-1 text-xs font-medium text-plum-700 transition hover:bg-plum-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-plum-500"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Please don&apos;t record grades, health information, financial
            details, or other sensitive info — keep notes focused on
            career and mentorship.
          </p>
        </div>

        {isInteraction && (
          <div>
            <p className="label">
              Next meeting{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="next-date" className="text-xs font-medium text-slate-600">Date</label>
                <input
                  id="next-date"
                  type="date"
                  className="input"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="next-time" className="text-xs font-medium text-slate-600">
                  Time <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="next-time"
                  type="time"
                  className="input"
                  value={nextTime}
                  disabled={!next}
                  onChange={(e) => setNextTime(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {next
                ? nextTime
                  ? `You'll both get a reminder the day before and an hour before (${timeZone.replace(/_/g, " ")} time).`
                  : "You'll both get a reminder the day before. Add a time for an hour-before reminder too."
                : "Add a date and ICAN will remind you both before you meet."}
            </p>
          </div>
        )}

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
            {isMentor ? "Log meeting" : "Log activity"}
          </button>
        </div>
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden
            onClick={() => !submitting && setConfirmOpen(false)}
            className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-log-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-brand sm:p-6"
          >
            <button
              type="button"
              onClick={() => !submitting && setConfirmOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer disabled:opacity-40"
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

            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
              Review
            </p>
            <h2
              id="confirm-log-title"
              className="mt-1 font-display text-xl font-black leading-tight text-brand-dark"
            >
              {isMentor ? "Confirm Meeting" : "Confirm Activity Log"}
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
              {hasMentor && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Kind
                  </dt>
                  <dd className="mt-0.5 text-slate-800">
                    {KIND_OPTIONS[isMentor ? "mentor" : "mentee"].find((o) => o.value === kind)?.label}
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
                    {isMentor ? "Action Items" : "Other Activity"}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">
                    {actions}
                  </dd>
                </div>
              )}
              {isInteraction && next && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Next Meeting
                  </dt>
                  <dd className="mt-0.5 text-slate-800">
                    {new Date(`${next}T12:00:00`).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    {nextTime ? ` at ${nextTime}` : ""}
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
                className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
    <div className="rounded-xl border border-brand-light/40 bg-slate-50 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-dark">
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
                  ? "bg-brand/10 text-brand-dark ring-1 ring-brand/40"
                  : "text-slate-700 hover:bg-white")
              }
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(a)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand"
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
