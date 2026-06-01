"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reset() {
    if (busy) return;
    const ok = window.confirm(
      "Reset the demo? This wipes all requests, matches, meetings, and feedback, then re-seeds the original demo data."
    );
    if (!ok) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/demo-reset", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body?.error || "Reset failed");
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={reset}
        disabled={busy}
        title="Wipe activity and re-seed the demo dataset"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gold-400/60 bg-gold-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-100 transition hover:bg-gold-500/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Resetting…" : "Reset demo"}
      </button>
      {err && <span className="text-[11px] font-semibold text-rose-300">{err}</span>}
    </div>
  );
}
