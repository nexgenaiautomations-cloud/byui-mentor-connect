"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AGREEMENT_ITEMS, type AgreementKey } from "@/lib/agreements";

const LINK =
  "font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer";

export function AgreementForm() {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<AgreementKey, boolean>>({
    independent: false,
    optional: false,
    outcomes: false,
    safety: false,
    terms: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const allChecked = Object.values(checked).every(Boolean);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allChecked) {
      setError("Please check every box to continue.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checked),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Something went wrong. Please try again.");
        return;
      }
      router.push(body.redirectTo || "/onboarding");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <fieldset className="space-y-3">
        <legend className="sr-only">Acknowledgments</legend>
        {AGREEMENT_ITEMS.map((item) => (
          <label
            key={item.key}
            htmlFor={`agree-${item.key}`}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6 transition-colors duration-200 ${
              checked[item.key]
                ? "border-brand bg-plum-50 text-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-light"
            }`}
          >
            <input
              id={`agree-${item.key}`}
              type="checkbox"
              checked={checked[item.key]}
              onChange={(e) => setChecked((c) => ({ ...c, [item.key]: e.target.checked }))}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-brand"
            />
            <span>
              {item.key === "terms" ? (
                <>
                  I agree to the{" "}
                  <a href="/terms" target="_blank" rel="noreferrer" className={LINK}>
                    Terms of Use
                  </a>{" "}
                  and the{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className={LINK}>
                    Privacy Notice
                  </a>
                  .
                </>
              ) : (
                item.label
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button type="submit" disabled={pending || !allChecked} className="btn-primary w-full">
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
