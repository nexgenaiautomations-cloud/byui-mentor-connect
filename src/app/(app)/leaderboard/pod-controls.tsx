"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PodControls({
  pods,
  myPodId,
  isAdmin,
}: {
  pods: { id: string; name: string }[];
  myPodId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [podId, setPodId] = useState(myPodId ?? "");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function post(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pods", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not save.");
      }
      setMessage({ tone: "ok", text: ok });
      router.refresh();
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const control =
    "min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";
  const button =
    "min-h-10 cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-end gap-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (podId) post({ action: "join", podId }, "You switched pods.");
        }}
      >
        <label className="text-xs font-semibold text-slate-700">
          {myPodId ? "Switch pod" : "Join a pod"}
          <select value={podId} onChange={(e) => setPodId(e.target.value)} className={`mt-1 block ${control}`}>
            <option value="" disabled>
              Choose a pod
            </option>
            {pods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy || !podId || podId === myPodId} className={button}>
          {myPodId ? "Switch" : "Join"}
        </button>
      </form>

      {isAdmin && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) post({ action: "create", name: newName.trim() }, "Pod created.").then(() => setNewName(""));
          }}
        >
          <label className="text-xs font-semibold text-slate-700">
            New pod (admins)
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="Pod name" className={`mt-1 block ${control}`} />
          </label>
          <button type="submit" disabled={busy || newName.trim().length < 2} className={button}>
            Create pod
          </button>
        </form>
      )}

      {message && (
        <p role="status" className={`w-full text-sm font-medium ${message.tone === "ok" ? "text-emerald-800" : "text-rose-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
