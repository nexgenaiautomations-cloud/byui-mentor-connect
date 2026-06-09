"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LogActivityForm } from "./form";
import { LogActions } from "../matches/log-actions";

type Match = {
  id: string;
  menteeId: string;
  menteeName: string | null;
  menteeImage: string | null;
  menteeMajor: string | null;
  startedAt: Date;
};

type RemoteLog = {
  id: string;
  matchId: string | null;
  studentId: string | null;
  menteeId: string | null;
  meetingDate: string;
  meetingType: string;
  durationMinutes: number | null;
  topicsDiscussed: string | null;
  actionItems: string | null;
  isSystemGenerated: boolean;
  createdBy: string | null;
};

export function MentorWorkspace({
  matches,
  initialMatchId,
}: {
  matches: Match[];
  initialMatchId?: string;
}) {
  const firstId =
    initialMatchId && matches.some((m) => m.id === initialMatchId)
      ? initialMatchId
      : matches[0]?.id ?? "";
  const [matchId, setMatchId] = useState(firstId);
  const [logs, setLogs] = useState<RemoteLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === matchId),
    [matches, matchId]
  );

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meeting-logs");
      if (!res.ok) throw new Error("Failed to load activity");
      const body = await res.json();
      setLogs(body.logs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial + after any save/edit/delete: re-fetch.
  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Logs for the currently-selected mentee — covers logs the mentor created,
  // ones the student self-logged, and system goal-met events.
  const menteeLogs = useMemo(() => {
    if (!selectedMatch) return [];
    return logs.filter(
      (l) =>
        l.studentId === selectedMatch.menteeId ||
        l.menteeId === selectedMatch.menteeId
    );
  }, [logs, selectedMatch]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="card">
        {matches.length === 0 ? (
          <p className="text-sm text-slate-500">
            You don&apos;t have any active mentees yet. Once a mentee&apos;s request
            is accepted, log activities here.
          </p>
        ) : (
          <LogActivityForm
            mode="mentor"
            matches={matches}
            selectedMatchId={matchId}
            onMatchIdChange={setMatchId}
            onSaved={fetchLogs}
          />
        )}
      </div>

      <div className="card flex min-h-[280px] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-byui-blue-dark">
              {selectedMatch?.menteeName
                ? `${selectedMatch.menteeName}'s activity`
                : "Recent activity"}
            </h2>
            <p className="text-xs text-slate-500">
              Includes self-logged, mentor-logged, and goal-met system events.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="text-[11px] font-bold uppercase tracking-wider text-byui-blue hover:underline disabled:opacity-40 cursor-pointer"
            aria-label="Refresh activity"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && menteeLogs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No activity logged for this mentee yet. Use the form on the left to
            log their first session.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 overflow-y-auto pr-1">
            {menteeLogs.slice(0, 50).map((l) => (
              <li
                key={l.id}
                className={
                  "rounded-xl border p-3 " +
                  (l.isSystemGenerated
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-slate-100 bg-white")
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-byui-blue-dark">
                    {new Date(l.meetingDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <div className="flex items-center gap-1">
                    <AuthorBadge createdBy={l.createdBy} />
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                        (l.isSystemGenerated
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-byui-blue-light/30 text-byui-blue-dark")
                      }
                    >
                      {l.isSystemGenerated
                        ? "Goal met"
                        : l.meetingType.replace("_", " ")}
                    </span>
                  </div>
                </div>
                {l.durationMinutes ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {l.durationMinutes} minutes
                  </p>
                ) : null}
                {l.topicsDiscussed && (
                  <p className="mt-1 text-xs leading-snug text-slate-700">
                    {l.isSystemGenerated ? (
                      l.topicsDiscussed
                    ) : (
                      <>
                        <span className="font-semibold text-slate-500">
                          Accomplishments:
                        </span>{" "}
                        {l.topicsDiscussed
                          .split(" · ")
                          .filter(Boolean)
                          .join(", ")}
                      </>
                    )}
                  </p>
                )}
                {l.actionItems && (
                  <p className="mt-1 text-xs leading-snug text-slate-600">
                    <span className="font-semibold text-slate-500">
                      Next steps:
                    </span>{" "}
                    {l.actionItems}
                  </p>
                )}
                <LogActions
                  log={{
                    id: l.id,
                    meetingDate: new Date(l.meetingDate)
                      .toISOString()
                      .slice(0, 10),
                    topicsDiscussed: l.topicsDiscussed,
                    actionItems: l.actionItems,
                    isSystemGenerated: l.isSystemGenerated,
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AuthorBadge({ createdBy }: { createdBy: string | null }) {
  if (!createdBy || createdBy === "mentor") return null;
  const map: Record<string, { label: string; cls: string }> = {
    mentee: { label: "Self-logged", cls: "bg-violet-100 text-violet-800" },
    admin: { label: "Admin", cls: "bg-slate-200 text-slate-800" },
    system: { label: "System", cls: "bg-emerald-100 text-emerald-800" },
  };
  const entry = map[createdBy];
  if (!entry) return null;
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
        entry.cls
      }
    >
      {entry.label}
    </span>
  );
}
