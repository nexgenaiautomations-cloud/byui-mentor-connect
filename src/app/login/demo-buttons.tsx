"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = [
  {
    role: "admin",
    title: "Admin",
    name: "Avery Admin",
    blurb: "See the full program dashboard, review mentor applications.",
    badge: "bg-navy-700 text-white",
  },
  {
    role: "mentor",
    title: "Mentor",
    name: "Morgan Mentor",
    blurb: "Approved mentor — see incoming requests, log meetings.",
    badge: "bg-emerald-700 text-white",
  },
  {
    role: "member",
    title: "Member",
    name: "Mason Member",
    blurb: "New member browsing mentors and applying.",
    badge: "bg-violet-700 text-white",
  },
] as const;

export function DemoButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loginAs(role: string) {
    setBusy(role);
    setErr(null);
    const res = await fetch("/api/demo-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body?.error || "Demo login failed");
      setBusy(null);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Or try the demo
        </span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid grid-cols-1 gap-2">
        {ROLES.map((r) => (
          <button
            key={r.role}
            onClick={() => loginAs(r.role)}
            disabled={busy !== null}
            className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-navy-300 hover:bg-navy-50/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${r.badge}`}
            >
              {r.title[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy-800">
                Sign in as {r.title}{" "}
                <span className="font-normal text-slate-500">({r.name})</span>
              </p>
              <p className="text-xs text-slate-500">{r.blurb}</p>
            </div>
            <span className="text-slate-300 group-hover:text-navy-700">→</span>
          </button>
        ))}
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
      <p className="mt-3 text-center text-xs text-slate-400">
        Demo accounts skip email verification. For evaluation only.
      </p>
    </div>
  );
}
