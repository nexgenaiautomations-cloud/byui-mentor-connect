"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = {
  id: string;
  counterpart: string | null;
  alreadySubmitted: boolean;
};

export function CheckInForm({
  options,
  month,
  year,
}: {
  options: Option[];
  month: number;
  year: number;
}) {
  const router = useRouter();
  const firstAvailable = options.find((o) => !o.alreadySubmitted)?.id ?? options[0]?.id ?? "";
  const [matchId, setMatchId] = useState(firstAvailable);
  const [rating, setRating] = useState<number>(0);
  const [frequency, setFrequency] = useState("");
  const [value, setValue] = useState("");
  const [blockers, setBlockers] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selected = options.find((o) => o.id === matchId);
  const blocked = selected?.alreadySubmitted;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchId) {
      setError("Please pick a match.");
      return;
    }
    if (rating === 0) {
      setError("Pick a rating from 1 to 5.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        matchId,
        month,
        year,
        rating,
        answers: {
          frequency: frequency || null,
          value: value || null,
          blockers: blockers || null,
        },
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.formErrors?.[0] || body?.error || "Could not submit");
      return;
    }
    setDone(true);
    setRating(0);
    setFrequency("");
    setValue("");
    setBlockers("");
    router.refresh();
    setTimeout(() => setDone(false), 3000);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      <div>
        <label className="label">Match</label>
        <select
          className="input"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.counterpart ?? "Match"}
              {o.alreadySubmitted ? " — submitted this month" : ""}
            </option>
          ))}
        </select>
      </div>

      {blocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You&apos;ve already submitted this match&apos;s check-in for{" "}
          {new Date(year, month - 1).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
          .
        </div>
      )}

      <div>
        <label className="label">How is mentoring going this month?</label>
        <div className="mt-1 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              disabled={blocked}
              aria-pressed={rating === n}
              className={
                "h-10 w-10 rounded-full border text-sm font-bold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 " +
                (rating === n
                  ? "border-byui-blue bg-byui-blue text-white shadow-soft"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")
              }
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          1 = not working · 5 = best mentor relationship ever
        </p>
      </div>

      <div>
        <label className="label">
          How often are you meeting?{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          className="input"
          value={frequency}
          disabled={blocked}
          onChange={(e) => setFrequency(e.target.value)}
          placeholder="e.g. weekly, every other week"
        />
      </div>
      <div>
        <label className="label">
          What's been most valuable?{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          rows={2}
          className="input"
          value={value}
          disabled={blocked}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <div>
        <label className="label">
          Any blockers we can help with?{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          rows={2}
          className="input"
          value={blockers}
          disabled={blocked}
          onChange={(e) => setBlockers(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {done && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Check-in submitted ✓
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={submitting || blocked}
          className="btn-primary"
        >
          Submit check-in
        </button>
      </div>
    </form>
  );
}
