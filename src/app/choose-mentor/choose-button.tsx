"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Sends a mentor request and finishes sign-up.
export function ChooseMentorButton({ mentorId, mentorName }: { mentorId: string; mentorName: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mentorId, message: null }),
      });
      if (!res.ok && res.status !== 409) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.error === "string" ? body.error : "Could not send your request.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your request.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={choose}
        disabled={busy}
        className="min-h-11 w-full cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Sending request…" : `Choose ${mentorName?.split(" ")[0] || "this mentor"}`}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
    </>
  );
}
