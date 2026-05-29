"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MatchOpt = { id: string; role: "mentor" | "mentee"; counterpart: string | null };

const QUESTIONS = [
  { key: "frequency", label: "How often did you meet this month?" },
  { key: "value", label: "What was the most valuable part?" },
  { key: "blockers", label: "Anything blocking progress?" },
];

export function CheckInForm({ matches }: { matches: MatchOpt[] }) {
  const router = useRouter();
  const now = new Date();
  const [matchId, setMatchId] = useState(matches[0]?.id ?? "");
  const [rating, setRating] = useState(4);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matchId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        rating,
        answers,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.formErrors?.[0] || "Could not submit");
      setSubmitting(false);
      return;
    }
    setSaved(true);
    setSubmitting(false);
    router.refresh();
  }

  if (saved) {
    return (
      <div className="text-center py-6">
        <p className="font-display text-xl font-bold text-navy-800">Thanks for checking in.</p>
        <p className="mt-1 text-sm text-slate-600">Admins see aggregate ratings, not the open-ended answers verbatim.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label className="label">Match</label>
        <select className="input" value={matchId} onChange={(e) => setMatchId(e.target.value)} required>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.counterpart} · you are the {m.role}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Overall, how is the mentorship going?</label>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setRating(n)}
              className={`h-11 w-11 rounded-full text-sm font-bold transition cursor-pointer ${
                rating === n
                  ? "bg-navy-700 text-white shadow-soft"
                  : "border border-slate-200 bg-white text-slate-500 hover:border-navy-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">1 = struggling, 5 = excellent</p>
      </div>

      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <label className="label">{q.label}</label>
          <textarea
            rows={2}
            className="input"
            value={answers[q.key] ?? ""}
            onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
          />
        </div>
      ))}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Submitting…" : "Submit check-in"}
      </button>
    </form>
  );
}
