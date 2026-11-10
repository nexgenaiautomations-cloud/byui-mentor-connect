"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { diffAssignments, suggestBalance, type Assignments } from "@/lib/stewardship";

type Person = { id: string; name: string | null; email: string; image: string | null; major: string | null };

const UNASSIGNED = "unassigned";

export function StewardshipBoard({
  executives,
  mentors,
  initial,
}: {
  executives: Person[];
  mentors: Person[];
  initial: Assignments;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Assignments>(initial);
  const [saved, setSaved] = useState<Assignments>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const changes = useMemo(() => diffAssignments(saved, draft), [saved, draft]);
  const changedIds = new Set(changes.map((c) => c.mentorId));
  const execName = new Map(executives.map((e) => [e.id, e.name || e.email]));

  function move(mentorId: string, columnId: string) {
    setMessage(null);
    setDraft((d) => ({ ...d, [mentorId]: columnId === UNASSIGNED ? null : columnId }));
  }

  function onDragEnd(e: DragEndEvent) {
    if (e.over) move(String(e.active.id), String(e.over.id));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/stewardship", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save.");
      setSaved(draft);
      setMessage({ tone: "ok", text: `Saved ${data.changed} change${data.changed === 1 ? "" : "s"}.` });
      router.refresh();
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    ...executives.map((e) => ({ id: e.id, title: e.name || e.email, subtitle: "Executive mentor" })),
    { id: UNASSIGNED, title: "Unassigned", subtitle: "No executive mentor" },
  ];
  const membersOf = (colId: string) =>
    mentors.filter((m) => (draft[m.id] ?? UNASSIGNED) === colId);

  const btn =
    "min-h-10 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setDraft(suggestBalance(executives.map((e) => e.id), mentors.map((m) => m.id), draft));
          }}
          disabled={busy}
          className={`${btn} border border-brand/40 bg-white text-brand-dark hover:bg-brand-light/20`}
        >
          Suggest balance
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(saved);
            setMessage(null);
          }}
          disabled={busy || changes.length === 0}
          className={`${btn} text-slate-700 hover:bg-slate-100`}
        >
          Discard changes
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || changes.length === 0}
          className={`${btn} bg-brand text-white hover:bg-brand-dark`}
        >
          {busy ? "Saving…" : "Approve & save"}
        </button>
        <p role="status" className="text-sm text-slate-700">
          {changes.length > 0
            ? `${changes.length} unsaved change${changes.length === 1 ? "" : "s"}`
            : "No unsaved changes"}
        </p>
        {message && (
          <p role="alert" className={`w-full text-sm font-medium ${message.tone === "ok" ? "text-emerald-800" : "text-rose-700"}`}>
            {message.text}
          </p>
        )}
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-3" aria-label="Stewardship columns">
          {columns.map((col) => (
            <Column key={col.id} id={col.id} title={col.title} subtitle={col.subtitle} count={membersOf(col.id).length}>
              {membersOf(col.id).map((m) => (
                <MentorCard
                  key={m.id}
                  mentor={m}
                  changed={changedIds.has(m.id)}
                  previous={changedIds.has(m.id) ? (saved[m.id] ? execName.get(saved[m.id]!) ?? "another executive" : "Unassigned") : null}
                  columns={columns}
                  currentColumn={col.id}
                  onMove={(to) => move(m.id, to)}
                />
              ))}
            </Column>
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({
  id,
  title,
  subtitle,
  count,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${title}, ${count} mentor${count === 1 ? "" : "s"}`}
      className={`flex max-h-[70vh] w-72 shrink-0 flex-col rounded-2xl border bg-white shadow-soft transition-colors ${
        isOver ? "border-brand ring-2 ring-brand/40" : "border-slate-200"
      } ${id === UNASSIGNED ? "bg-slate-50" : ""}`}
    >
      <header className="border-b border-slate-100 px-4 py-3">
        <p className="truncate font-display font-bold text-plum-800">{title}</p>
        <p className="text-xs text-slate-600">
          {subtitle} · {count} mentor{count === 1 ? "" : "s"}
        </p>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {count === 0 && <p className="py-6 text-center text-xs text-slate-500">Drop mentors here</p>}
        {children}
      </div>
    </section>
  );
}

function MentorCard({
  mentor,
  changed,
  previous,
  columns,
  currentColumn,
  onMove,
}: {
  mentor: Person;
  changed: boolean;
  previous: string | null;
  columns: { id: string; title: string }[];
  currentColumn: string;
  onMove: (to: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: mentor.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white p-3 text-sm shadow-sm ${
        changed ? "border-amber-400 ring-1 ring-amber-300" : "border-slate-200"
      } ${isDragging ? "z-10 opacity-80 shadow-lift" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Drag ${mentor.name || mentor.email}`}
          className="mt-0.5 cursor-grab touch-none rounded p-1 text-slate-500 hover:bg-slate-100 active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{mentor.name || mentor.email}</p>
          <p className="truncate text-xs text-slate-600">{mentor.major || "Major not listed"}</p>
          {changed && previous && <p className="mt-0.5 text-[11px] font-semibold text-amber-800">Moved from {previous}</p>}
        </div>
      </div>
      <label className="mt-2 block">
        <span className="sr-only">Move {mentor.name || mentor.email} to</span>
        <select
          value={currentColumn}
          onChange={(e) => onMove(e.target.value)}
          className="w-full cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id === currentColumn ? `In: ${c.title}` : `Move to ${c.title}`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
