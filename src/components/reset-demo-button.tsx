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
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(body?.error || "Reset failed");
      setBusy(false);
      return;
    }
    // Clear popup dismissals so the freshly-seeded pending request actually
    // surfaces again on this same browser session.
    try {
      sessionStorage.removeItem("pending-popup-dismissed-ids");
    } catch {
      // ignore
    }
    if (body?.mentorDemo) {
      const m = body.mentorDemo;
      console.info(
        `[demo-reset] mentor.demo → ${m.activeMatches} active, ${m.pendingRequests} pending`
      );
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
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-byui-blue-light/60 bg-byui-blue/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-byui-blue-light transition hover:bg-byui-blue/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Resetting…" : "Reset demo"}
      </button>
      {err && <span className="text-[11px] font-semibold text-rose-300">{err}</span>}
    </div>
  );
}
