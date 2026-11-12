"use client";

import { useEffect, useState } from "react";

type Prefs = {
  meetingReminders: boolean;
  followUps: boolean;
  inactivityNudges: boolean;
  timezone: string;
};

const ITEMS: { key: keyof Omit<Prefs, "timezone">; label: string; hint: string }[] = [
  { key: "meetingReminders", label: "Meeting reminders", hint: "The day before and an hour before a scheduled meeting." },
  { key: "followUps", label: "Follow-ups", hint: "Log a meeting that just happened, confirm one your partner logged, or finish action items." },
  { key: "inactivityNudges", label: "Check-in nudges", hint: "A gentle note when you and your mentor/mentee haven't connected in a while." },
];

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/me/notifications")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b) => setPrefs(b.preferences))
      .catch(() => setLoadError(true));
  }, []);

  async function save(next: Prefs) {
    setPrefs(next);
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/me/notifications", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => null);
    setSaving(false);
    setStatus(res?.ok ? { ok: true, text: "Saved" } : { ok: false, text: "Couldn't save — please try again." });
  }

  if (loadError) {
    return <p role="alert" className="mt-3 text-sm text-red-700">Couldn&apos;t load your email settings. Refresh to try again.</p>;
  }
  if (!prefs) {
    return (
      <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading email settings">
        {ITEMS.map((i) => (
          <div key={i.key} className="h-12 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  return (
    <div className="mt-3 space-y-3">
      {ITEMS.map((i) => (
        <label
          key={i.key}
          className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 transition hover:bg-plum-50 focus-within:ring-2 focus-within:ring-plum-500"
        >
          <input
            type="checkbox"
            checked={prefs[i.key]}
            disabled={saving}
            onChange={(e) => save({ ...prefs, [i.key]: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-800">{i.label}</span>
            <span className="block text-xs text-slate-600">{i.hint}</span>
          </span>
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Time zone for reminders: <strong className="text-slate-800">{prefs.timezone.replace(/_/g, " ")}</strong></span>
        {browserTz && browserTz !== prefs.timezone && (
          <button
            type="button"
            onClick={() => save({ ...prefs, timezone: browserTz })}
            disabled={saving}
            className="btn-ghost min-h-[36px] px-2 py-1 text-xs"
          >
            Use {browserTz.replace(/_/g, " ")}
          </button>
        )}
      </div>
      <p aria-live="polite" className={"text-xs " + (status?.ok ? "text-emerald-700" : "text-red-700")}>
        {status?.text ?? ""}
      </p>
      <p className="text-[11px] text-slate-500">
        Reminder emails never include your notes or feedback — just a link back to ICAN.
      </p>
    </div>
  );
}
