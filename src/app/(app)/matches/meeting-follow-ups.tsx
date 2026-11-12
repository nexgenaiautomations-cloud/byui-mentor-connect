"use client";

// "Needs your attention" block on a pair card: confirm a meeting your
// partner logged, or tick off action items. One tap each.
import { useRouter } from "next/navigation";
import { useState } from "react";

export type FollowUpItem = {
  id: string;
  meetingDate: string; // ISO
  kindLabel: string;
  needsMyConfirmation: boolean;
  openActionItems: boolean;
  canMarkActions: boolean;
};

export function MeetingFollowUps({ items }: { items: FollowUpItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  async function act(key: string, url: string, body?: unknown) {
    setBusy(key);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      setError("That didn't save — please try again.");
      return;
    }
    setDone((d) => new Set(d).add(key));
    router.refresh();
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <section aria-label="Needs your attention" className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Needs your attention</p>
      <ul className="mt-2 space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-800">
            <span>
              {it.kindLabel} on <strong>{fmt(it.meetingDate)}</strong>
            </span>
            <span className="flex flex-wrap gap-2">
              {it.needsMyConfirmation && !done.has(`c:${it.id}`) && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => act(`c:${it.id}`, `/api/meeting-logs/${it.id}/confirm`)}
                  className="min-h-[36px] rounded-lg bg-plum-700 px-3 py-1.5 font-semibold text-white transition hover:bg-plum-800 disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-plum-500 focus:ring-offset-2"
                >
                  {busy === `c:${it.id}` ? "Saving…" : "Yes, it happened"}
                </button>
              )}
              {it.openActionItems && it.canMarkActions && !done.has(`a:${it.id}`) && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => act(`a:${it.id}`, `/api/meeting-logs/${it.id}/action-items`, { done: true })}
                  className="min-h-[36px] rounded-lg border border-plum-200 bg-white px-3 py-1.5 font-semibold text-plum-700 transition hover:bg-plum-50 disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-plum-500 focus:ring-offset-2"
                >
                  {busy === `a:${it.id}` ? "Saving…" : "Action items done"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  );
}
