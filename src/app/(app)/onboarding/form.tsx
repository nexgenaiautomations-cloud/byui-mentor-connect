"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Initial = {
  firstName: string;
  lastName: string;
  major: string;
  minor: string;
  semesterLevel: string;
  expectedGraduation: string;
  phone: string;
  preferredContactMethod: string;
  bio: string;
  image: string;
  careerInterests: string[];
};

function dicebearUrl(name: string) {
  const seed = encodeURIComponent(name || "Member");
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=1B3A6B&textColor=ffffff`;
}

export function OnboardingForm({
  initial,
  careerOptions,
  semesterLevels,
}: {
  initial: Initial;
  careerOptions: string[];
  semesterLevels: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<Initial>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCareer(opt: string) {
    setForm((f) => ({
      ...f,
      careerInterests: f.careerInterests.includes(opt)
        ? f.careerInterests.filter((c) => c !== opt)
        : [...f.careerInterests, opt],
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.formErrors?.[0] || "Could not save profile");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const previewName = `${form.firstName} ${form.lastName}`.trim();
  const previewImage = form.image || dicebearUrl(previewName);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewImage}
          alt="Avatar preview"
          className="h-16 w-16 rounded-full border border-slate-200 bg-slate-100 object-cover"
        />
        <div className="flex-1">
          <label className="label">Profile photo URL (optional)</label>
          <input
            type="url"
            className="input"
            placeholder="https://… (or leave blank for a generated avatar)"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">First name</label>
          <input
            required
            className="input"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Last name</label>
          <input
            required
            className="input"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Major</label>
          <input
            required
            className="input"
            value={form.major}
            onChange={(e) => setForm({ ...form, major: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Minor (optional)</label>
          <input
            className="input"
            value={form.minor}
            onChange={(e) => setForm({ ...form, minor: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Semester level</label>
          <select
            required
            className="input"
            value={form.semesterLevel}
            onChange={(e) => setForm({ ...form, semesterLevel: e.target.value })}
          >
            <option value="">Select…</option>
            {semesterLevels.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Expected graduation</label>
          <input
            required
            className="input"
            placeholder="e.g. Spring 2027"
            value={form.expectedGraduation}
            onChange={(e) => setForm({ ...form, expectedGraduation: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Phone (optional)</label>
          <input
            className="input"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Preferred contact method</label>
          <select
            className="input"
            value={form.preferredContactMethod}
            onChange={(e) => setForm({ ...form, preferredContactMethod: e.target.value })}
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="teams">Microsoft Teams</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Short bio</label>
        <textarea
          rows={3}
          className="input"
          placeholder="A sentence or two about you."
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </div>

      <div>
        <label className="label">
          Career interests <span className="text-slate-500 font-normal">(choose all that apply)</span>
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {careerOptions.map((opt) => {
            const selected = form.careerInterests.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                onClick={() => toggleCareer(opt)}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selected
                    ? "border-navy-600 bg-navy-50 text-navy-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-navy-300"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Saving…" : "Save and continue"}
        </button>
      </div>
    </form>
  );
}
