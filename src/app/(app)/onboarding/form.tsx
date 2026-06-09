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

const STEPS = ["Basics", "Profile", "Career"] as const;

export function OnboardingForm({
  initial,
  careerOptions,
  semesterLevels,
  majorOptions,
  minorOptions,
  graduationOptions,
}: {
  initial: Initial;
  careerOptions: string[];
  semesterLevels: string[];
  majorOptions: string[];
  minorOptions: string[];
  graduationOptions: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
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

  function canAdvance() {
    if (step === 0) {
      return (
        form.firstName.trim() &&
        form.lastName.trim() &&
        form.major.trim() &&
        form.semesterLevel &&
        form.expectedGraduation.trim()
      );
    }
    if (step === 1) return !!form.preferredContactMethod;
    return form.careerInterests.length > 0;
  }

  async function onSubmit() {
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

  // If the user arrived from /signup, their name is already saved. Hide the
  // name fields so we don't re-ask — they can still tweak it in /settings.
  const nameAlreadySet = Boolean(
    initial.firstName.trim() && initial.lastName.trim()
  );

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <div
                className={
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black " +
                  (done
                    ? "bg-emerald-600 text-white"
                    : active
                    ? "bg-navy-700 text-white"
                    : "bg-slate-200 text-slate-500")
                }
              >
                {done ? "✓" : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    "text-xs font-bold uppercase tracking-wider " +
                    (active ? "text-navy-800" : done ? "text-emerald-700" : "text-slate-400")
                  }
                >
                  {label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`hidden h-px flex-1 sm:block ${done ? "bg-emerald-300" : "bg-slate-200"}`} />
              )}
            </li>
          );
        })}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS.length - 1) setStep(step + 1);
          else onSubmit();
        }}
        className="space-y-6"
      >
        {step === 0 && (
          <div className="space-y-5">
            {nameAlreadySet ? (
              <p className="rounded-lg bg-byui-blue-light/20 px-3 py-2 text-sm text-byui-blue-dark">
                Hi, <strong>{form.firstName}</strong> — let&apos;s finish your
                profile so we can match you with the right mentors.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First name</label>
                  <input
                    required
                    className="input"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">Last name</label>
                  <input
                    required
                    className="input"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Major</label>
                <select
                  required
                  className="input"
                  value={form.major}
                  onChange={(e) => setForm({ ...form, major: e.target.value })}
                >
                  <option value="">Select your major</option>
                  {majorOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Minor</label>
                <select
                  className="input"
                  value={form.minor}
                  onChange={(e) => setForm({ ...form, minor: e.target.value })}
                >
                  <option value="">Select your minor</option>
                  {minorOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
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
                <label className="label">Expected Graduation Date</label>
                <select
                  required
                  className="input"
                  value={form.expectedGraduation}
                  onChange={(e) => setForm({ ...form, expectedGraduation: e.target.value })}
                >
                  <option value="">Select expected graduation date</option>
                  {graduationOptions.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
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
                <label className="label">Phone (optional)</label>
                <input
                  type="tel"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Preferred contact method</label>
                <select
                  required
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
                placeholder="A sentence or two about you — specific is better than safe."
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <label className="label">
              Career interests <span className="font-normal text-slate-500">(choose all that apply)</span>
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
            <p className="mt-2 text-xs text-slate-500">
              {form.careerInterests.length} selected
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-ghost disabled:opacity-30"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Step {step + 1} of {STEPS.length}</p>
            <button
              type="submit"
              disabled={!canAdvance() || submitting}
              className="btn-primary"
            >
              {step === STEPS.length - 1
                ? submitting
                  ? "Saving…"
                  : "Save and continue →"
                : "Next →"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
