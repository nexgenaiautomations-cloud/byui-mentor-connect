"use client";

import { useEffect, useState } from "react";

export function CanTodosButton({ actions }: { actions: readonly string[] }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while open and close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white hover:text-byui-blue-dark cursor-pointer"
      >
        CAN To-Dos →
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="can-todos-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-byui-blue sm:p-6"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
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
              BYUI CAN
            </p>
            <h2
              id="can-todos-title"
              className="mt-1 font-display text-xl font-black leading-tight text-byui-blue-dark"
            >
              CAN To-Dos
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Career accomplishments mentors and mentees can work on together.
            </p>

            <ul className="mt-4 max-h-[60vh] space-y-1.5 overflow-y-auto pr-1 text-sm">
              {actions.map((a, i) => (
                <li
                  key={a}
                  className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-700"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-byui-blue text-[10px] font-black text-white"
                  >
                    {i + 1}
                  </span>
                  <span className="leading-snug">{a}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
