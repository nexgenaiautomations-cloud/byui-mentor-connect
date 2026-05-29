"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = {
  id: string;
  status: string;
  requestedAt: Date;
  message: string | null;
  mentorName: string | null;
};

export function RequestRow({
  request,
  viewerRole,
}: {
  request: Row;
  viewerRole: "mentor" | "mentee";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: "accept" | "decline" | "cancel") {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/requests/${request.id}`, {
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

  const color = {
    pending: "bg-amber-50 border-amber-200 text-amber-800",
    accepted: "bg-emerald-50 border-emerald-200 text-emerald-800",
    declined: "bg-slate-50 border-slate-200 text-slate-600",
    cancelled: "bg-slate-50 border-slate-200 text-slate-500",
  }[request.status] ?? "bg-slate-50 border-slate-200";

  return (
    <div className="card flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-navy-800">
          {viewerRole === "mentor" ? "Incoming request" : `To ${request.mentorName || "mentor"}`}
        </p>
        {request.message && <p className="mt-1 text-sm text-slate-600">{request.message}</p>}
        <p className="mt-1 text-xs text-slate-500">
          {new Date(request.requestedAt).toLocaleString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
          {request.status}
        </span>
        {request.status === "pending" && viewerRole === "mentor" && (
          <>
            <button onClick={() => act("decline")} disabled={busy} className="btn-outline">Decline</button>
            <button onClick={() => act("accept")} disabled={busy} className="btn-primary">Accept</button>
          </>
        )}
        {request.status === "pending" && viewerRole === "mentee" && (
          <button onClick={() => act("cancel")} disabled={busy} className="btn-outline">Cancel</button>
        )}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}
