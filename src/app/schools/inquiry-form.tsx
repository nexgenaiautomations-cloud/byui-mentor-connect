"use client";

import { useState, useTransition } from "react";

const FIELDS = [
  { id: "contactName", label: "Your name", type: "text", required: true, autoComplete: "name" },
  { id: "contactEmail", label: "Work email", type: "email", required: true, autoComplete: "email" },
  { id: "schoolName", label: "School", type: "text", required: true, autoComplete: "organization" },
  { id: "role", label: "Your role", type: "text", required: false, autoComplete: "organization-title", placeholder: "e.g. Career services director" },
  { id: "emailDomain", label: "Student email domain", type: "text", required: false, autoComplete: "off", placeholder: "e.g. school.edu" },
] as const;

type FieldId = (typeof FIELDS)[number]["id"] | "message" | "website";

export function SchoolInquiryForm() {
  const [values, setValues] = useState<Record<FieldId, string>>({
    contactName: "",
    contactEmail: "",
    schoolName: "",
    role: "",
    emailDomain: "",
    message: "",
    website: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (id: FieldId) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [id]: e.target.value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/school-inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "We couldn't send that. Please try again.");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-semibold">Thanks, we got it.</p>
        <p className="mt-1">
          We&apos;ll reply to {values.contactEmail} within a few business days to talk about
          bringing ICAN to {values.schoolName}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.id} className={f.id === "emailDomain" ? "sm:col-span-2" : ""}>
            <label htmlFor={f.id} className="label">
              {f.label}
              {!f.required && <span className="font-normal text-slate-500"> (optional)</span>}
            </label>
            <input
              id={f.id}
              type={f.type}
              required={f.required}
              autoComplete={f.autoComplete}
              placeholder={"placeholder" in f ? f.placeholder : undefined}
              className="input"
              value={values[f.id]}
              onChange={set(f.id)}
            />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="message" className="label">
          Anything we should know? <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea
          id="message"
          rows={4}
          maxLength={3000}
          className="input"
          value={values.message}
          onChange={set("message")}
        />
      </div>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending ? "Sending…" : "Send to the ICAN team"}
      </button>
    </form>
  );
}
