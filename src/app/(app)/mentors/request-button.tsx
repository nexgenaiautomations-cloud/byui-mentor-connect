"use client";

import { useState } from "react";

export function RequestButton({ mentorId, disabled }: { mentorId: string; disabled?: boolean }) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mentorId }),
      });
      if (res.status === 409) {
        setStatus("sent");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to send request");
      }
      setStatus("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setStatus("error");
    }
  }

  if (status === "sent") return <span className="text-sm font-medium text-emerald-700">Request sent ✓</span>;

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button onClick={send} disabled={disabled || status === "loading"} className="btn-primary">
        {status === "loading" ? "Sending…" : disabled ? "At capacity" : "Request mentor"}
      </button>
    </div>
  );
}
