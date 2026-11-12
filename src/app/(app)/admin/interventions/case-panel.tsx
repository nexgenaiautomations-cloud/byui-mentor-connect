"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { INTERVENTION_STATUSES, STATUS_LABEL, canTransition, type InterventionStatus } from "@/lib/interventions";

type Staff = { id: string; name: string; role: string };

async function patch(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/interventions/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  return { ok: !!res?.ok, status: res?.status ?? 0, data };
}

export function CasePanel({
  id,
  status,
  assignedToId,
  followUpOn,
  staff,
  studentEmail,
  mentorEmail,
  limited = false,
}: {
  id: string;
  status: InterventionStatus;
  assignedToId: string | null;
  followUpOn: string | null;
  staff: Staff[];
  studentEmail: string | null;
  mentorEmail: string | null;
  // Executive-mentor view: outreach, notes, follow-up and a few statuses.
  limited?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [note, setNote] = useState("");
  const [confirmDup, setConfirmDup] = useState<string | null>(null);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setMsg(null);
    const r = await patch(id, body);
    setBusy(false);
    if (r.status === 409 && r.data?.error === "duplicate_outreach") {
      setConfirmDup(r.data.message);
      return;
    }
    if (!r.ok) {
      setMsg({ ok: false, text: typeof r.data?.error === "string" ? r.data.error : "That didn't save — try again." });
      return;
    }
    setConfirmDup(null);
    setNote("");
    setMsg({ ok: true, text: success });
    router.refresh();
  }

  const statuses = INTERVENTION_STATUSES.filter(
    (s) => canTransition(status, s) && (!limited || ["contacted", "awaiting_response", "resolved"].includes(s))
  );
  const field = "min-h-[44px] rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-plum-500 focus:outline-none focus:ring-2 focus:ring-plum-200";

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-plum-100 bg-plum-50/50 p-3">
      <div className="flex flex-wrap gap-2">
        {studentEmail && (
          <a href={`mailto:${studentEmail}`} className="btn-outline min-h-[44px] px-3 py-1.5 text-xs">Email student</a>
        )}
        {mentorEmail && (
          <a href={`mailto:${mentorEmail}`} className="btn-outline min-h-[44px] px-3 py-1.5 text-xs">Email mentor</a>
        )}
        <button type="button" disabled={busy} onClick={() => run({ action: "outreach", note: note || undefined }, "Outreach recorded")} className="btn-primary min-h-[44px] px-3 py-1.5 text-xs">
          Record outreach
        </button>
        {!limited && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await patch(id, { action: "reassign_recommended", note: note || undefined });
              setBusy(false);
              if (r.ok) router.push("/admin/matchmaker");
              else setMsg({ ok: false, text: "Couldn't record that — try again." });
            }}
            className="btn-ghost min-h-[44px] px-3 py-1.5 text-xs"
          >
            Recommend reassignment →
          </button>
        )}
      </div>

      {confirmDup && (
        <div role="alertdialog" aria-label="Possible duplicate outreach" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p>{confirmDup}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary min-h-[40px] px-3 py-1 text-xs" disabled={busy} onClick={() => run({ action: "outreach", note: note || undefined, force: true }, "Outreach recorded")}>
              Record anyway
            </button>
            <button type="button" className="btn-ghost min-h-[40px] px-3 py-1 text-xs" onClick={() => setConfirmDup(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-700">
          Status
          <select
            className={field + " mt-1 block w-full"}
            value=""
            disabled={busy || statuses.length === 0}
            onChange={(e) => e.target.value && run({ action: "status", status: e.target.value, note: note || undefined }, "Status updated")}
          >
            <option value="">{STATUS_LABEL[status]} — change…</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        {!limited && (
          <label className="text-xs font-semibold text-slate-700">
            Owner
            <select
              className={field + " mt-1 block w-full"}
              value={assignedToId ?? ""}
              disabled={busy}
              onChange={(e) => run({ action: "assign", assigneeId: e.target.value || null }, "Owner updated")}
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-semibold text-slate-700">
          Follow up on
          <input
            type="date"
            className={field + " mt-1 block w-full"}
            defaultValue={followUpOn ?? ""}
            disabled={busy}
            onChange={(e) => run({ action: "follow_up", followUpOn: e.target.value || null }, "Follow-up saved")}
          />
        </label>
      </div>

      <div>
        <label htmlFor={`note-${id}`} className="text-xs font-semibold text-slate-700">Internal note</label>
        <textarea
          id={`note-${id}`}
          rows={2}
          maxLength={1000}
          className="input mt-1"
          placeholder="What happened? (Admins only. Don't include grades, health or other sensitive details.)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" disabled={busy || !note.trim()} onClick={() => run({ action: "note", note }, "Note added")} className="btn-outline mt-2 min-h-[40px] px-3 py-1 text-xs">
          Add note
        </button>
      </div>
      <p aria-live="polite" className={"text-xs " + (msg?.ok ? "text-emerald-700" : "text-red-700")}>{msg?.text ?? ""}</p>
    </div>
  );
}

export function RefreshRiskButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        className="btn-outline min-h-[44px]"
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/admin/interventions/detect", { method: "POST" }).catch(() => null);
          const body = await res?.json().catch(() => null);
          setBusy(false);
          setText(res?.ok && body ? `Checked ${body.evaluated} pairs · ${body.opened} new` : "Check failed — try again");
          router.refresh();
        }}
      >
        {busy ? "Checking…" : "Run risk check now"}
      </button>
      <span aria-live="polite" className="text-[11px] text-slate-600">{text}</span>
    </span>
  );
}
