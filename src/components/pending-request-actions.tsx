"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PendingRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "accepted" | "declined" | "error">("idle");

  async function act(action: "accept" | "decline") {
    // Optimistic: flip UI immediately so the click feels instant.
    setState("busy");
    const optimistic = action === "accept" ? "accepted" : "declined";

    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      setState(optimistic);
      // Background refresh so the rest of the page reflects new state. We
      // intentionally DO NOT navigate — staying put is faster and the user
      // can jump to /matches from the success affordance.
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "accepted") {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">
          ✓ Accepted
        </span>
        <Link
          href="/matches"
          className="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-bold text-navy-900 hover:bg-gold-400 cursor-pointer"
        >
          Open match →
        </Link>
      </div>
    );
  }

  if (state === "declined") {
    return (
      <span className="rounded-lg bg-slate-500/30 px-3 py-1.5 text-xs font-bold text-white/80">
        Declined
      </span>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {state === "error" && (
        <span className="text-[11px] text-red-200">Try again</span>
      )}
      <button
        onClick={() => act("decline")}
        disabled={state === "busy"}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 cursor-pointer disabled:opacity-50"
      >
        Decline
      </button>
      <button
        onClick={() => act("accept")}
        disabled={state === "busy"}
        className="rounded-lg bg-gold-500 px-4 py-1.5 text-xs font-bold text-navy-900 hover:bg-gold-400 cursor-pointer disabled:opacity-50"
      >
        {state === "busy" ? "…" : "Accept"}
      </button>
    </div>
  );
}
