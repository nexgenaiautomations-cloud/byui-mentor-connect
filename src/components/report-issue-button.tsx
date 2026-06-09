"use client";

import { useEffect, useState } from "react";

const CATEGORIES = [
  { value: "it", label: "IT" },
  { value: "mentor", label: "I have an issue with my mentor" },
  { value: "mentee", label: "I have an issue with a mentee" },
  { value: "other", label: "Other" },
] as const;

// Small "Report an issue" trigger that lives in the sidebar above the
// Install App button. Opens a modal with a category dropdown + textarea
// and POSTs to /api/issues. The category list matches what's expected on
// the admin side.
export function ReportIssueButton({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "primary";
}) {
  const [open, setOpen] = useState(false);

  const triggerCls =
    variant === "sidebar"
      ? "mt-3 w-full rounded-md border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/85 transition hover:bg-white/15 hover:text-white cursor-pointer"
      : "inline-flex items-center justify-center rounded-lg border border-byui-blue/40 bg-white px-3 py-1.5 text-xs font-semibold text-byui-blue-dark hover:bg-byui-blue-light/20 cursor-pointer";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerCls}
        aria-haspopup="dialog"
      >
        Report an issue
      </button>
      {open && <IssueModal onClose={() => setOpen(false)} />}
    </>
  );
}

function IssueModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]["value"]>("it");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 5) {
      setError("Tell us a bit more about the issue (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, message: message.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not send your report.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-byui-blue sm:p-6"
      >
        <button
          type="button"
          onClick={() => !submitting && onClose()}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
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
          Support
        </p>
        <h2
          id="issue-title"
          className="mt-1 font-display text-xl font-black text-byui-blue-dark"
        >
          Report an issue
        </h2>

        {done ? (
          <>
            <p className="mt-3 text-sm text-slate-700">
              Thanks — your report is in. The team will follow up by email at
              the address on your account.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4">
            <div>
              <label htmlFor="issue-category" className="label">
                What kind of issue?
              </label>
              <select
                id="issue-category"
                className="input"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as typeof category)
                }
                required
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="issue-message" className="label">
                What&apos;s going on?
              </label>
              <textarea
                id="issue-message"
                rows={5}
                className="input"
                placeholder="Describe what happened and what you'd like us to do about it."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Your name and email come along automatically so the team can
                reply.
              </p>
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
