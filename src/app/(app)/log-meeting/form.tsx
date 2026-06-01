"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [meetingType, setMeetingType] = useState("video");
  const [duration, setDuration] = useState(30);
  const [topics, setTopics] = useState("");
  const [actions, setActions] = useState("");
  const [next, setNext] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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
    setTopics("");
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
            <option value="video">Video</option>
            <option value="in_person">In person</option>
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

      <div>
        <label className="label">Topics discussed</label>
        <textarea
          rows={3}
          className="input"
          placeholder="What did you cover?"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
        />
      </div>

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
