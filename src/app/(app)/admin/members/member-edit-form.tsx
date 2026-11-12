"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEMESTER_LEVELS } from "@/lib/careers";
import { GRADUATION_OPTIONS, MAJOR_OPTIONS, MINOR_OPTIONS } from "@/lib/academic-options";

export type EditableMember = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  major: string | null;
  minor: string | null;
  semesterLevel: string | null;
  expectedGraduation: string | null;
  phone: string | null;
  preferredContactMethod: string | null;
  bio: string | null;
};

// Older accounts may only have a combined name; split it as a starting point.
function initialNames(m: EditableMember) {
  if (m.firstName || m.lastName) return { first: m.firstName ?? "", last: m.lastName ?? "" };
  const parts = (m.name ?? "").trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function MemberEditForm({
  member,
  onCancel,
  onSaved,
}: {
  member: EditableMember;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const names = initialNames(member);
  const [form, setForm] = useState({
    firstName: names.first,
    lastName: names.last,
    major: member.major ?? "",
    minor: member.minor ?? "",
    semesterLevel: member.semesterLevel ?? "",
    expectedGraduation: member.expectedGraduation ?? "",
    phone: member.phone ?? "",
    preferredContactMethod: member.preferredContactMethod ?? "",
    bio: member.bio ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(member.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save changes. Try again.");
        return;
      }
      router.refresh();
      onSaved();
    } catch {
      setError("Couldn't reach ICAN. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const id = (k: string) => `edit-${k}`;
  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-describedby={error ? "edit-error" : undefined}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={id("first")}>First name</label>
          <input id={id("first")} className="input" required maxLength={60} value={form.firstName} onChange={set("firstName")} />
        </div>
        <div>
          <label className="label" htmlFor={id("last")}>Last name</label>
          <input id={id("last")} className="input" required maxLength={60} value={form.lastName} onChange={set("lastName")} />
        </div>
        <div>
          <label className="label" htmlFor={id("major")}>Major</label>
          <input id={id("major")} className="input" list="edit-major-options" maxLength={120} value={form.major} onChange={set("major")} />
          <datalist id="edit-major-options">{MAJOR_OPTIONS.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor={id("minor")}>Minor</label>
          <input id={id("minor")} className="input" list="edit-minor-options" maxLength={120} value={form.minor} onChange={set("minor")} />
          <datalist id="edit-minor-options">{MINOR_OPTIONS.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor={id("semester")}>Semester level</label>
          <select id={id("semester")} className="input cursor-pointer" value={form.semesterLevel} onChange={set("semesterLevel")}>
            <option value="">Not set</option>
            {SEMESTER_LEVELS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id("grad")}>Expected graduation</label>
          <input id={id("grad")} className="input" list="edit-grad-options" maxLength={40} value={form.expectedGraduation} onChange={set("expectedGraduation")} />
          <datalist id="edit-grad-options">{GRADUATION_OPTIONS.map((o) => <option key={o} value={o} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor={id("phone")}>Phone</label>
          <input id={id("phone")} className="input" type="tel" maxLength={40} value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="label" htmlFor={id("contact")}>Preferred contact</label>
          <select id={id("contact")} className="input cursor-pointer" value={form.preferredContactMethod} onChange={set("preferredContactMethod")}>
            <option value="">Not set</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="teams">Teams</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={id("bio")}>Bio</label>
          <textarea id={id("bio")} className="input min-h-[96px]" maxLength={2000} value={form.bio} onChange={set("bio")} />
        </div>
      </div>
      <p className="text-xs text-slate-500">Email can&apos;t be changed here because it&apos;s the member&apos;s login. Changes are recorded in the audit log.</p>
      {error && (
        <p id="edit-error" role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
