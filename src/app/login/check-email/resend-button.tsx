"use client";

import { useState, useTransition } from "react";

export function ResendVerifyButton({ email }: { email: string }) {
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resend() {
    setInfo(null);
    startTransition(async () => {
      try {
        await fetch("/api/auth/resend-verification", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setInfo(
          "If your account still needs verifying, we just sent a fresh link."
        );
      } catch {
        setInfo("Could not reach the server. Try again in a minute.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={resend}
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-byui-blue/40 bg-white px-4 py-2 text-sm font-bold text-byui-blue-dark transition hover:bg-byui-blue-light/20 disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Sending…" : "Resend verification email"}
      </button>
      {info && (
        <p className="mt-2 text-xs text-slate-600">{info}</p>
      )}
    </div>
  );
}
