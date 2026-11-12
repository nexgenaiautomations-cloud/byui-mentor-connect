"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerifyButton({ id, verified }: { id: string; verified: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function toggle() {
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/admin/career/${id}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ verified: !verified }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) setError(true);
    else router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={(verified ? "btn-ghost" : "btn-outline") + " min-h-[36px] px-3 py-1 text-xs"}
      >
        {busy ? "Saving…" : verified ? "Undo verify" : "Mark verified"}
      </button>
      {error && <span role="alert" className="text-xs text-red-700">Failed</span>}
    </span>
  );
}
