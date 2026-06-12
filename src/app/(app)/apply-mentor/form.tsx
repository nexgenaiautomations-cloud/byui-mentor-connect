"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const INTERVIEW_BUCKETS = ["1-10", "11-25", "26-50", "51-100", "100+"] as const;
const INTERNSHIP_BUCKETS = ["None", "1", "2", "3 or more"] as const;

export function ApplyForm({ hasOpenApplication }: { hasOpenApplication: boolean }) {
  const router = useRouter();
  const [motivation, setMotivation] = useState("");
  const [informationalInterviews, setInformationalInterviews] = useState<string>("");
  const [internshipsCount, setInternshipsCount] = useState<string>("");
  const [capacity, setCapacity] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!informationalInterviews) {
      setError("Pick a range for informational interviews");
      setSubmitting(false);
      return;
    }
    if (!internshipsCount) {
      setError("Pick a count for internships");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/mentor-applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        motivation,
        informationalInterviews,
        internshipsCount,
        capacity,
      }),
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
        <label className="label" htmlFor="info-interviews">
          How many informational interviews (career chats) have you done?
        </label>
        <select
          id="info-interviews"
          required
          className="input"
          value={informationalInterviews}
          onChange={(e) => setInformationalInterviews(e.target.value)}
        >
          <option value="" disabled>Select a range…</option>
          {INTERVIEW_BUCKETS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">More details — a rough count is fine.</p>
      </div>

      <div>
        <label className="label" htmlFor="internships-count">
          How many internships or career-related work experiences have you had?
        </label>
        <select
          id="internships-count"
          required
          className="input"
          value={internshipsCount}
          onChange={(e) => setInternshipsCount(e.target.value)}
        >
          <option value="" disabled>Select a count…</option>
          {INTERNSHIP_BUCKETS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">More details — count paid and unpaid roles.</p>
      </div>

      <div>
        <label className="label">How many mentees can you manage?</label>
        <input
          type="number"
          min={1}
          max={10}
          className="input max-w-[160px]"
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
        <p className="mt-1 text-xs text-slate-500">
          Choose the maximum number of mentees you feel you can support well.
          Default is 5 — you can change this later from your profile.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Submitting…" : "Submit application →"}
      </button>
    </form>
  );
}
