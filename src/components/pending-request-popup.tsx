"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type PendingRequest = {
  id: string;
  menteeName: string | null;
  menteeImage: string | null;
  menteeMajor: string | null;
  menteeSemester: string | null;
  menteeExpectedGrad: string | null;
  message: string | null;
  requestedAt: string;
};

const DISMISS_KEY = "pending-popup-dismissed-ids";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export function PendingRequestPopup({ requests }: { requests: PendingRequest[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | "accepted" | "declined" | "error">(null);
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(readDismissed());
    setHydrated(true);
  }, []);

  // Lock body scroll while open. Skip on small screens where the popup is
  // already full-bleed and scrolling the underlying page isn't needed.
  useEffect(() => {
    if (!hydrated) return;
    const queue = requests.filter((r) => !dismissed.has(r.id));
    if (queue.length === 0) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [hydrated, dismissed, requests]);

  if (!hydrated) return null;

  const queue = requests.filter((r) => !dismissed.has(r.id));
  if (queue.length === 0) return null;
  const current = queue[Math.min(index, queue.length - 1)];

  function dismissCurrent() {
    const next = new Set(dismissed);
    next.add(current.id);
    setDismissed(next);
    writeDismissed(next);
    setResult(null);
    setIndex(0);
  }

  async function act(action: "accept" | "decline") {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/requests/${current.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        setResult("error");
        setBusy(false);
        return;
      }
      setResult(action === "accept" ? "accepted" : "declined");
      router.refresh();
      // Brief confirmation, then drop the handled request from the queue so the
      // next pending one slides in.
      setTimeout(() => {
        dismissCurrent();
        setBusy(false);
      }, 900);
    } catch {
      setResult("error");
      setBusy(false);
    }
  }

  const total = queue.length;
  const positionLabel = total > 1 ? `Request ${Math.min(index + 1, total)} of ${total}` : "New mentor request";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={dismissCurrent}
        className="absolute inset-0 bg-navy-900/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-popup-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-gold-400 sm:p-6"
      >
        <button
          type="button"
          onClick={dismissCurrent}
          aria-label="Maybe later"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6 18 18M18 6 6 18" />
          </svg>
        </button>

        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">{positionLabel}</p>
        <h2
          id="pending-popup-title"
          className="mt-1 font-display text-xl font-black leading-tight text-navy-800"
        >
          {current.menteeName} wants you as a mentor.
        </h2>

        <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              current.menteeImage ||
              `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(current.menteeName || "")}&backgroundColor=7c3aed&textColor=ffffff`
            }
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy-800">{current.menteeName}</p>
            <p className="truncate text-xs text-slate-500">
              {current.menteeMajor}
              {current.menteeSemester ? ` · ${current.menteeSemester}` : ""}
              {current.menteeExpectedGrad ? ` · grad ${current.menteeExpectedGrad}` : ""}
            </p>
          </div>
        </div>

        {current.message && (
          <blockquote className="mt-3 rounded-xl border-l-4 border-gold-400 bg-gold-50 px-3 py-2 text-sm italic text-navy-800">
            &ldquo;{current.message}&rdquo;
          </blockquote>
        )}

        {result === "accepted" ? (
          <div className="mt-5 flex flex-col items-stretch gap-2">
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
              ✓ Accepted — match created.
            </div>
            <Link
              href="/matches"
              className="inline-flex items-center justify-center rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-navy-900 hover:bg-gold-400 cursor-pointer"
            >
              Open match →
            </Link>
          </div>
        ) : result === "declined" ? (
          <div className="mt-5 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-600">
            Declined.
          </div>
        ) : (
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {result === "error" && (
              <span className="self-center text-xs font-semibold text-rose-600">Try again</span>
            )}
            <button
              type="button"
              onClick={() => act("decline")}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => act("accept")}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-lg bg-gold-500 px-5 py-2 text-sm font-bold text-navy-900 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {busy ? "…" : "Accept"}
            </button>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-slate-400">
          You can always review pending requests on the Requests page.
        </p>
      </div>
    </div>
  );
}
