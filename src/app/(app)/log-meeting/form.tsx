"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { POSSIBLE_ACTIONS } from "@/lib/possible-actions";

type Match = {
  id: string;
  menteeName: string | null;
  menteeImage: string | null;
};

export function LogMeetingForm({
  matches,
  initialMatchId,
}: {
  matches: Match[];
  initialMatchId?: string;
}) {
  const router = useRouter();
  const preselect =
    initialMatchId && matches.some((m) => m.id === initialMatchId)
      ? initialMatchId
      : matches[0]?.id ?? "";
  const [matchId, setMatchId] = useState(preselect);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetingType, setMeetingType] = useState("in_person");
  const [duration, setDuration] = useState(30);
  const [accomplishments, setAccomplishments] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState("");
  const [next, setNext] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(action: string) {
    setAccomplishments((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    // Send the selected accomplishments as a single newline-joined string in
    // topicsDiscussed so existing analytics + admin views keep working.
    const topics = [...accomplishments].join(" · ");
    const res = await fetch("/api/meeting-logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matchId,
        meetingDate: date,
        meetingType,
        durationMinutes: duration || null,
        topicsDiscussed: topics || null,
        actionItems: actions || null,
        nextMeetingDate: next || null,
        mentorNotes: notes || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.formErrors?.[0] || "Could not save log");
      setSubmitting(false);
      return;
    }
    setSaved(true);
    setSubmitting(false);
    setAccomplishments(new Set());
    setActions("");
    setNext("");
    setNotes("");
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="label">Mentee</label>
        <select className="input" value={matchId} onChange={(e) => setMatchId(e.target.value)} required>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>{m.menteeName ?? "Mentee"}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Meeting date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
            <option value="in_person">In person</option>
            <option value="video">Video</option>
            <option value="phone">Phone</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Duration (min)</label>
          <input
            type="number"
            min={1}
            max={600}
            className="input"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
      </div>

      <fieldset>
        <legend className="label">Accomplishments</legend>
        <p className="mt-0.5 text-xs text-slate-500">
          Check anything you covered in this meeting.
        </p>
        <div className="mt-2 grid gap-1 rounded-xl border border-byui-blue-light/40 bg-slate-50 p-2 sm:grid-cols-2">
          {POSSIBLE_ACTIONS.map((a) => {
            const checked = accomplishments.has(a);
            return (
              <label
                key={a}
                className={
                  "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs leading-snug transition " +
                  (checked
                    ? "bg-byui-blue/10 text-byui-blue-dark ring-1 ring-byui-blue/40"
                    : "text-slate-700 hover:bg-white")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(a)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-byui-blue"
                />
                <span>{a}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label className="label">Action items</label>
        <textarea
          rows={2}
          className="input"
          placeholder="What's the mentee doing before next time?"
          value={actions}
          onChange={(e) => setActions(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Next meeting</label>
          <input type="date" className="input" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div>
          <label className="label">Private mentor notes</label>
          <input
            className="input"
            placeholder="Not visible to mentee"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Logged ✓
        </div>
      )}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Saving…" : "Log meeting"}
        </button>
      </div>
    </form>
  );
}
