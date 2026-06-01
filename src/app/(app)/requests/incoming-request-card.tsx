"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type IncomingRequest = {
  id: string;
  requestedAt: string;
  message: string | null;
  mentee: {
    name: string | null;
    image: string | null;
    major: string | null;
    minor: string | null;
    semesterLevel: string | null;
    expectedGraduation: string | null;
    bio: string | null;
    careerInterests: string[] | null;
  };
  overlap: {
    sameMajor: boolean;
    sameMinor: boolean;
    sharedInterests: string[];
    topicsHittingInterests: string[];
  };
};

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.round(diff / 60_000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function IncomingRequestCard({ request }: { request: IncomingRequest }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const m = request.mentee;
  const o = request.overlap;

  const chips: { label: string; tone: "emerald" | "navy" | "gold" }[] = [];
  if (o.sameMajor && m.major) chips.push({ label: `Same major · ${m.major}`, tone: "emerald" });
  if (o.sameMinor && m.minor) chips.push({ label: `Same minor · ${m.minor}`, tone: "emerald" });
  for (const i of o.sharedInterests) chips.push({ label: i, tone: "navy" });
  for (const t of o.topicsHittingInterests) chips.push({ label: `Your topic: ${t}`, tone: "gold" });

  async function act(action: "accept" | "decline") {
    setBusy(action);
    setErr(null);
    const res = await fetch(`/api/requests/${request.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setErr("Couldn't save — try again.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <article className="card">
      <header className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={
            m.image ||
            `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(m.name || "")}&backgroundColor=1B3A6B&textColor=ffffff`
          }
          alt=""
          className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Pending request · {relativeTime(request.requestedAt)}
          </p>
          <h3 className="mt-0.5 truncate font-display text-lg font-bold text-navy-800">
            {m.name || "Mentee"}
          </h3>
          <p className="truncate text-xs text-slate-500">
            {m.major}
            {m.minor ? ` · ${m.minor} minor` : ""}
            {m.semesterLevel ? ` · ${m.semesterLevel}` : ""}
            {m.expectedGraduation ? ` · grad ${m.expectedGraduation}` : ""}
          </p>
        </div>
      </header>

      {m.bio && (
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{m.bio}</p>
      )}

      {chips.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            What you share
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <span
                key={i}
                className={
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 " +
                  (c.tone === "emerald"
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : c.tone === "gold"
                    ? "bg-gold-50 text-gold-800 ring-gold-200"
                    : "bg-navy-50 text-navy-800 ring-navy-100")
                }
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs italic text-slate-400">
          No major/interest overlap on file — judge the ask on its own merits.
        </p>
      )}

      {m.careerInterests && m.careerInterests.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Their career interests
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.careerInterests.map((i) => (
              <span
                key={i}
                className={
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 " +
                  (o.sharedInterests.some((s) => s.toLowerCase() === i.toLowerCase())
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                    : "bg-slate-50 text-slate-600 ring-slate-200")
                }
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      )}

      {request.message && (
        <blockquote className="mt-4 rounded-xl border-l-4 border-gold-400 bg-gold-50 px-3 py-2 text-sm italic text-navy-800">
          &ldquo;{request.message}&rdquo;
        </blockquote>
      )}

      <footer className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {err && <span className="self-center text-xs font-semibold text-rose-600">{err}</span>}
        <button
          type="button"
          onClick={() => act("decline")}
          disabled={busy !== null}
          className="btn-outline disabled:opacity-50"
        >
          {busy === "decline" ? "…" : "Decline"}
        </button>
        <button
          type="button"
          onClick={() => act("accept")}
          disabled={busy !== null}
          className="btn-gold disabled:opacity-50"
        >
          {busy === "accept" ? "…" : "Accept"}
        </button>
      </footer>
    </article>
  );
}
