"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApplicationActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/mentor-applications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setErr("Failed");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 flex items-center justify-end gap-2">
      {err && <span className="text-xs text-red-600">{err}</span>}
      <button onClick={() => act("reject")} disabled={busy} className="btn-outline">Reject</button>
      <button onClick={() => act("approve")} disabled={busy} className="btn-primary">Approve</button>
    </div>
  );
}
