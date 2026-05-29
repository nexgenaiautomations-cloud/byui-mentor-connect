"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PendingRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "accept" | "decline") {
    setBusy(true);
    const res = await fetch(`/api/requests/${requestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setBusy(false);
      return;
    }
    if (action === "accept") {
      router.push("/matches");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={() => act("decline")}
        disabled={busy}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 cursor-pointer"
      >
        Decline
      </button>
      <button
        onClick={() => act("accept")}
        disabled={busy}
        className="rounded-lg bg-gold-500 px-4 py-1.5 text-xs font-bold text-navy-900 hover:bg-gold-400 cursor-pointer"
      >
        {busy ? "…" : "Accept"}
      </button>
    </div>
  );
}
