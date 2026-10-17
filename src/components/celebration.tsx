"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import type { CelebrationKind } from "@/lib/possible-actions";

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
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-2 border-gold-400 bg-brand-dark/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
        <div
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-400 text-brand-dark"
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


// ───────────────────────── Offer celebrations ─────────────────────────
// One animation per offer type, played after a student logs it:
//   internship → Trophy pop      (dimmed page, side cannons, trophy card)
//   part_time  → Fireworks night (deep purple, bursts, gold "Congratulations")
//   full_time  → Gold seal       (no overlay: "HIRED!" stamp, streamers, banner)
// All auto-dismiss; click, Esc, or "Keep going" closes early. Confetti is
// skipped for prefers-reduced-motion and the CSS animations fall back to a
// static card (see .ican-* in globals.css).

const BRAND_COLORS = ["#6D28D9", "#A21CAF", "#C4B5FD", "#E9C46A", "#F4D97B", "#FFFFFF"];
const GOLDS = ["#E9C46A", "#F4D97B", "#C9A227", "#FFF6D6"];
const VIOLETS = ["#C4B5FD", "#8B5CF6", "#A21CAF", "#FFFFFF"];

const COPY: Record<CelebrationKind, { title: string; line: string }> = {
  internship: { title: "Internship offer!", line: "You landed an internship. It's on your ICAN record." },
  part_time: { title: "Job offer!", line: "A career-related part-time offer. Your hard work just paid off." },
  full_time: { title: "Full-time offer!", line: "The big one. All that work just paid off." },
};

const DURATION: Record<CelebrationKind, number> = { internship: 7000, part_time: 7500, full_time: 6000 };

type Confetti = (opts: Record<string, unknown>) => void;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function loadConfetti(): Promise<Confetti | null> {
  try {
    return (await import("canvas-confetti")).default as unknown as Confetti;
  } catch {
    return null;
  }
}

function TrophyIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M5 4h14v3a5 5 0 0 1-5 5h-.07A5 5 0 0 1 13 14v2.5a1.5 1.5 0 0 0 1.5 1.5H16v2H8v-2h1.5A1.5 1.5 0 0 0 11 16.5V14a5 5 0 0 1-.93-2H10a5 5 0 0 1-5-5V4zm14 0h2v3a3 3 0 0 1-3 3v-2a1 1 0 0 0 1-1V4zM3 4h2v3a1 1 0 0 0 1 1v2a3 3 0 0 1-3-3V4z" />
    </svg>
  );
}

export function OfferCelebration({
  kind,
  onDone,
}: {
  kind: CelebrationKind | null;
  onDone: () => void;
}) {
  const timers = useRef<number[]>([]);
  const keepGoing = useRef<HTMLButtonElement>(null);
  // Parent passes an inline onDone; keep it in a ref so re-renders (e.g.
  // router.refresh after saving) don't restart the animation.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const close = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    onDoneRef.current();
  }, []);

  useEffect(() => {
    if (!kind) return;
    const later = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    later(close, DURATION[kind]);
    keepGoing.current?.focus();

    if (!prefersReducedMotion()) {
      void loadConfetti().then((fire) => {
        if (!fire) return;
        if (kind === "internship") {
          const cannons = () => {
            fire({ particleCount: 70, angle: 60, spread: 60, startVelocity: 62, origin: { x: 0, y: 0.85 }, colors: BRAND_COLORS, zIndex: 100 });
            fire({ particleCount: 70, angle: 120, spread: 60, startVelocity: 62, origin: { x: 1, y: 0.85 }, colors: BRAND_COLORS, zIndex: 100 });
          };
          cannons();
          later(cannons, 350);
          later(cannons, 800);
        } else if (kind === "part_time") {
          for (let i = 0; i < 9; i++) {
            later(() => {
              fire({
                particleCount: 90,
                spread: 360,
                startVelocity: 26,
                ticks: 70,
                gravity: 0.9,
                decay: 0.92,
                scalar: 0.9,
                origin: { x: 0.15 + Math.random() * 0.7, y: 0.15 + Math.random() * 0.35 },
                colors: Math.random() > 0.5 ? GOLDS : VIOLETS,
                zIndex: 100,
              });
            }, 150 + i * 380);
          }
        } else {
          const end = Date.now() + 1600;
          const stream = () => {
            fire({
              particleCount: 4,
              angle: 270,
              spread: 50,
              startVelocity: 18,
              gravity: 0.7,
              ticks: 260,
              origin: { x: Math.random(), y: -0.05 },
              colors: BRAND_COLORS,
              shapes: ["square"],
              scalar: 1.3,
              drift: (Math.random() - 0.5) * 1.2,
              zIndex: 100,
            });
            if (Date.now() < end) later(stream, 30);
          };
          stream();
        }
      });
    }

    const pending = timers.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      pending.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, [kind, close]);

  if (!kind) return null;
  const copy = COPY[kind];

  const buttons = (dark = false) => (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      <Link
        href="/trophy-case"
        onClick={close}
        className={
          dark
            ? "rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 cursor-pointer"
            : "rounded-lg border border-plum-200 bg-white px-4 py-2 text-sm font-semibold text-plum-700 transition-colors hover:bg-plum-50 cursor-pointer"
        }
      >
        See my trophies
      </Link>
      <button
        ref={keepGoing}
        type="button"
        onClick={close}
        className={
          dark
            ? "rounded-lg bg-gold-400 px-4 py-2 text-sm font-bold text-brand-ink transition-colors hover:bg-gold-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            : "rounded-lg bg-plum-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-plum-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        }
      >
        Keep going
      </button>
    </div>
  );

  if (kind === "internship") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-celebration-title"
        className="fixed inset-0 z-[90] grid place-items-center p-4"
      >
        <div className="ican-fade absolute inset-0 bg-brand-ink/50 backdrop-blur-sm" onClick={close} aria-hidden />
        <div className="ican-ring ican-pop relative w-full max-w-sm">
          <div className="rounded-[21px] bg-white px-6 pb-6 pt-7 text-center shadow-2xl">
            <div className="ican-trophy mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full text-brand-dark">
              <TrophyIcon className="h-11 w-11" />
            </div>
            <p className="font-brand text-xs font-semibold tracking-[0.3em] text-brand">ICAN</p>
            <h2 id="offer-celebration-title" className="mt-2 font-display text-3xl font-black text-brand-ink">
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{copy.line}</p>
            {buttons()}
          </div>
        </div>
      </div>
    );
  }

  if (kind === "part_time") {
    const word = "Congratulations";
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-celebration-title"
        className="ican-fade fixed inset-0 z-[90] grid place-items-center bg-[#0e0520]/90 p-4 text-center text-white"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div>
          <p className="font-brand text-xs font-semibold tracking-[0.5em] text-brand-light">ICAN</p>
          <h2
            id="offer-celebration-title"
            aria-label={`${word}! ${copy.title}`}
            className="mt-4 font-brand text-4xl font-bold tracking-[0.06em] drop-shadow-[0_0_18px_rgba(233,196,106,0.35)] sm:text-6xl"
          >
            {[...word].map((ch, i) => (
              <span key={i} aria-hidden className="ican-letter" style={{ animationDelay: `${0.35 + i * 0.05}s` }}>
                {ch}
              </span>
            ))}
          </h2>
          <p className="ican-late mt-3 text-base text-white/85" style={{ animationDelay: "1.3s" }}>
            {copy.line}
          </p>
          <div className="ican-late" style={{ animationDelay: "1.7s" }}>
            {buttons(true)}
          </div>
        </div>
      </div>
    );
  }

  // full_time: no blocking overlay — a stamp and a banner over the page.
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-[90]">
      <div className="ican-stamp absolute right-[6%] top-[14%] h-40 w-40 sm:h-48 sm:w-48" aria-hidden>
        <HiredSeal />
      </div>
      <div className="ican-slide-up pointer-events-auto absolute inset-x-0 bottom-6 mx-auto flex w-[min(440px,calc(100%-2rem))] items-center gap-3 rounded-2xl border-2 border-gold-400 bg-brand-ink px-4 py-3 text-white shadow-2xl">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-400 text-brand-ink">
          <TrophyIcon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-black">{copy.title} You&apos;re hired.</span>
          <span className="block text-xs text-brand-light">{copy.line}</span>
        </span>
        <button
          ref={keepGoing}
          type="button"
          onClick={close}
          aria-label="Close celebration"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Gold starburst seal: "HIRED!" / "Approved for adulting", ringed by
// "ICAN · Certified employable".
function HiredSeal() {
  const n = 24;
  const points: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 84 : 96;
    const a = (Math.PI * i) / n;
    points.push(`${(100 + r * Math.cos(a)).toFixed(1)} ${(100 + r * Math.sin(a)).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_8px_16px_rgba(120,80,0,0.35)]">
      <defs>
        <radialGradient id="ican-seal-fill" cx="38%" cy="32%">
          <stop offset="0" stopColor="#FFF6D6" />
          <stop offset=".45" stopColor="#E9C46A" />
          <stop offset="1" stopColor="#A77F12" />
        </radialGradient>
        <path id="ican-seal-arc" d="M100 100 m-60 0 a60 60 0 1 1 120 0 a60 60 0 1 1 -120 0" />
      </defs>
      <path fill="url(#ican-seal-fill)" d={`M${points.join(" L")} Z`} />
      <circle cx="100" cy="100" r="76" fill="none" stroke="#7A5B0C" strokeWidth="2" strokeDasharray="3 5" />
      <circle cx="100" cy="100" r="44" fill="none" stroke="#7A5B0C" strokeOpacity=".5" strokeWidth="1.5" />
      <text fontFamily="Cinzel, Georgia, serif" fontSize="9.5" fontWeight="700" fill="#4C1D95">
        <textPath href="#ican-seal-arc" textLength="372" lengthAdjust="spacing">
          ICAN · CERTIFIED EMPLOYABLE · ICAN · CERTIFIED EMPLOYABLE ·
        </textPath>
      </text>
      <text x="100" y="101" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontSize="25" fontWeight="700" fill="#2E1065">
        HIRED!
      </text>
      <text x="100" y="118" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontSize="8.5" fontWeight="700" letterSpacing="0.6" fill="#4C1D95">
        APPROVED FOR
      </text>
      <text x="100" y="129" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontSize="8.5" fontWeight="700" letterSpacing="0.6" fill="#4C1D95">
        ADULTING
      </text>
    </svg>
  );
}
