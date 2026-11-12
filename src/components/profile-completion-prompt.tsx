"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useReducer, useState } from "react";
import { useClientValue, useHydrated } from "@/lib/use-client-value";
import { shouldNagProfile } from "@/lib/profile-completeness";

const SNOOZE_KEY = "ican-profile-nag-snoozed-at";

// Wall clock, kept out of the component body so render stays pure-looking;
// the snooze window is minutes long, so per-render precision is irrelevant.
function nowMs(): number {
  return Date.now();
}

function readSnooze(): number | null {
  try {
    const v = sessionStorage.getItem(SNOOZE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

// Shown on every app page (except the profile editor) while required
// profile fields are blank. "Not now" only snoozes it for a few minutes.
export function ProfileCompletionPrompt({ missing }: { missing: string[] }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  // Re-read on every render; `bump` re-renders after "Not now" writes it.
  const snoozedAt = useClientValue(readSnooze, null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  // Hidden on this page after "Complete my profile" (navigating away).
  const [hiddenOn, setHiddenOn] = useState<string | null>(null);
  const show = hydrated && hiddenOn !== pathname && shouldNagProfile(pathname, snoozedAt, nowMs());

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show) return null;

  function snooze() {
    try {
      sessionStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      // storage blocked: just hide for this page view
    }
    bump();
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
      <div aria-hidden className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-nag-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-brand sm:p-6"
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Action needed</p>
        <h2 id="profile-nag-title" className="mt-1 font-display text-xl font-black text-brand-dark">
          Finish your profile
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Mentors, admins, and your pod use your profile to match and support you.
          ICAN will keep asking until these are filled in:
        </p>
        <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-950">
          {missing.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {m}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={snooze}
            className="min-h-11 cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Not now
          </button>
          <Link
            href="/settings"
            onClick={() => setHiddenOn(pathname)}
            autoFocus
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Complete my profile
          </Link>
        </div>
      </div>
    </div>
  );
}
