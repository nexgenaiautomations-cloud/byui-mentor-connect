"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCOMPLISHMENT_GROUPS,
  ALL_ACCOMPLISHMENTS,
} from "@/lib/possible-actions";

export type LogForEdit = {
  id: string;
  meetingDate: string; // ISO date (YYYY-MM-DD)
  topicsDiscussed: string | null;
  actionItems: string | null;
  isSystemGenerated: boolean;
};

// Renders inline Edit + Delete buttons for a mentor on each of their mentee's
// activity logs. System-generated rows render nothing. Delete prompts for
// confirmation; Edit opens a focused modal that PATCHes the log.
export function LogActions({ log }: { log: LogForEdit }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (log.isSystemGenerated) return null;

  async function onDelete() {
    if (
      !confirm(
        "Delete this activity log? The student's KPIs and streak will recalculate."
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/meeting-logs/${log.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error || "Could not delete");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded px-1.5 py-0.5 text-byui-blue hover:bg-byui-blue/10 cursor-pointer"
        >
          Edit
        </button>
        <span className="text-slate-300">·</span>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded px-1.5 py-0.5 text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer"
        >
          {deleting ? "…" : "Delete"}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-[10px] text-rose-600">{error}</p>
      )}
      {editOpen && (
        <EditLogModal
          log={log}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function EditLogModal({
  log,
  onClose,
  onSaved,
}: {
  log: LogForEdit;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialAccomplishments = new Set<string>(
    (log.topicsDiscussed?.split(" · ") ?? []).filter((s) =>
      (ALL_ACCOMPLISHMENTS as readonly string[]).includes(s)
    )
  );
  const [date, setDate] = useState(log.meetingDate);
  const [accomplishments, setAccomplishments] = useState<Set<string>>(
    initialAccomplishments
  );
  const [actions, setActions] = useState(log.actionItems ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function toggle(a: string) {
    setAccomplishments((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  async function onSave() {
    if (accomplishments.size === 0) {
      setError("Pick at least one accomplishment.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/meeting-logs/${log.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        activityDate: date,
        accomplishments: [...accomplishments],
        actionItems: actions || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.formErrors?.[0] || body?.error || "Could not save");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-log-title"
        className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-byui-blue sm:p-6"
      >
        <button
          type="button"
          onClick={() => !saving && onClose()}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer disabled:opacity-40"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 6 18 18M18 6 6 18" />
          </svg>
        </button>

        <p className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
          Edit log
        </p>
        <h2
          id="edit-log-title"
          className="mt-1 font-display text-xl font-black text-byui-blue-dark"
        >
          Update this activity
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          The student&apos;s KPIs and streak will recalculate after saving.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label">Activity date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
            {ACCOMPLISHMENT_GROUPS.map((g) => (
              <div
                key={g.key}
                className="rounded-xl border border-byui-blue-light/40 bg-slate-50 p-3"
              >
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-byui-blue-dark">
                  {g.heading}
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {g.options.map((a) => {
                    const isChecked = accomplishments.has(a);
                    return (
                      <label
                        key={a}
                        className={
                          "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs leading-snug transition " +
                          (isChecked
                            ? "bg-byui-blue/10 text-byui-blue-dark ring-1 ring-byui-blue/40"
                            : "text-slate-700 hover:bg-white")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(a)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-byui-blue"
                        />
                        <span>{a}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="label">
              Action items{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              className="input"
              value={actions}
              onChange={(e) => setActions(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-5 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
