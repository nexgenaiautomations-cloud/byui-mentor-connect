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

export function MatchmakerBoard({
  mentees,
  mentors,
}: {
  mentees: MenteeCard[];
  mentors: MentorCard[];
}) {
  const router = useRouter();
  // Local mutable copy so we can remove rows after a successful Match without
  // a full server round-trip — refresh() runs in the background to resync.
  const [menteeList, setMenteeList] = useState(mentees);
  // assignments: menteeId -> mentorId
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // menteeId or "all"
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Keep local list in sync when the server re-fetches (e.g. after refresh()).
  useEffect(() => {
    setMenteeList(mentees);
    setAssignments((prev) => {
      const next: Record<string, string> = {};
      for (const m of mentees) {
        if (prev[m.id]) next[m.id] = prev[m.id];
      }
      return next;
    });
  }, [mentees]);

  const mentorById = useMemo(() => {
    const map = new Map<string, MentorCard>();
    for (const m of mentors) map.set(m.id, m);
    return map;
  }, [mentors]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    // Mentor pool ids are prefixed "pool:" — slot drags carry their mentee id
    // in "slot:<menteeId>". We strip prefixes here so the overlay can find
    // the mentor record.
    setActiveDragId(id);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const overId = e.over?.id ? String(e.over.id) : null;
    const activeId = String(e.active.id);
    if (!overId) return;
    // Source mentor id
    let mentorId: string | null = null;
    let fromMenteeId: string | null = null;
    if (activeId.startsWith("pool:")) {
      mentorId = activeId.slice("pool:".length);
    } else if (activeId.startsWith("slot:")) {
      fromMenteeId = activeId.slice("slot:".length);
      mentorId = assignments[fromMenteeId] ?? null;
    }
    if (!mentorId) return;

    // Drop target: either a mentee slot or back into the pool.
    if (overId.startsWith("mentee:")) {
      const toMenteeId = overId.slice("mentee:".length);
      setAssignments((prev) => {
        const next = { ...prev };
        if (fromMenteeId && fromMenteeId !== toMenteeId) {
          delete next[fromMenteeId]; // moved across rows
        }
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

  // Lock scroll for Match All modal.
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
      <div className="card text-center">
        <p className="font-display text-lg font-bold text-byui-blue-dark">All matched up.</p>
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
          {readyToMatchCount} of {menteeList.length} ready to match.
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

      <div className="rounded-2xl border border-slate-100 bg-white">
        <div className="grid grid-cols-[1.1fr_1.3fr_0.8fr] gap-3 border-b border-slate-100 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 md:grid-cols-[1fr_1.3fr_0.7fr]">
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
            return (
              <li
                key={m.id}
                className="grid grid-cols-[1.1fr_1.3fr_0.8fr] gap-3 px-4 py-4 md:grid-cols-[1fr_1.3fr_0.7fr]"
              >
                <MenteeRow mentee={m} />
                <MentorSlot
                  menteeId={m.id}
                  mentor={assignedMentor}
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

      <DragOverlay>
        {activeMentor ? <MentorCardView mentor={activeMentor} dragging /> : null}
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

function MentorPool({ mentors }: { mentors: MentorCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      className={
        "rounded-2xl border-2 border-dashed p-4 transition " +
        (isOver
          ? "border-byui-blue bg-byui-blue-light/10"
          : "border-slate-200 bg-slate-50")
      }
    >
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Mentor pool
        </p>
        <p className="text-xs text-slate-500">
          Drag a mentor onto a mentee row. {mentors.length} available.
        </p>
      </div>
      {mentors.length === 0 ? (
        <p className="text-sm text-slate-500">
          No available mentors right now. Approve mentor applications to add to the
          pool.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((m) => (
            <DraggableMentor key={m.id} mentor={m} dragId={`pool:${m.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableMentor({
  mentor,
  dragId,
}: {
  mentor: MentorCard;
  dragId: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={
        "cursor-grab touch-none select-none " +
        (isDragging ? "opacity-30" : "")
      }
    >
      <MentorCardView mentor={mentor} />
    </div>
  );
}

function MentorCardView({
  mentor,
  dragging = false,
}: {
  mentor: MentorCard;
  dragging?: boolean;
}) {
  return (
    <div
      className={
        "flex items-start gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-soft transition " +
        (dragging ? "border-byui-blue ring-2 ring-byui-blue" : "border-slate-200")
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mentor.image || avatarUrl(mentor.name, mentor.email)}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-byui-blue-dark">
          {mentor.name ?? "Mentor"}
        </p>
        <p className="truncate text-[11px] text-slate-500">{mentor.major ?? "—"}</p>
        {mentor.topics.length > 0 && (
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
      <div className="text-right">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Slots
        </p>
        <p
          className={
            "font-display text-sm font-bold " +
            (mentor.slotsLeft === 0 ? "text-red-600" : "text-byui-blue-dark")
          }
        >
          {mentor.slotsLeft}/{mentor.capacity}
        </p>
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
  onClear,
}: {
  menteeId: string;
  mentor: MentorCard | undefined;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `mentee:${menteeId}` });
  return (
    <div
      ref={setNodeRef}
      className={
        "min-h-[72px] rounded-xl border-2 border-dashed p-2 transition " +
        (isOver
          ? "border-byui-blue bg-byui-blue-light/15"
          : mentor
          ? "border-byui-blue-light bg-byui-blue-light/10"
          : "border-slate-200 bg-slate-50")
      }
    >
      {mentor ? (
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <DraggableMentor mentor={mentor} dragId={`slot:${menteeId}`} />
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove mentor"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"
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
