"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
  priorCareerChats?: string;
  priorInternshipExperience?: string;
};

const PRIOR_INTERNSHIPS = ["None", "1", "2", "3 or more"] as const;

// "Other" handling: the dropdown shows only the canonical options. When the
// student's saved value isn't in that list, they originally picked "Other"
// and typed a custom value — we hydrate by selecting "Other" in the dropdown
// and pre-filling the free-text input with their value.
function splitOption(value: string, options: readonly string[]): {
  selected: string;
  other: string;
} {
  if (!value) return { selected: "", other: "" };
  if (options.includes(value)) return { selected: value, other: "" };
  return { selected: "Other", other: value };
}

function dicebearUrl(name: string) {
  const seed = encodeURIComponent(name || "Member");
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=1B3A6B&textColor=ffffff`;
}

// Resize an uploaded image to a square `size` × `size` thumbnail and return
// it as a data URL. The image is cover-cropped: the shorter dimension
// fills the square and the longer one is trimmed centered, like Instagram.
//
// We try WebP first (typically 25–40% smaller than JPEG at the same visual
// quality) and fall back to JPEG when the browser doesn't actually emit
// `image/webp` data. The chosen encoding is whichever produces the
// smaller payload — Chrome/Firefox/Edge all win with WebP at this size;
// older Safari without WebP encode support falls through to JPEG without
// failing the upload.
async function resizeToDataUrl(file: File, size: number): Promise<string> {
  const reader = new FileReader();
  const blobUrl: string = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("decode failed"));
    img.src = blobUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  // Sharper down-scale for portrait crops on high-DPR displays.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const ratio = Math.max(size / img.width, size / img.height);
  const drawWidth = img.width * ratio;
  const drawHeight = img.height * ratio;
  ctx.drawImage(
    img,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight
  );

  // WebP at 0.82 ≈ JPEG at 0.85 visually but ~30% fewer bytes. Some Safari
  // builds advertise WebP support but the encoder silently returns the
  // PNG/JPEG fallback header — that's why we sanity-check the prefix.
  const webp = canvas.toDataURL("image/webp", 0.82);
  const jpeg = canvas.toDataURL("image/jpeg", 0.85);
  const webpOk = webp.startsWith("data:image/webp");
  if (webpOk && webp.length < jpeg.length) return webp;
  return jpeg;
}

const BASE_STEPS = ["Basics", "Profile", "Career"] as const;

export function OnboardingForm({
  initial,
  careerOptions,
  semesterLevels,
  majorOptions,
  minorOptions,
  graduationOptions,
  showCareerChats = false,
  showExperienceStep = false,
}: {
  initial: Initial;
  careerOptions: string[];
  semesterLevels: string[];
  majorOptions: string[];
  minorOptions: string[];
  graduationOptions: string[];
  // Settings mode — render the experience answers inline at the bottom of
  // the Career step so they're editable without adding another wizard
  // page for a user who's already onboarded.
  showCareerChats?: boolean;
  // Onboarding mode — append an Experience step at the end so new users
  // answer the two career-experience questions before reaching the
  // dashboard.
  showExperienceStep?: boolean;
}) {
  const STEPS = showExperienceStep
    ? ([...BASE_STEPS, "Experience"] as const)
    : BASE_STEPS;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Initial>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown "Other" state for major/minor — we drive the <select> with a
  // separate variable so the user can pick "Other" without losing the typed
  // custom value on the next render.
  const initialMajor = useMemo(
    () => splitOption(initial.major, majorOptions),
    [initial.major, majorOptions]
  );
  const initialMinor = useMemo(
    () => splitOption(initial.minor, minorOptions),
    [initial.minor, minorOptions]
  );
  const [majorChoice, setMajorChoice] = useState(initialMajor.selected);
  const [majorOther, setMajorOther] = useState(initialMajor.other);
  const [minorChoice, setMinorChoice] = useState(initialMinor.selected);
  const [minorOther, setMinorOther] = useState(initialMinor.other);

  // Career interests "Other" — anything saved that isn't in the canonical
  // list shows up as the pre-filled custom value with "Other" toggled on.
  const initialOtherCareer = useMemo(() => {
    const extras = initial.careerInterests.filter(
      (c) => c !== "Other" && !careerOptions.includes(c)
    );
    return extras.join(", ");
  }, [initial.careerInterests, careerOptions]);
  const initialOtherChecked = useMemo(
    () =>
      initial.careerInterests.includes("Other") || initialOtherCareer !== "",
    [initial.careerInterests, initialOtherCareer]
  );
  const [otherCareerChecked, setOtherCareerChecked] = useState(
    initialOtherChecked
  );
  const [otherCareerText, setOtherCareerText] = useState(initialOtherCareer);

  function toggleCareer(opt: string) {
    if (opt === "Other") {
      setOtherCareerChecked((v) => !v);
      return;
    }
    setForm((f) => ({
      ...f,
      careerInterests: f.careerInterests.includes(opt)
        ? f.careerInterests.filter((c) => c !== opt)
        : [...f.careerInterests, opt],
    }));
  }

  // Every field is now optional — Next is always available. Skip jumps to
  // submit with whatever's filled in (even nothing).
  function canAdvance() {
    return true;
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      // Resolve "Other" inputs into the final saved values.
      const resolvedMajor =
        majorChoice === "Other"
          ? majorOther.trim() || "Other"
          : majorChoice;
      const resolvedMinor =
        minorChoice === "Other"
          ? minorOther.trim() || "Other"
          : minorChoice;
      // Career interests: keep the canonical picks the user toggled, then
      // append the typed "Other" value (split on commas so they can list a
      // few). Fall back to the literal "Other" when checked with no text.
      const canonicalInterests = form.careerInterests.filter(
        (c) => c !== "Other" && careerOptions.includes(c)
      );
      const customInterests = otherCareerChecked
        ? otherCareerText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const resolvedInterests =
        otherCareerChecked && customInterests.length === 0
          ? [...canonicalInterests, "Other"]
          : [...canonicalInterests, ...customInterests];

      const payload: Record<string, unknown> = {
        ...form,
        major: resolvedMajor,
        minor: resolvedMinor,
        careerInterests: resolvedInterests,
      };
      // Drop the experience fields when neither mode is exposing an editor
      // for them — that keeps a non-experience save from blanking the
      // values the user entered earlier.
      if (!showCareerChats && !showExperienceStep) {
        delete payload.priorCareerChats;
        delete payload.priorInternshipExperience;
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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

  // Read a file via FileReader → draw into a 256x256 canvas → toDataURL as
  // JPEG at 0.85 quality. Keeps the uploaded image well under the 600KB
  // server-side cap and avoids needing Vercel Blob storage.
  async function handleFile(file: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setError("Please pick a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Photo must be under 8 MB before resizing.");
      return;
    }
    setError(null);
    try {
      const dataUrl = await resizeToDataUrl(file, 256);
      setForm((f) => ({ ...f, image: dataUrl }));
    } catch {
      setError("Could not read that image. Try a different file.");
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
                    (active ? "text-navy-800" : done ? "text-emerald-700" : "text-slate-500")
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
                <label className="label" htmlFor="profile-major">Major <span className="font-normal text-slate-500">(optional)</span></label>
                <select
                  id="profile-major"
                  className="input"
                  value={majorChoice}
                  onChange={(e) => setMajorChoice(e.target.value)}
                >
                  <option value="">Select your major</option>
                  {majorOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {majorChoice === "Other" && (
                  <input
                    type="text"
                    className="input mt-2"
                    placeholder="Type your major"
                    maxLength={120}
                    value={majorOther}
                    onChange={(e) => setMajorOther(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="label" htmlFor="profile-minor">Minor <span className="font-normal text-slate-500">(optional)</span></label>
                <select
                  id="profile-minor"
                  className="input"
                  value={minorChoice}
                  onChange={(e) => setMinorChoice(e.target.value)}
                >
                  <option value="">Select your minor</option>
                  {minorOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {minorChoice === "Other" && (
                  <input
                    type="text"
                    className="input mt-2"
                    placeholder="Type your minor"
                    maxLength={120}
                    value={minorOther}
                    onChange={(e) => setMinorOther(e.target.value)}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="profile-semester">Semester level <span className="font-normal text-slate-500">(optional)</span></label>
                <select
                  id="profile-semester"
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
                <label className="label" htmlFor="profile-graduation">Expected Graduation Date <span className="font-normal text-slate-500">(optional)</span></label>
                <select
                  id="profile-graduation"
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
                <label htmlFor="onb-photo" className="label">
                  Profile photo <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="onb-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-byui-blue file:px-3 file:py-2 file:text-xs file:font-bold file:text-white file:cursor-pointer hover:file:bg-byui-blue-dark"
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                />
                {form.image ? (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, image: "" })}
                    className="mt-1 text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Remove photo
                  </button>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    PNG, JPG, or WEBP. We crop to a square and shrink to 256px.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Phone <span className="font-normal text-slate-500">(optional)</span></label>
                <input
                  type="tel"
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Preferred contact method <span className="font-normal text-slate-500">(optional)</span></label>
                <select
                  className="input"
                  value={form.preferredContactMethod}
                  onChange={(e) => setForm({ ...form, preferredContactMethod: e.target.value })}
                >
                  <option value="">Select…</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="teams">Microsoft Teams</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Short bio <span className="font-normal text-slate-500">(optional)</span></label>
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
              Career interests{" "}
              <span className="font-normal text-slate-500">
                (optional — choose all that apply)
              </span>
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {careerOptions.map((opt) => {
                const selected =
                  opt === "Other"
                    ? otherCareerChecked
                    : form.careerInterests.includes(opt);
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
            {otherCareerChecked && (
              <input
                type="text"
                className="input mt-3"
                placeholder="Type your career interest"
                maxLength={200}
                value={otherCareerText}
                onChange={(e) => setOtherCareerText(e.target.value)}
              />
            )}
            {showCareerChats && (
              <div className="mt-5 space-y-3 rounded-xl border border-byui-blue-light/40 bg-slate-50 p-3">
                <div>
                  <label htmlFor="settings-prior-chats" className="label">
                    How many informational interviews or career chats have you done?
                  </label>
                  <input
                    id="settings-prior-chats"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    className="input max-w-[160px]"
                    value={form.priorCareerChats ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setForm({ ...form, priorCareerChats: "" });
                        return;
                      }
                      if (!/^\d+$/.test(raw)) return;
                      setForm({ ...form, priorCareerChats: raw });
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Whole number, 0 or greater. Trophy Case totals update as
                    soon as you save.
                  </p>
                </div>
                <div>
                  <label htmlFor="settings-prior-intern" className="label">
                    How many internships or career-related work experiences
                    have you had?
                  </label>
                  <select
                    id="settings-prior-intern"
                    className="input max-w-[200px]"
                    value={form.priorInternshipExperience ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priorInternshipExperience: e.target.value,
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {PRIOR_INTERNSHIPS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {form.careerInterests.length +
                (otherCareerChecked && otherCareerText.trim() ? 1 : 0)}{" "}
              selected
            </p>
          </div>
        )}

        {step === 3 && showExperienceStep && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-byui-blue-dark">
                A bit about your experience
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Two quick numbers so admins can track program impact over
                time. You can update these later from settings.
              </p>
            </div>
            <div>
              <label htmlFor="onb-prior-chats" className="label">
                How many informational interviews or career chats have you
                done?
              </label>
              <input
                id="onb-prior-chats"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="Example: 5"
                className="input max-w-[200px]"
                value={form.priorCareerChats ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setForm({ ...form, priorCareerChats: "" });
                    return;
                  }
                  if (!/^\d+$/.test(raw)) return;
                  setForm({ ...form, priorCareerChats: raw });
                }}
              />
              <p className="mt-1 text-xs text-slate-500">
                Whole number, 0 or greater. Trophy Case totals start from
                here, plus anything you log in BYUI CAN.
              </p>
            </div>
            <div>
              <label htmlFor="onb-prior-intern" className="label">
                How many internships or career-related work experiences have
                you had?
              </label>
              <select
                id="onb-prior-intern"
                className="input max-w-[200px]"
                value={form.priorInternshipExperience ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priorInternshipExperience: e.target.value,
                  })
                }
              >
                <option value="">Select…</option>
                {PRIOR_INTERNSHIPS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-ghost disabled:opacity-30"
          >
            ← Back
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-slate-500">
              Step {step + 1} of {STEPS.length}
            </p>
            {/* Skip jumps straight to save — keeps whatever they've already
                filled in. They can finish later from /settings. */}
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              Skip for now
            </button>
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
