"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

export type MenteeCard = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  major: string | null;
  expectedGraduation: string | null;
  careerInterests: string[] | null;
};

export type MentorCard = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  major: string | null;
  topics: string[];
  activeCount: number;
  capacity: number;
  slotsLeft: number;
};

function avatarUrl(name: string | null, email: string) {
  const seed = encodeURIComponent(name || email);
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=1B3A6B&textColor=ffffff`;
}

function GripIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

export function MatchmakerBoard({
  mentees,
  mentors,
  initialAssignments,
}: {
  mentees: MenteeCard[];
  mentors: MentorCard[];
  initialAssignments: Record<string, string>;
}) {
  const router = useRouter();
  const [menteeList, setMenteeList] = useState(mentees);
  // assignments: menteeId -> mentorId. Seeded from the server-computed
  // suggestion so the board opens already-populated.
  const [assignments, setAssignments] =
    useState<Record<string, string>>(initialAssignments);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Server may re-fetch after a match — reapply the latest seeded suggestions
  // for the rows still on the board, while preserving any manual edits the
  // admin made for mentees that survived the refresh.
  useEffect(() => {
    setMenteeList(mentees);
    setAssignments((prev) => {
      const next: Record<string, string> = {};
      for (const m of mentees) {
        if (prev[m.id]) next[m.id] = prev[m.id];
        else if (initialAssignments[m.id]) next[m.id] = initialAssignments[m.id];
      }
      return next;
    });
  }, [mentees, initialAssignments]);

  const mentorById = useMemo(() => {
    const map = new Map<string, MentorCard>();
    for (const m of mentors) map.set(m.id, m);
    return map;
  }, [mentors]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    const activeId = String(e.active.id);
    if (!overId) return;

    let mentorId: string | null = null;
    let fromMenteeId: string | null = null;
    if (activeId.startsWith("pool:")) {
      mentorId = activeId.slice("pool:".length);
    } else if (activeId.startsWith("slot:")) {
      fromMenteeId = activeId.slice("slot:".length);
      mentorId = assignments[fromMenteeId] ?? null;
    }
    if (!mentorId) return;

    if (overId.startsWith("mentee:")) {
      const toMenteeId = overId.slice("mentee:".length);
      if (fromMenteeId === toMenteeId) return;
      setAssignments((prev) => {
        const next = { ...prev };
        if (fromMenteeId) delete next[fromMenteeId];
        next[toMenteeId] = mentorId!;
        return next;
      });
    } else if (overId === "pool" && fromMenteeId) {
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[fromMenteeId!];
        return next;
      });
    }
  }

  function clearSlot(menteeId: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[menteeId];
      return next;
    });
  }

  async function matchOne(menteeId: string) {
    const mentorId = assignments[menteeId];
    if (!mentorId) return;
    setBusy(menteeId);
    setErr(null);
    setFlash(null);
    const res = await fetch("/api/admin/matchmaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mentorId, menteeId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(typeof data?.error === "string" ? data.error : "Failed to match");
      setBusy(null);
      return;
    }
    const data = await res.json();
    if (data.created?.length) {
      const m = menteeList.find((x) => x.id === menteeId);
      setFlash(`Matched ${m?.name ?? "mentee"} ✓`);
      setMenteeList((prev) => prev.filter((x) => x.id !== menteeId));
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[menteeId];
        return next;
      });
      router.refresh();
    } else if (data.skipped?.length) {
      setErr(data.skipped[0]?.reason ?? "Match skipped");
    }
    setBusy(null);
    setTimeout(() => setFlash(null), 2500);
  }

  async function matchAll() {
    const pairs = Object.entries(assignments).map(([menteeId, mentorId]) => ({
      mentorId,
      menteeId,
    }));
    if (pairs.length === 0) {
      setConfirmAllOpen(false);
      return;
    }
    setBusy("all");
    setErr(null);
    setFlash(null);
    const res = await fetch("/api/admin/matchmaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairs }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(typeof data?.error === "string" ? data.error : "Failed to match");
      setBusy(null);
      return;
    }
    const data = await res.json();
    const createdCount = data.created?.length ?? 0;
    const skippedCount = data.skipped?.length ?? 0;
    setFlash(
      `Created ${createdCount} ${createdCount === 1 ? "match" : "matches"}${
        skippedCount > 0 ? ` · ${skippedCount} skipped` : ""
      } ✓`
    );
    const createdMenteeIds = new Set<string>(
      (data.created ?? []).map((c: { menteeId: string }) => c.menteeId)
    );
    setMenteeList((prev) => prev.filter((m) => !createdMenteeIds.has(m.id)));
    setAssignments((prev) => {
      const next = { ...prev };
      for (const id of createdMenteeIds) delete next[id];
      return next;
    });
    setBusy(null);
    setConfirmAllOpen(false);
    router.refresh();
    setTimeout(() => setFlash(null), 3500);
  }

  useEffect(() => {
    if (!confirmAllOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && busy !== "all") setConfirmAllOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [confirmAllOpen, busy]);

  const readyToMatchCount = Object.keys(assignments).length;
  const activeMentor =
    activeDragId?.startsWith("pool:")
      ? mentorById.get(activeDragId.slice("pool:".length))
      : activeDragId?.startsWith("slot:")
      ? mentorById.get(assignments[activeDragId.slice("slot:".length)] ?? "")
      : null;

  if (menteeList.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-byui-blue-light/40">
        <p className="font-display text-lg font-bold text-byui-blue-dark">
          All matched up.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          No unassigned mentees right now. New members will appear here after they
          onboard.
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-bold text-byui-blue-dark">{readyToMatchCount}</span> of{" "}
          {menteeList.length} ready to match
          {readyToMatchCount > 0 ? " — review suggestions and adjust." : "."}
        </p>
        <button
          type="button"
          onClick={() => setConfirmAllOpen(true)}
          disabled={readyToMatchCount === 0 || busy !== null}
          className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-5 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          Match All
        </button>
      </div>

      {flash && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {flash}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <MentorPool mentors={mentors} />

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="grid grid-cols-[1.1fr_1.3fr_120px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 md:grid-cols-[1fr_1.3fr_120px]">
          <p>Unassigned Mentees</p>
          <p>Mentor Matches</p>
          <p className="text-right">Actions</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {menteeList.map((m) => {
            const assignedMentorId = assignments[m.id];
            const assignedMentor = assignedMentorId
              ? mentorById.get(assignedMentorId)
              : undefined;
            const matchTier = matchQuality(m, assignedMentor);
            return (
              <li
                key={m.id}
                className="grid grid-cols-[1.1fr_1.3fr_120px] gap-3 px-4 py-4 md:grid-cols-[1fr_1.3fr_120px]"
              >
                <MenteeRow mentee={m} />
                <MentorSlot
                  menteeId={m.id}
                  mentor={assignedMentor}
                  matchTier={matchTier}
                  onClear={() => clearSlot(m.id)}
                />
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => matchOne(m.id)}
                    disabled={!assignedMentor || busy !== null}
                    className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    {busy === m.id ? "Matching…" : "Match"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeMentor ? (
          <div className="w-72">
            <MentorChip mentor={activeMentor} dragging />
          </div>
        ) : null}
      </DragOverlay>

      {confirmAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden
            onClick={() => busy !== "all" && setConfirmAllOpen(false)}
            className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-all-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-4 ring-byui-blue sm:p-6"
          >
            <h2
              id="match-all-title"
              className="font-display text-xl font-black leading-tight text-byui-blue-dark"
            >
              Confirm Match All
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              This will create matches for all visible mentees with selected mentors.
              Continue?
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {readyToMatchCount}{" "}
              {readyToMatchCount === 1 ? "match" : "matches"} ready · rows without a
              selected mentor will be skipped.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmAllOpen(false)}
                disabled={busy === "all"}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={matchAll}
                disabled={busy === "all" || readyToMatchCount === 0}
                className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-5 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {busy === "all" ? "Matching…" : "Match All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

// Compute a human-readable tier so the UI can hint *why* a suggestion was made.
function matchQuality(
  mentee: MenteeCard,
  mentor: MentorCard | undefined
): null | { tier: "major" | "interest"; label: string } {
  if (!mentor) return null;
  if (mentee.major && mentor.major && mentee.major === mentor.major) {
    return { tier: "major", label: "Same major" };
  }
  const interests = new Set((mentee.careerInterests ?? []).map((s) => s.toLowerCase()));
  const overlap = mentor.topics.find((t) => interests.has(t.toLowerCase()));
  if (overlap) return { tier: "interest", label: `Interest: ${overlap}` };
  return null;
}

function MentorPool({ mentors }: { mentors: MentorCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    // Sticky so the pool stays in view while the admin scrolls through
    // mentee rows. top-0 sits flush under the sticky topbar which is also
    // top-0; both are z-managed so the pool sits above the page content
    // but below the topbar.
    <div
      ref={setNodeRef}
      className={
        "sticky top-16 z-10 rounded-2xl bg-white p-3 shadow-soft ring-1 transition " +
        (isOver
          ? "ring-2 ring-byui-blue"
          : "ring-byui-blue-light/50")
      }
    >
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
          Mentor pool
        </p>
        <p className="text-[11px] text-slate-500">
          {mentors.length} available · drag onto a row
        </p>
      </div>
      {mentors.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          No available mentors right now. Approve mentor applications to add to the
          pool.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {mentors.map((m) => (
            <DraggableMentor key={m.id} mentor={m} dragId={`pool:${m.id}`} compact />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableMentor({
  mentor,
  dragId,
  compact = false,
}: {
  mentor: MentorCard;
  dragId: string;
  compact?: boolean;
}) {
  const disabled = mentor.slotsLeft <= 0;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      className={
        (compact ? "w-60 shrink-0 " : "") +
        (isDragging ? "opacity-30 " : "") +
        "touch-none select-none"
      }
    >
      <MentorChip
        mentor={mentor}
        compact={compact}
        disabled={disabled}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}

function MentorChip({
  mentor,
  dragging = false,
  compact = false,
  disabled = false,
  dragAttributes,
  dragListeners,
}: {
  mentor: MentorCard;
  dragging?: boolean;
  compact?: boolean;
  disabled?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners?: any;
}) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-lg border bg-white px-2 py-2 transition " +
        (dragging
          ? "border-byui-blue shadow-lift ring-2 ring-byui-blue"
          : disabled
          ? "border-slate-200 opacity-50"
          : "border-slate-200 hover:border-byui-blue-light")
      }
    >
      <button
        type="button"
        {...(disabled ? {} : dragAttributes)}
        {...(disabled ? {} : dragListeners)}
        aria-label={disabled ? "Mentor at capacity" : "Drag mentor"}
        disabled={disabled}
        className={
          "grid h-7 w-5 shrink-0 place-items-center rounded text-slate-400 " +
          (disabled
            ? "cursor-not-allowed"
            : "cursor-grab active:cursor-grabbing hover:bg-slate-100 hover:text-slate-600")
        }
      >
        <GripIcon className="h-4 w-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mentor.image || avatarUrl(mentor.name, mentor.email)}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-byui-blue-dark">
          {mentor.name ?? "Mentor"}
        </p>
        <p className="truncate text-[11px] text-slate-500">{mentor.major ?? "—"}</p>
        {!compact && mentor.topics.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {mentor.topics.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-byui-blue-light/30 px-1.5 py-0.5 text-[10px] font-semibold text-byui-blue-dark"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div
        className={
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold " +
          (disabled
            ? "bg-slate-100 text-slate-500"
            : mentor.slotsLeft === 1
            ? "bg-amber-50 text-amber-700"
            : "bg-emerald-50 text-emerald-700")
        }
      >
        {mentor.slotsLeft}/{mentor.capacity}
      </div>
    </div>
  );
}

function MenteeRow({ mentee }: { mentee: MenteeCard }) {
  return (
    <div className="flex items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mentee.image || avatarUrl(mentee.name, mentee.email)}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="truncate font-semibold text-navy-800">
          {mentee.name ?? "Mentee"}
        </p>
        <p className="truncate text-[11px] text-slate-500">{mentee.email}</p>
        <p className="mt-1 truncate text-xs text-slate-600">
          {mentee.major ?? "Major not listed"}
          {mentee.expectedGraduation ? ` · grad ${mentee.expectedGraduation}` : ""}
        </p>
        {mentee.careerInterests && mentee.careerInterests.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {mentee.careerInterests.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MentorSlot({
  menteeId,
  mentor,
  matchTier,
  onClear,
}: {
  menteeId: string;
  mentor: MentorCard | undefined;
  matchTier: ReturnType<typeof matchQuality>;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `mentee:${menteeId}` });
  return (
    <div
      ref={setNodeRef}
      className={
        "min-h-[72px] rounded-xl p-2 transition " +
        (isOver
          ? "bg-byui-blue-light/30 ring-2 ring-byui-blue"
          : mentor
          ? "bg-white ring-1 ring-slate-200"
          : "bg-slate-50 ring-1 ring-dashed ring-slate-300")
      }
    >
      {mentor ? (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <DraggableMentor mentor={mentor} dragId={`slot:${menteeId}`} />
            {matchTier && (
              <p
                className={
                  "mt-1 px-1 text-[10px] font-semibold " +
                  (matchTier.tier === "major"
                    ? "text-byui-blue"
                    : "text-slate-500")
                }
              >
                ↳ {matchTier.label}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove mentor"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
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
        </div>
      ) : (
        <p className="grid h-full place-items-center text-xs font-medium text-slate-400">
          Drop a mentor here
        </p>
      )}
    </div>
  );
}
