"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MANAGED_ROLES, ROLE_NAMES, type ManagedRole } from "@/lib/user-admin";

export type ManageTarget = {
  id: string;
  name: string | null;
  email: string;
  role: ManagedRole;
  isAdmin: boolean;
  removed: boolean;
  activeMentees: number;
};

const ROLE_HELP: Record<ManagedRole, string> = {
  member: "Can find a mentor and log activity. Ends any mentees they have.",
  mentor: "Appears in Find a Mentor and can take mentees.",
  executive_mentor: "A mentor who also oversees a group of other mentors.",
};

// Gear icon button that opens the role / remove dialog for one member.
// `onClick` stops propagation so it can sit inside clickable table rows.
export function ManageUserButton({ target, disabledReason }: { target: ManageTarget; disabledReason?: string }) {
  const [open, setOpen] = useState(false);
  const label = `Manage ${target.name || target.email}`;
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={disabledReason ?? label}
        disabled={!!disabledReason}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-brand/40 hover:bg-brand-light/20 hover:text-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
      </button>
      {open && <ManageUserModal target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

function ManageUserModal({ target, onClose }: { target: ManageTarget; onClose: () => void }) {
  const router = useRouter();
  const [role, setRole] = useState<ManagedRole>(target.role);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, busy]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not save.");
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setBusy(false);
    }
  }

  const who = target.name || target.email;
  const demotingWithMentees = role === "member" && target.role !== "member" && target.activeMentees > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 text-left" onClick={(e) => e.stopPropagation()}>
      <div aria-hidden onClick={() => !busy && onClose()} className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-labelledby="manage-title" className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-brand sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Manage member</p>
        <h2 id="manage-title" className="mt-1 font-display text-xl font-black text-brand-dark">{who}</h2>
        <p className="text-xs text-slate-600">{target.email}</p>

        {target.removed ? (
          <>
            <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
              This account was removed from ICAN. They can&apos;t sign in. Restoring it brings them back as a member.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="min-h-11 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={() => send({ action: "restore" })} disabled={busy} className="min-h-11 cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
                {busy ? "Saving…" : "Restore account"}
              </button>
            </div>
          </>
        ) : confirmRemove ? (
          <>
            <p className="mt-4 text-sm text-slate-800">
              Remove <strong>{who}</strong> from ICAN? They will be signed out and blocked from signing in,
              their mentor/mentee matches will end, and they&apos;ll be hidden from lists. Their history is kept,
              and you can restore the account later.
            </p>
            <label htmlFor="remove-reason" className="mt-3 block text-sm font-semibold text-slate-800">
              Reason <span className="font-normal text-slate-600">(optional, admins only)</span>
            </label>
            <textarea id="remove-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40" />
            {error && <p role="alert" className="mt-2 text-sm font-medium text-rose-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmRemove(false)} disabled={busy} className="min-h-11 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Back</button>
              <button type="button" onClick={() => send({ action: "remove", reason: reason.trim() || undefined })} disabled={busy} className="min-h-11 cursor-pointer rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60">
                {busy ? "Removing…" : "Remove from ICAN"}
              </button>
            </div>
          </>
        ) : (
          <>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-slate-800">Role</legend>
              <div className="mt-2 space-y-2">
                {MANAGED_ROLES.map((r) => (
                  <label key={r} className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${role === r ? "border-brand bg-brand-light/20" : "border-slate-200 hover:bg-slate-50"}`}>
                    <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-brand" />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {ROLE_NAMES[r]}{r === target.role ? " (current)" : ""}
                      </span>
                      <span className="block text-xs text-slate-600">{ROLE_HELP[r]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {target.isAdmin && (
              <p className="mt-3 text-xs text-slate-600">Admin access is managed on the Manage admins page.</p>
            )}
            {demotingWithMentees && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {who} has {target.activeMentees} active mentee{target.activeMentees === 1 ? "" : "s"}. Those matches will end.
              </p>
            )}
            {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-700">{error}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => setConfirmRemove(true)} disabled={busy} className="min-h-11 cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50">
                Remove from ICAN…
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
                <button type="button" onClick={() => send({ action: "set_role", role })} disabled={busy || role === target.role} className="min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? "Saving…" : "Save role"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
