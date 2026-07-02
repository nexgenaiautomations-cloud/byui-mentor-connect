"use client";

import { useEffect, useState } from "react";

export type MemberRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  major: string | null;
  minor: string | null;
  semesterLevel: string | null;
  expectedGraduation: string | null;
  careerInterests: string[] | null;
  isMentor: boolean;
  isAdmin: boolean;
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

export function MembersTable({ rows }: { rows: MemberRow[] }) {
  const [selected, setSelected] = useState<MemberRow | null>(null);

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
      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setSelected(u)}
            className="card !p-4 w-full text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-byui-blue cursor-pointer"
          >
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u.image || avatarUrl(u.name, u.email)}
                alt=""
                className="h-11 w-11 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-800">{u.name || "—"}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {u.isAdmin && (
                    <span className="pill bg-rose-50 text-rose-700 border-rose-100">Admin</span>
                  )}
                  {u.isMentor && (
                    <span className="pill bg-emerald-50 text-emerald-700 border-emerald-100">
                      Mentor
                    </span>
                  )}
                  {!u.isMentor && !u.isAdmin && <span className="pill">Member</span>}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500">{u.activeMatches} active</span>
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
        ))}
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Member</th>
                <th className="px-3 py-3">Major</th>
                <th className="px-3 py-3">Semester</th>
                <th className="px-3 py-3">Expected grad</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Active</th>
                <th className="px-3 py-3">Trophies</th>
                <th className="px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((u) => (
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
                  className="cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-byui-blue"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u.image || avatarUrl(u.name, u.email)}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-semibold text-navy-800">{u.name || "—"}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{u.major || "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{u.semesterLevel || "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{u.expectedGraduation || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.isAdmin && (
                        <span className="pill bg-rose-50 text-rose-700 border-rose-100">Admin</span>
                      )}
                      {u.isMentor && (
                        <span className="pill bg-emerald-50 text-emerald-700 border-emerald-100">
                          Mentor
                        </span>
                      )}
                      {!u.isMentor && !u.isAdmin && <span className="pill">Member</span>}
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
                  <td className="px-5 py-3 text-xs text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <MemberProfileModal member={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function MemberProfileModal({
  member,
  onClose,
}: {
  member: MemberRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-profile-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-4 ring-byui-blue"
      >
        <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={member.image || avatarUrl(member.name, member.email)}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
              {roleLabel(member)}
            </p>
            <h2
              id="member-profile-title"
              className="font-display text-xl font-black text-byui-blue-dark sm:text-2xl"
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
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 sm:px-6">
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
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">{title}</h3>
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
