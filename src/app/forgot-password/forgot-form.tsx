"use client";

import { useState, useTransition } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!value) {
      setError("Enter your email first.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Could not send reset link.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-semibold">Check your email.</p>
        <p>
          If an account exists for <span className="font-mono">{email}</span>, a
          reset link is on its way. It expires in one hour and can only be used
          once.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setError(null);
          }}
          className="text-xs font-semibold text-emerald-700 underline cursor-pointer"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">BYU-I email</label>
        <input
          id="email"
          type="email"
          required
          placeholder="yourname@byui.edu"
          className="input"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
