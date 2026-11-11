"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PledgeForm({ expectedName, next }: { expectedName: string; next: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toLocaleDateString(undefined, { dateStyle: "long" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/pledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Could not save your signature.");
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your signature.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="text-sm font-semibold text-slate-800">
        I commit to the ICAN 3-2-1 standard.
      </p>
      <label htmlFor="pledge-signature" className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-600">
        Sign by typing your full name{expectedName ? ` (${expectedName})` : ""}
      </label>
      <input
        id="pledge-signature"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        aria-invalid={!!error}
        aria-describedby={error ? "pledge-error" : "pledge-date"}
        placeholder="Your name"
        className="mt-1 w-full border-0 border-b-2 border-slate-400 bg-transparent px-1 pb-1 pt-2 font-signature text-4xl text-plum-800 placeholder:text-slate-300 focus:border-brand focus:outline-none focus:ring-0"
      />
      <p id="pledge-date" className="mt-1 text-xs text-slate-600">Signed {today}</p>
      {error && (
        <p id="pledge-error" role="alert" className="mt-3 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || name.trim().length < 2}
        className="mt-5 min-h-11 w-full cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Signing…" : "I commit · Sign the pledge"}
      </button>
    </form>
  );
}
