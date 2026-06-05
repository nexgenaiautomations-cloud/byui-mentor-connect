"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ActiveMatchRow = {
  id: string;
  mentorName: string | null;
  mentorImage: string | null;
  mentorEmail: string | null;
  menteeName: string | null;
  menteeImage: string | null;
  menteeEmail: string | null;
  meetingCount: number;
  startedAt: string;
  lastActivityAt: string;
};

export type EndedMatchRow = {
  id: string;
  status: "completed" | "cancelled";
  endedAt: string | null;
  mentorName: string | null;
  mentorImage: string | null;
  mentorEmail: string | null;
  menteeName: string | null;
  menteeImage: string | null;
  menteeEmail: string | null;
};

type ActiveSortKey = "mentor" | "mentee" | "meetings" | "started" | "lastActivity";
type EndedSortKey = "mentor" | "mentee" | "status" | "ended";
type SortDir = "asc" | "desc";

function avatarUrl(name: string | null, email: string | null) {
  const seed = encodeURIComponent(name || email || "");
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=1B3A6B&textColor=ffffff`;
}

function daysSince(d: string) {
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

function cmp<T>(a: T, b: T): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls sort last in asc
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

function SortHeader<K extends string>({
  k,
  current,
  dir,
  onSort,
  children,
  className = "",
}: {
  k: K;
  current: K;
  dir: SortDir;
  onSort: (k: K) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = current === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={"select-none " + className}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={
          "flex items-center gap-1 text-left text-[11px] font-bold uppercase tracking-wider transition cursor-pointer " +
          (active ? "text-byui-blue-dark" : "text-slate-500 hover:text-byui-blue-dark")
        }
      >
        <span>{children}</span>
        <span aria-hidden className="text-[10px] leading-none">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function PersonCell({
  name,
  image,
  email,
}: {
  name: string | null;
  image: string | null;
  email: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image || avatarUrl(name, email)}
        alt=""
        className="h-8 w-8 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-navy-800">{name ?? "—"}</p>
        <p className="truncate text-[11px] text-slate-500">{email}</p>
      </div>
    </div>
  );
}

export function ActiveMatchesTable({ rows }: { rows: ActiveMatchRow[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<ActiveSortKey>("started");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [confirming, setConfirming] = useState<ActiveMatchRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onSort(k: ActiveSortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case "mentor":
          r = cmp(a.mentorName, b.mentorName);
          break;
        case "mentee":
          r = cmp(a.menteeName, b.menteeName);
          break;
        case "meetings":
          r = cmp(a.meetingCount, b.meetingCount);
          break;
        case "started":
          r = cmp(new Date(a.startedAt).getTime(), new Date(b.startedAt).getTime());
          break;
        case "lastActivity":
          r = cmp(
            new Date(a.lastActivityAt).getTime(),
            new Date(b.lastActivityAt).getTime()
          );
          break;
      }
      return sortDir === "asc" ? r : -r;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  // Lock scroll + Escape closes confirm modal.
  useEffect(() => {
    if (!confirming) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setConfirming(null);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [confirming, busy]);

  async function breakMatch() {
    if (!confirming) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/matches/${confirming.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(typeof data?.error === "string" ? data.error : "Failed to break match");
      setBusy(false);
      return;
    }
    setBusy(false);
    setConfirming(null);
    router.refresh();
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No active matches yet.</p>;
  }

  return (
    <>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <SortHeader
                  k="mentor"
                  current={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="px-5 py-3"
                >
                  Mentor
                </SortHeader>
                <SortHeader
                  k="mentee"
                  current={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="px-3 py-3"
                >
                  Mentee
                </SortHeader>
                <SortHeader
                  k="meetings"
                  current={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="px-3 py-3"
                >
                  Meetings
                </SortHeader>
                <SortHeader
                  k="started"
                  current={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="px-3 py-3"
                >
                  Started
                </SortHeader>
                <SortHeader
                  k="lastActivity"
                  current={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="px-5 py-3"
                >
                  Last activity
                </SortHeader>
                <th scope="col" className="w-12 px-3 py-3 text-right">
                  <span className="sr-only">Break match</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sorted.map((m) => {
                const inactive = daysSince(m.lastActivityAt);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <PersonCell
                        name={m.mentorName}
                        image={m.mentorImage}
                        email={m.mentorEmail}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <PersonCell
                        name={m.menteeName}
                        image={m.menteeImage}
                        email={m.menteeEmail}
                      />
                    </td>
                    <td className="px-3 py-3 text-slate-700">{m.meetingCount}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {new Date(m.startedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          inactive > 30
                            ? "pill-pending"
                            : inactive > 14
                            ? "pill bg-amber-50 text-amber-700 border-amber-200"
                            : "pill-accepted"
                        }
                      >
                        {inactive}d ago
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setConfirming(m)}
                        aria-label={`Break match between ${m.mentorName ?? "mentor"} and ${m.menteeName ?? "mentee"}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M6 6 18 18M18 6 6 18" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden
            onClick={() => !busy && setConfirming(null)}
            className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="break-match-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-red-200 sm:p-6"
          >
            <h2
              id="break-match-title"
              className="font-display text-xl font-black leading-tight text-byui-blue-dark"
            >
              Break this match?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Are you sure you want to break the match between{" "}
              <strong className="font-bold text-byui-blue-dark">
                {confirming.mentorName ?? "mentor"}
              </strong>{" "}
              and{" "}
              <strong className="font-bold text-byui-blue-dark">
                {confirming.menteeName ?? "mentee"}
              </strong>
              ?
            </p>
            <p className="mt-2 text-xs text-slate-500">
              The match will move to the Ended list. Past meeting logs and history are
              preserved.
            </p>

            {err && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={breakMatch}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {busy ? "Breaking…" : "Break Match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EndedMatchesTable({ rows }: { rows: EndedMatchRow[] }) {
  const [sortKey, setSortKey] = useState<EndedSortKey>("ended");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function onSort(k: EndedSortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case "mentor":
          r = cmp(a.mentorName, b.mentorName);
          break;
        case "mentee":
          r = cmp(a.menteeName, b.menteeName);
          break;
        case "status":
          r = cmp(a.status, b.status);
          break;
        case "ended":
          r = cmp(
            a.endedAt ? new Date(a.endedAt).getTime() : 0,
            b.endedAt ? new Date(b.endedAt).getTime() : 0
          );
          break;
      }
      return sortDir === "asc" ? r : -r;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  if (rows.length === 0) return null;

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <SortHeader
                k="mentor"
                current={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="px-5 py-3"
              >
                Mentor
              </SortHeader>
              <SortHeader
                k="mentee"
                current={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="px-3 py-3"
              >
                Mentee
              </SortHeader>
              <SortHeader
                k="status"
                current={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="px-3 py-3"
              >
                Status
              </SortHeader>
              <SortHeader
                k="ended"
                current={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="px-5 py-3"
              >
                Ended
              </SortHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <PersonCell
                    name={m.mentorName}
                    image={m.mentorImage}
                    email={m.mentorEmail}
                  />
                </td>
                <td className="px-3 py-3">
                  <PersonCell
                    name={m.menteeName}
                    image={m.menteeImage}
                    email={m.menteeEmail}
                  />
                </td>
                <td className="px-3 py-3">
                  <span className="pill-declined">{m.status}</span>
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">
                  {m.endedAt ? new Date(m.endedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
