"use client";

import { useState } from "react";

export function RequestButton({
  mentorId,
  mentorName,
  disabled,
}: {
  mentorId: string;
  mentorName?: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mentorId, message: message || null }),
      });
      if (res.status === 409) {
        setStatus("sent");
        setOpen(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to send request");
      }
      setStatus("sent");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <span className="text-sm font-bold text-emerald-700">Request sent ✓</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="btn-primary"
      >
        {disabled ? "At capacity" : "Request mentor"}
      </button>
    );
  }

  return (
    <>
      {/* Modal backdrop */}
      <div
        className="fixed inset-0 z-50 bg-navy-900/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="fixed inset-0 z-50 grid place-items-center px-4">
        <div
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-display text-lg font-bold text-navy-800">
            Request {mentorName || "this mentor"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            A short, specific note doubles your accept rate. What do you want to work on?
          </p>
          <textarea
            rows={4}
            className="input mt-4"
            placeholder="e.g. Hi! I'm a sophomore Marketing major exploring brand work. Would love your take on agency vs. in-house and a resume review."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
          />
          <p className="mt-1 text-[11px] text-slate-400">Optional. 1000 characters max.</p>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={status === "loading"}
              className="btn-primary"
            >
              {status === "loading" ? "Sending…" : "Send request"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
