"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { passwordIssues } from "@/lib/password-validation";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function validate(): string | null {
    if (!email.trim()) return "Email is required.";
    if (!email.trim().toLowerCase().endsWith("@byui.edu")) {
      return "Only @byui.edu emails are allowed.";
    }
    const pw = passwordIssues(password);
    if (pw.length) return pw[0];
    if (password !== confirm) return "Passwords don't match.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Could not create your account.");
        return;
      }
      router.push(body.redirectTo || `/login/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}&purpose=verify`);
      router.refresh();
    });
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
        <p className="mt-1 text-xs text-slate-500">
          We&apos;ll email a verification link before you can sign in.
        </p>
      </div>

      <div>
        <label htmlFor="password" className="label">Password</label>
        <input
          id="password"
          type="password"
          required
          className="input"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          8+ characters with at least one letter and one number.
        </p>
      </div>

      <div>
        <label htmlFor="confirm" className="label">Confirm password</label>
        <input
          id="confirm"
          type="password"
          required
          className="input"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-[11px] text-slate-500">
        We&apos;ll send a verification link to your BYU-I inbox. You can fill
        out the rest of your profile after you verify.
      </p>
    </form>
  );
}
