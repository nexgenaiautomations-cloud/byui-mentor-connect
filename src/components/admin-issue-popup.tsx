"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type PendingIssue = {
  id: string;
  categoryLabel: string;
  message: string;
  status: string;
  createdAt: string;
  reporterName: string | null;
  reporterEmail: string | null;
};

// Blocking modal shown to an admin on every app page until they have
// acknowledged every reported issue. Deliberately has no close button and
// ignores Escape/backdrop clicks: the record of each admin seeing each issue
// is the point (docs/specs/admin-issue-reports.md).
export function AdminIssuePopup({ issues }: { issues: PendingIssue[] }) {
  const router = useRouter();
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"choose" | "address">("choose");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstButton = useRef<HTMLButtonElement>(null);

  const queue = issues.filter((i) => !handled.has(i.id));
  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstButton.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [current]);

  if (!current) return null;

  async function acknowledge(action: "seen" | "addressed") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/issues/${current.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          note: action === "addressed" ? note.trim() || undefined : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not save. Please try again.");
      }
      const next = new Set(handled);
      next.add(current.id);
      setHandled(next);
      setMode("choose");
      setNote("");
      if (next.size === issues.length) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const reported = new Date(current.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-brand-dark/75 backdrop-blur-sm" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-issue-title"
        aria-describedby="admin-issue-message"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-brand sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
            Reported issue · action required
          </p>
          {queue.length > 1 && (
            <span className="rounded-full bg-brand-light/30 px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
              1 of {queue.length}
            </span>
          )}
        </div>
        <h2
          id="admin-issue-title"
          className="mt-1 font-display text-xl font-black text-brand-dark"
        >
          {current.categoryLabel}
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          From {current.reporterName ?? current.reporterEmail ?? "a deleted user"}
          {current.reporterName && current.reporterEmail ? ` (${current.reporterEmail})` : ""}
          {" · "}
          {reported}
        </p>
        {current.status === "addressed" && (
          <p className="mt-2 inline-block rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
            Another admin already marked this addressed
          </p>
        )}
        <p
          id="admin-issue-message"
          className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"
        >
          {current.message}
        </p>

        {mode === "address" && (
          <div className="mt-4">
            <label htmlFor="issue-note" className="text-sm font-semibold text-slate-800">
              How was it addressed? <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <textarea
              id="issue-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <p className="mt-4 text-xs text-slate-600">
          Every admin must confirm they have seen each reported issue. Your
          confirmation is recorded with the time.
        </p>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {mode === "choose" ? (
            <>
              {current.status !== "addressed" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("address")}
                className="min-h-11 cursor-pointer rounded-lg border border-brand/40 bg-white px-4 py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-light/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                Mark addressed
              </button>
              )}
              <button
                ref={firstButton}
                type="button"
                disabled={busy}
                onClick={() => acknowledge("seen")}
                className="min-h-11 cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Saving…" : "I've seen this"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("choose")}
                className="min-h-11 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => acknowledge("addressed")}
                className="min-h-11 cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Saving…" : "Confirm addressed"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
