"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DomainRow = { domain: string; schoolName: string; active: boolean; createdAt: string };
type InquiryRow = {
  id: string;
  contactName: string;
  contactEmail: string;
  schoolName: string;
  role: string | null;
  emailDomain: string | null;
  message: string | null;
  status: string;
  createdAt: string;
};

const STATUSES = ["new", "contacted", "added", "declined"] as const;

async function post(body: unknown): Promise<string | null> {
  const res = await fetch("/api/admin/schools", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const b = await res.json().catch(() => ({}));
  return b?.error || "Something went wrong.";
}

export function SchoolsManager({ domains, inquiries }: { domains: DomainRow[]; inquiries: InquiryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [domain, setDomain] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function run(body: unknown, done?: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const err = await post(body);
      if (err) {
        setError(err);
        return;
      }
      if (done) setSuccess(done);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="font-display text-lg font-bold text-plum-800">Add a school</h2>
        <p className="mt-1 text-xs text-slate-500">
          Students with an email at this exact domain can register right away. Subdomains are
          not included unless you add them too.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run({ action: "add", domain, schoolName }, `Added ${domain}.`);
            setDomain("");
            setSchoolName("");
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[200px] flex-1">
            <label htmlFor="school-domain" className="label">Email domain</label>
            <input
              id="school-domain"
              className="input"
              placeholder="school.edu"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label htmlFor="school-name" className="label">School name</label>
            <input
              id="school-name"
              className="input"
              placeholder="State University"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Add school"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {success}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-bold text-plum-800">Schools on ICAN ({domains.length})</h2>
        {domains.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No schools in the table yet. Until one is added, only byui.edu can register.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {domains.map((d) => (
              <li key={d.domain} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-plum-800">{d.schoolName}</p>
                  <p className="font-mono text-xs text-slate-500">@{d.domain}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={d.active ? "pill-accepted" : "pill-declined"}>
                    {d.active ? "Active" : "Paused"}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run({ action: "set_active", domain: d.domain, active: !d.active })}
                    className="btn-outline px-3 py-1.5 text-xs"
                  >
                    {d.active ? "Pause sign-ups" : "Re-activate"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="font-display text-lg font-bold text-plum-800">School inquiries ({inquiries.length})</h2>
        {inquiries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No inquiries yet. Schools reach you from the public “For schools” page.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {inquiries.map((q) => (
              <li key={q.id} className="grid gap-2 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-plum-800">{q.schoolName}</p>
                    <p className="text-sm text-slate-600">
                      {q.contactName}
                      {q.role ? ` · ${q.role}` : ""} ·{" "}
                      <span className="select-all font-mono text-xs">{q.contactEmail}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(q.createdAt).toLocaleDateString()}
                      {q.emailDomain ? ` · domain @${q.emailDomain}` : ""}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="sr-only">Status for {q.schoolName}</span>
                    <select
                      id={`status-${q.id}`}
                      value={q.status}
                      disabled={pending}
                      onChange={(e) => run({ action: "inquiry_status", id: q.id, status: e.target.value })}
                      className="input w-auto py-1.5 text-xs cursor-pointer"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s[0].toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {q.message && (
                  <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{q.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
