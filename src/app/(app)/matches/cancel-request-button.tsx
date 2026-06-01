"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    if (busy) return;
    if (!window.confirm("Cancel this request?")) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/requests/${requestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body?.error || "Couldn't cancel");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="btn-outline text-xs disabled:opacity-50"
      >
        {busy ? "…" : "Cancel"}
      </button>
      {err && <span className="text-[11px] font-semibold text-rose-600">{err}</span>}
    </div>
  );
}
