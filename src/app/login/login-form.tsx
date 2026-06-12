"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm({
  initialEmail = "",
  next,
  initialBanner,
}: {
  initialEmail?: string;
  next?: string;
  initialBanner?: { tone: "success" | "error"; message: string };
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    initialBanner?.tone === "error" ? initialBanner.message : null
  );
  const [info, setInfo] = useState<string | null>(
    initialBanner?.tone === "success" ? initialBanner.message : null
  );
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"password" | "magic">("password");
  // When the signin response says the account is unverified we surface a
  // resend button instead of nudging the user into another login attempt.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, startResend] = useTransition();

  function resendVerification() {
    if (!unverifiedEmail) return;
    setInfo(null);
    startResend(async () => {
      try {
        await fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: unverifiedEmail }),
        });
        setInfo(
          "If your account still needs verifying, we just sent a fresh link."
        );
      } catch {
        setError("Could not reach the server. Try again in a minute.");
      }
    });
  }

  function safeNext(): string {
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    return "/dashboard";
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setUnverifiedEmail(null);
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Sign in failed.");
        if (body?.unverified) {
          setUnverifiedEmail(body.email ?? email.trim().toLowerCase());
        }
        return;
      }
      router.push(body.redirectTo || safeNext());
      router.refresh();
    });
  }

  async function submitMagic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const value = email.trim().toLowerCase();
    if (!value) {
      setError("Enter your BYU-I email first.");
      return;
    }
    if (!value.endsWith("@byui.edu")) {
      setError("Only @byui.edu emails are allowed.");
      return;
    }
    startTransition(async () => {
      // Reuse the existing Auth.js Resend flow via its built-in form post
      // endpoint — keeps the magic-link template + rate-limit untouched.
      const form = new FormData();
      form.append("email", value);
      form.append("callbackUrl", safeNext());
      const res = await fetch("/api/auth/signin/resend", {
        method: "POST",
        body: form,
      });
      if (!res.ok && res.status !== 302) {
        setError("Could not send magic link. Try again in a few minutes.");
        return;
      }
      setInfo(
        "Check your inbox — we just sent a sign-in link. It expires in 24 hours."
      );
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={
            "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer " +
            (mode === "password"
              ? "bg-white text-navy-800 shadow-soft"
              : "text-slate-500 hover:text-slate-700")
          }
        >
          Sign in with password
        </button>
        <button
          type="button"
          onClick={() => setMode("magic")}
          className={
            "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer " +
            (mode === "magic"
              ? "bg-white text-navy-800 shadow-soft"
              : "text-slate-500 hover:text-slate-700")
          }
        >
          Send me a magic link
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={submitPassword} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">BYU-I email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="yourname@byui.edu"
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="label">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-byui-blue hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitMagic} className="space-y-4">
          <div>
            <label htmlFor="email-magic" className="label">BYU-I email</label>
            <input
              id="email-magic"
              name="email"
              type="email"
              required
              placeholder="yourname@byui.edu"
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              We&apos;ll email you a one-time link. No password required.
            </p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full"
          >
            {pending ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          {unverifiedEmail && (
            <div className="mt-2">
              <button
                type="button"
                onClick={resendVerification}
                disabled={resending}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-byui-blue/40 bg-white px-3 py-1.5 text-xs font-bold text-byui-blue-dark transition hover:bg-byui-blue-light/20 disabled:opacity-50 cursor-pointer"
              >
                {resending ? "Sending…" : "Resend verification email"}
              </button>
            </div>
          )}
        </div>
      )}
      {info && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {info}
        </div>
      )}

      <p className="text-center text-sm text-slate-600">
        New to BYUI CAN?{" "}
        <Link
          href="/signup"
          className="font-semibold text-byui-blue hover:underline"
        >
          Create an account →
        </Link>
      </p>
    </div>
  );
}
