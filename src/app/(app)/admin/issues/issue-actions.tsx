"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IssueActions({
  issueId,
  canMarkSeen,
  canMarkAddressed,
}: {
  issueId: string;
  canMarkSeen: boolean;
  canMarkAddressed: boolean;
}) {
  const router = useRouter();
  const [addressing, setAddressing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "seen" | "addressed") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/issues/${issueId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          note: action === "addressed" ? note.trim() || undefined : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not save.");
      }
      setAddressing(false);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "min-h-10 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      {addressing ? (
        <div className="space-y-2">
          <label htmlFor={`note-${issueId}`} className="text-sm font-semibold text-slate-800">
            How was it addressed? <span className="font-normal text-slate-600">(optional)</span>
          </label>
          <textarea
            id={`note-${issueId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={2}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => send("addressed")} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>
              {busy ? "Saving…" : "Confirm addressed"}
            </button>
            <button type="button" disabled={busy} onClick={() => setAddressing(false)} className={`${btn} text-slate-700 hover:bg-slate-100`}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canMarkSeen && (
            <button type="button" disabled={busy} onClick={() => send("seen")} className={`${btn} bg-brand text-white hover:bg-brand-dark`}>
              {busy ? "Saving…" : "I've seen this"}
            </button>
          )}
          {canMarkAddressed && (
            <button type="button" disabled={busy} onClick={() => setAddressing(true)} className={`${btn} border border-brand/40 bg-white text-brand-dark hover:bg-brand-light/20`}>
              Mark addressed
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
