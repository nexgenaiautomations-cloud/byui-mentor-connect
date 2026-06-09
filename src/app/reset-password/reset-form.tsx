"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { passwordIssues } from "@/lib/password-validation";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [linkDead, setLinkDead] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const issues = passwordIssues(password);
    if (issues.length) {
      setError(issues[0]);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Token errors get a distinct "request a new link" path.
        const msg = body?.error || "Could not reset password.";
        if (msg.includes("expired") || msg.includes("invalid")) {
          setLinkDead(true);
        }
        setError(msg);
        return;
      }
      router.push(body.redirectTo || "/dashboard");
      router.refresh();
    });
  }

  if (linkDead) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">This reset link doesn&apos;t work anymore.</p>
        <p>It may have expired (1 hour) or been used already.</p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-4 py-2 text-xs font-bold text-white transition hover:bg-byui-blue-dark cursor-pointer"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="label">New password</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          className="input"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          8+ characters with at least one letter and one number.
        </p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirm new password</label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          className="input"
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
        {pending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
