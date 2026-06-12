"use client";

import { useEffect } from "react";

export type TrophyToast = {
  key: string;
  title: string;
};

// Fire-confetti helper — dynamic import keeps canvas-confetti out of every
// route's bundle. Safe to await; if the module fails to load we just skip
// the burst rather than crash the page.
export async function fireConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 100,
        startVelocity: 35,
        origin: { y: 0.7 },
      });
    }, 220);
  } catch {
    // canvas-confetti missing — skip silently.
  }
}

// Slim, fixed-position toast that mimics an Xbox-style achievement card.
// Auto-dismisses after `durationMs` so the user doesn't have to interact.
export function AchievementToast({
  trophies,
  onDismiss,
  durationMs = 4500,
}: {
  trophies: TrophyToast[];
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (trophies.length === 0) return;
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [trophies, onDismiss, durationMs]);

  if (trophies.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-2 border-gold-400 bg-byui-blue-dark/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
        <div
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-400 text-byui-blue-dark"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="currentColor"
            aria-hidden
          >
            <path d="M5 4h14v3a5 5 0 0 1-5 5h-.07A5 5 0 0 1 9 14v2.5A1.5 1.5 0 0 0 10.5 18H13v2H7v-2h2.5A1.5 1.5 0 0 0 11 16.5V14a5 5 0 0 1-5-5V7H3v3a3 3 0 0 0 3 3v-2a1 1 0 0 1-1-1V8H4V4zm14 0v4a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3V4h-2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-300">
            Achievement unlocked
          </p>
          <p className="truncate font-display text-sm font-black leading-tight">
            {trophies.map((t) => t.title).join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}

// Full-screen gold celebration shown when the student logs a job/internship
// offer accomplishment. Auto-dismisses after `durationMs`.
export function GoldCongratulations({
  show,
  onDone,
  durationMs = 5000,
}: {
  show: boolean;
  onDone: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(onDone, durationMs);
    return () => window.clearTimeout(t);
  }, [show, onDone, durationMs]);

  if (!show) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Congratulations"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-gradient-to-br from-gold-300 via-gold-400 to-gold-500 text-byui-blue-dark"
    >
      <p className="font-display text-xs font-black uppercase tracking-[0.35em] text-byui-blue/80">
        BYUI CAN
      </p>
      <h1 className="mt-3 text-center font-display text-5xl font-black tracking-tight drop-shadow-[0_2px_0_rgba(255,255,255,0.4)] sm:text-7xl">
        Congratulations!
      </h1>
      <p className="mt-4 max-w-md px-6 text-center text-sm font-semibold text-byui-blue-dark/85 sm:text-base">
        Huge win — your hard work just paid off.
      </p>
    </div>
  );
}
