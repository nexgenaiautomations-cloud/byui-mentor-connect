"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApplyForm({ hasOpenApplication }: { hasOpenApplication: boolean }) {
  const router = useRouter();
  const [motivation, setMotivation] = useState("");
  const [topicsRaw, setTopicsRaw] = useState("");
  const [capacity, setCapacity] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const topics = topicsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (topics.length === 0) {
      setError("Add at least one topic you can mentor on");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/mentor-applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ motivation, topics, capacity }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.formErrors?.[0] || "Failed to submit");
      setSubmitting(false);
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="font-display text-lg font-bold text-navy-800">Application submitted.</p>
        <p className="mt-1 text-sm text-slate-600">
          An admin will review it shortly. You&apos;ll appear in the mentor directory once approved.
        </p>
      </div>
    );
  }

  if (hasOpenApplication) {
    return (
      <p className="text-sm text-slate-600">
        You already have an application under review. Hang tight — an admin will get to it soon.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="label">Why do you want to mentor?</label>
        <textarea
          required
          rows={4}
          minLength={20}
          maxLength={2000}
          className="input"
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder="What can you offer? What experience can you share?"
        />
      </div>
      <div>
        <label className="label">Topics you can mentor on</label>
        <input
          required
          className="input"
          placeholder="e.g. Resume reviews, internship prep, accounting basics"
          value={topicsRaw}
          onChange={(e) => setTopicsRaw(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">Comma-separated.</p>
      </div>
      <div>
        <label className="label">Capacity (max mentees)</label>
        <input
          type="number"
          min={1}
          max={10}
          className="input max-w-[160px]"
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
        <p className="mt-1 text-xs text-slate-500">Default is 5. You can change this later from your profile.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
