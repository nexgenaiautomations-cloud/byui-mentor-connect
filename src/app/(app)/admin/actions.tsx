"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  REJECTION_EMAIL_BODY,
  REJECTION_EMAIL_SUBJECT,
} from "@/lib/rejection-email";

export function ApplicationActions({
  id,
  applicantEmail,
}: {
  id: string;
  applicantEmail: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [toEmail, setToEmail] = useState(applicantEmail);
  const [subject, setSubject] = useState(REJECTION_EMAIL_SUBJECT);
  const [body, setBody] = useState(REJECTION_EMAIL_BODY);

  useEffect(() => {
    if (!rejectOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setRejectOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [rejectOpen, busy]);

  async function approve() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/mentor-applications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(typeof data?.error === "string" ? data.error : "Failed");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  async function sendAndReject() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/mentor-applications/${id}/reject-with-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: toEmail, subject, body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(typeof data?.error === "string" ? data.error : "Failed to send email");
      setBusy(false);
      return;
    }
    setBusy(false);
    setRejectOpen(false);
    router.refresh();
  }

  function openReject() {
    // Reset every time so an admin always sees the canonical template.
    setToEmail(applicantEmail);
    setSubject(REJECTION_EMAIL_SUBJECT);
    setBody(REJECTION_EMAIL_BODY);
    setErr(null);
    setRejectOpen(true);
  }

  return (
    <>
      <div className="mt-4 flex items-center justify-end gap-2">
        {err && !rejectOpen && <span className="text-xs text-red-600">{err}</span>}
        <button
          type="button"
          onClick={openReject}
          disabled={busy}
          className="btn-outline"
        >
          Reject
        </button>
        <button type="button" onClick={approve} disabled={busy} className="btn-primary">
          Approve
        </button>
      </div>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden
            onClick={() => !busy && setRejectOpen(false)}
            className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-email-title"
            className="relative w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-byui-blue sm:p-6"
          >
            <button
              type="button"
              onClick={() => !busy && setRejectOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer disabled:opacity-40"
              disabled={busy}
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
              Application review
            </p>
            <h2
              id="reject-email-title"
              className="mt-1 font-display text-xl font-black leading-tight text-byui-blue-dark"
            >
              Send Rejection Email
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Review the message before sending. The application will be rejected only
              after you confirm.
            </p>

            <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              <div>
                <label htmlFor="reject-to" className="label">
                  Recipient
                </label>
                <input
                  id="reject-to"
                  type="email"
                  required
                  className="input"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <label htmlFor="reject-subject" className="label">
                  Subject
                </label>
                <input
                  id="reject-subject"
                  type="text"
                  required
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <label htmlFor="reject-body" className="label">
                  Message
                </label>
                <textarea
                  id="reject-body"
                  required
                  rows={14}
                  className="input font-mono text-[13px] leading-6"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            {err && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendAndReject}
                disabled={busy || !toEmail || !subject || !body}
                className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-5 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {busy ? "Sending…" : "Send Email & Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
