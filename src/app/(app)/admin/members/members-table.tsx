"use client";

import { useEffect, useMemo, useState } from "react";
import { ManageUserButton } from "@/components/manage-user-button";
import { currentRole } from "@/lib/user-admin";
import {
  DEFAULT_DIR,
  MEMBER_SORT_KEYS,
  MEMBER_SORT_LABEL,
  sortMembers,
  type MemberSortKey,
  type SortDir,
} from "@/lib/member-sort";
import { MemberEditForm } from "./member-edit-form";

export type MemberRow = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  preferredContactMethod: string | null;
  bio: string | null;
  email: string;
  image: string | null;
  major: string | null;
  minor: string | null;
  semesterLevel: string | null;
  expectedGraduation: string | null;
  careerInterests: string[] | null;
  isMentor: boolean;
  isExecutiveMentor: boolean;
  isAdmin: boolean;
  isHeadAdmin: boolean;
  removedAt: string | null;
  mentorAvailable: boolean;
  mentorCapacity: number | null;
  priorCareerChats: string | null;
  priorInternshipExperience: string | null;
  onboardedAt: string | null;
  createdAt: string;
  activeMatches: number;
  recentActivityCount: number;
  achievementsEarned: number;
  application: {
    status: "pending" | "approved" | "rejected";
    submittedAt: string;
    reviewedAt: string | null;
    motivation: string | null;
    informationalInterviews: string | null;
    internshipsCount: string | null;
    capacity: number;
  } | null;
};

function avatarUrl(name: string | null, email: string) {
  const seed = encodeURIComponent(name || email);
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=1B3A6B&textColor=ffffff`;
}

export type Viewer = { id: string; isHeadAdmin: boolean };

// Mirrors checkProfileEdit in src/lib/member-profile-edit.ts (the server enforces it).
function editBlockedReason(u: MemberRow, viewer: Viewer): string | null {
  if (u.id === viewer.id) return "Edit your own profile in Settings.";
  if (u.isAdmin && !viewer.isHeadAdmin) return "Only the head admin can edit another admin's profile.";
  return null;
}

function SortHeader({
  k,
  sort,
  onSort,
  className,
}: {
  k: MemberSortKey;
  sort: { key: MemberSortKey; dir: SortDir };
  onSort: (k: MemberSortKey) => void;
  className: string;
}) {
  const active = sort.key === k;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 rounded uppercase tracking-wider transition hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer ${active ? "text-brand" : ""}`}
      >
        {MEMBER_SORT_LABEL[k]}
        <svg viewBox="0 0 12 12" className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} aria-hidden="true" fill="currentColor">
          {active && sort.dir === "asc" ? (
            <path d="M6 3 10 8H2z" />
          ) : active ? (
            <path d="M6 9 2 4h8z" />
          ) : (
            <path d="M6 1.5 9 5H3zM6 10.5 3 7h6z" />
          )}
        </svg>
      </button>
    </th>
  );
}

function manageButton(u: MemberRow, viewer: Viewer) {
  const disabledReason =
    u.id === viewer.id
      ? "You can't manage your own account here"
      : u.isAdmin && !viewer.isHeadAdmin
        ? "Only the head admin can manage another admin"
        : undefined;
  return (
    <ManageUserButton
      disabledReason={disabledReason}
      target={{
        id: u.id,
        name: u.name,
        email: u.email,
        role: currentRole(u),
        isAdmin: u.isAdmin,
        removed: !!u.removedAt,
        activeMentees: u.activeMatches,
      }}
    />
  );
}

function RoleBadges({ u }: { u: MemberRow }) {
  if (u.removedAt) {
    return <span className="pill bg-slate-100 text-slate-700 border-slate-200">Removed</span>;
  }
  return (
    <>
      {u.isAdmin && <span className="pill bg-rose-50 text-rose-700 border-rose-100">Admin</span>}
      {u.isExecutiveMentor ? (
        <span className="pill bg-indigo-50 text-indigo-800 border-indigo-100">Executive mentor</span>
      ) : (
        u.isMentor && <span className="pill bg-emerald-50 text-emerald-700 border-emerald-100">Mentor</span>
      )}
      {!u.isMentor && !u.isAdmin && <span className="pill">Member</span>}
    </>
  );
}

function roleLabel(u: MemberRow) {
  if (u.isAdmin) return "Admin";
  if (u.isMentor) return "Mentor";
  return "Member";
}

function memberStatus(u: MemberRow) {
  if (!u.onboardedAt) return "Invited (not onboarded)";
  if (u.isMentor) return u.mentorAvailable ? "Active mentor" : "Mentor (unavailable)";
  return "Active member";
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "Not listed";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not listed";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function display(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "Not listed";
  if (typeof value === "string" && value.trim() === "") return "Not listed";
  return String(value);
}

function displayList(values: string[] | null | undefined) {
  if (!values || values.length === 0) return "Not listed";
  return values.join(", ");
}

export function MembersTable({ rows, viewer }: { rows: MemberRow[]; viewer: Viewer }) {
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [sort, setSort] = useState<{ key: MemberSortKey; dir: SortDir }>({ key: "createdAt", dir: "desc" });
  const sorted = useMemo(() => sortMembers(rows, sort.key, sort.dir), [rows, sort]);
  function onSort(key: MemberSortKey) {
    setSort((cur) =>
      cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: DEFAULT_DIR[key] }
    );
  }

  // Lock body scroll + Escape closes the modal.
  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  return (
    <>
      {/* Mobile sort control */}
      <div className="mb-3 flex items-center gap-2 md:hidden">
        <label htmlFor="member-sort" className="text-xs font-semibold text-slate-600">Sort by</label>
        <select
          id="member-sort"
          className="input min-w-0 flex-1 cursor-pointer !py-2 text-sm"
          value={`${sort.key}:${sort.dir}`}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":") as [MemberSortKey, SortDir];
            setSort({ key, dir });
          }}
        >
          {MEMBER_SORT_KEYS.flatMap((k) => [
            <option key={`${k}:asc`} value={`${k}:asc`}>{MEMBER_SORT_LABEL[k]}, ascending</option>,
            <option key={`${k}:desc`} value={`${k}:desc`}>{MEMBER_SORT_LABEL[k]}, descending</option>,
          ])}
        </select>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {sorted.map((u) => (
          <div key={u.id} className={`card relative !p-0 ${u.removedAt ? "opacity-70" : ""}`}>
          <div className="absolute right-3 top-3 z-10">{manageButton(u, viewer)}</div>
          <button
            type="button"
            onClick={() => setSelected(u)}
            className="w-full rounded-[inherit] !p-4 pr-16 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.image || avatarUrl(u.name, u.email)}
                alt=""
                loading="lazy"
                className="h-11 w-11 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-plum-800">{u.name || "—"}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <RoleBadges u={u} />
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{u.activeMatches} active</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Major</p>
                <p className="text-slate-700">{u.major || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Semester · Grad
                </p>
                <p className="text-slate-700">
                  {u.semesterLevel || "—"}
                  {u.expectedGraduation ? ` · ${u.expectedGraduation}` : ""}
                </p>
              </div>
            </div>
          </button>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <SortHeader k="name" sort={sort} onSort={onSort} className="px-5 py-3" />
                <SortHeader k="major" sort={sort} onSort={onSort} className="px-3 py-3" />
                <SortHeader k="semesterLevel" sort={sort} onSort={onSort} className="px-3 py-3" />
                <SortHeader k="expectedGraduation" sort={sort} onSort={onSort} className="px-3 py-3" />
                <SortHeader k="role" sort={sort} onSort={onSort} className="px-3 py-3" />
                <SortHeader k="activeMatches" sort={sort} onSort={onSort} className="px-3 py-3" />
                <SortHeader k="achievementsEarned" sort={sort} onSort={onSort} className="px-3 py-3" />
                <SortHeader k="createdAt" sort={sort} onSort={onSort} className="px-3 py-3" />
                <th className="px-5 py-3"><span className="sr-only">Manage</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sorted.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(u);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open profile for ${u.name || u.email}`}
                  className={`${u.removedAt ? "opacity-60 " : ""}cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u.image || avatarUrl(u.name, u.email)}
                        alt=""
                        loading="lazy"
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-semibold text-plum-800">{u.name || "—"}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{u.major || "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{u.semesterLevel || "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{u.expectedGraduation || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <RoleBadges u={u} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{u.activeMatches}</td>
                  <td className="px-3 py-3 text-slate-700">
                    {u.achievementsEarned > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                        🏆 {u.achievementsEarned}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-2 text-right">{manageButton(u, viewer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <MemberProfileModal
          member={selected}
          editBlocked={editBlockedReason(selected, viewer)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function MemberProfileModal({
  member,
  editBlocked,
  onClose,
}: {
  member: MemberRow;
  editBlocked: string | null;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-brand-dark/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-profile-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-4 ring-brand"
      >
        <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={member.image || avatarUrl(member.name, member.email)}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
              {roleLabel(member)}
            </p>
            <h2
              id="member-profile-title"
              className="font-display text-xl font-black text-brand-dark sm:text-2xl"
            >
              {member.name || display(member.name)}
            </h2>
            <p className="truncate text-sm text-slate-600">{member.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 cursor-pointer"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {editing ? (
            <MemberEditForm member={member} onCancel={() => setEditing(false)} onSaved={onClose} />
          ) : (
          <>
          <Section title="Contact">
            <Field label="Phone" value={display(member.phone)} />
            <Field label="Preferred contact" value={display(member.preferredContactMethod)} />
            {member.bio && <Field label="Bio" value={member.bio} full />}
          </Section>

          <Section title="Academic">
            <Field label="Major" value={display(member.major)} />
            <Field label="Minor" value={display(member.minor)} />
            <Field label="Semester level" value={display(member.semesterLevel)} />
            <Field label="Expected graduation" value={display(member.expectedGraduation)} />
          </Section>

          <Section title="Career interests">
            <Field label="Interests" value={displayList(member.careerInterests)} full />
          </Section>

          <Section title="Status">
            <Field label="Role" value={roleLabel(member)} />
            <Field label="Member status" value={memberStatus(member)} />
            <Field label="Joined" value={fmtDate(member.createdAt)} />
            <Field label="Onboarded" value={fmtDate(member.onboardedAt)} />
            <Field label="Active matches" value={String(member.activeMatches)} />
            <Field
              label="Recent activity (90d)"
              value={String(member.recentActivityCount)}
            />
            <Field
              label="Trophies earned"
              value={String(member.achievementsEarned)}
            />
          </Section>

          {(member.priorCareerChats || member.priorInternshipExperience) && (
            <Section title="Signup experience answers">
              <Field
                label="Prior career chats"
                value={display(member.priorCareerChats)}
              />
              <Field
                label="Prior internships / career-related work"
                value={display(member.priorInternshipExperience)}
              />
            </Section>
          )}

          {member.isMentor && (
            <Section title="Mentor">
              <Field label="Capacity" value={display(member.mentorCapacity)} />
              <Field
                label="Availability"
                value={member.mentorAvailable ? "Accepting requests" : "Paused"}
              />
            </Section>
          )}

          {member.application && (
            <Section title="Mentor application">
              <Field
                label="Status"
                value={
                  member.application.status === "rejected"
                    ? "Update sent"
                    : member.application.status.charAt(0).toUpperCase() +
                      member.application.status.slice(1)
                }
              />
              <Field label="Submitted" value={fmtDate(member.application.submittedAt)} />
              <Field label="Reviewed" value={fmtDate(member.application.reviewedAt)} />
              <Field
                label="Requested capacity"
                value={display(member.application.capacity)}
              />
              <Field
                label="Informational interviews"
                value={display(member.application.informationalInterviews)}
              />
              <Field
                label="Internships / career work"
                value={display(member.application.internshipsCount)}
              />
              <Field
                label="Motivation"
                value={display(member.application.motivation)}
                full
              />
            </Section>
          )}
          </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 sm:px-6">
          {!editing && editBlocked && (
            <p className="mr-auto text-xs text-slate-500">{editBlocked}</p>
          )}
          {!editing && !editBlocked && (
            <button type="button" onClick={() => setEditing(true)} className="btn-primary cursor-pointer">
              Edit profile
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand">{title}</h3>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  const isFallback = value === "Not listed";
  return (
    <div
      className={
        "rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 " +
        (full ? "sm:col-span-2" : "")
      }
    >
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd
        className={
          "mt-0.5 whitespace-pre-wrap break-words text-sm " +
          (isFallback ? "text-slate-500 italic" : "text-slate-800")
        }
      >
        {value}
      </dd>
    </div>
  );
}
