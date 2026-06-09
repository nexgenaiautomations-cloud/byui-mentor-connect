"use client";

import { useEffect, useState } from "react";

export type MentorProfile = {
  id: string;
  name: string | null;
  image: string | null;
  major: string | null;
  minor: string | null;
  semesterLevel: string | null;
  expectedGraduation: string | null;
  bio: string | null;
  careerInterests: string[] | null;
  mentorTopics: string[] | null;
  mentorCapacity: number | null;
  activeCount: number;
  slotsLeft: number;
};

function avatarUrl(name: string | null) {
  const seed = encodeURIComponent(name || "Mentor");
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=1B3A6B&textColor=ffffff`;
}

// Inline "View profile" button + modal. Drops into a server-component card.
// The modal shows the un-truncated bio, the full mentor topics list, and the
// full career interests list — everything that gets clipped on the card.
export function MentorProfileButton({
  mentor,
  myStatus,
  onAfterRequest,
}: {
  mentor: MentorProfile;
  myStatus?: "pending" | "accepted";
  onAfterRequest?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-byui-blue hover:text-byui-blue-dark cursor-pointer"
      >
        View profile
      </button>
      {open && (
        <ProfileModal
          mentor={mentor}
          myStatus={myStatus}
          onClose={() => setOpen(false)}
          onAfterRequest={onAfterRequest}
        />
      )}
    </>
  );
}

function ProfileModal({
  mentor: m,
  myStatus,
  onClose,
  onAfterRequest,
}: {
  mentor: MentorProfile;
  myStatus?: "pending" | "accepted";
  onClose: () => void;
  onAfterRequest?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(myStatus === "pending");
  const [error, setError] = useState<string | null>(null);

  async function sendRequest() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mentorId: m.id, message: message || null }),
      });
      if (res.status === 409) {
        setSent(true);
        onAfterRequest?.();
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to send request");
      }
      setSent(true);
      onAfterRequest?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send request");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={() => !sending && onClose()}
        className="absolute inset-0 bg-byui-blue-dark/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`mentor-${m.id}-title`}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-4 ring-byui-blue"
      >
        <div className="flex items-start gap-4 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.image || avatarUrl(m.name)}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full border border-slate-200 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
              Mentor
            </p>
            <h2
              id={`mentor-${m.id}-title`}
              className="font-display text-xl font-black text-byui-blue-dark sm:text-2xl"
            >
              {m.name ?? "Mentor"}
            </h2>
            <p className="text-sm text-slate-600">
              {m.major}
              {m.minor ? ` · ${m.minor}` : ""}
            </p>
            <p className="text-xs text-slate-500">
              {m.semesterLevel}
              {m.expectedGraduation ? ` · grad ${m.expectedGraduation}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !sending && onClose()}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {m.bio && (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
                About
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {m.bio}
              </p>
            </section>
          )}

          {m.mentorTopics && m.mentorTopics.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
                Can help with
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.mentorTopics.map((t) => (
                  <span key={t} className="pill">
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {m.careerInterests && m.careerInterests.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
                Career interests
              </h3>
              <p className="mt-2 text-sm text-slate-700">
                {m.careerInterests.join(", ")}
              </p>
            </section>
          )}

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-byui-blue">
              Availability
            </h3>
            <p
              className={
                "mt-2 text-sm font-bold " +
                (m.slotsLeft > 0 ? "text-emerald-700" : "text-slate-500")
              }
            >
              {m.slotsLeft > 0
                ? `${m.slotsLeft} of ${m.mentorCapacity} mentee spots left`
                : "Currently at capacity"}
            </p>
          </section>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          {myStatus === "accepted" ? (
            <p className="text-sm font-semibold text-emerald-700">
              ✓ {m.name?.split(" ")[0] ?? "This mentor"} is already your mentor.
              See contact info in <a href="/matches" className="underline">My Mentors</a>.
            </p>
          ) : sent || myStatus === "pending" ? (
            <p className="text-sm font-semibold text-amber-700">
              ✓ Request sent. Waiting on{" "}
              {m.name?.split(" ")[0] ?? "the mentor"} to accept or decline.
            </p>
          ) : (
            <>
              <label htmlFor={`msg-${m.id}`} className="label">
                Optional message
              </label>
              <textarea
                id={`msg-${m.id}`}
                rows={3}
                className="input"
                maxLength={1000}
                placeholder="A short, specific note doubles your accept rate. What do you want to work on?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendRequest}
                  disabled={sending || m.slotsLeft <= 0}
                  className="btn-primary"
                >
                  {sending
                    ? "Sending…"
                    : m.slotsLeft <= 0
                      ? "At capacity"
                      : "Send request"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
