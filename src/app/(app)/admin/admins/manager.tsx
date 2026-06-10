"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AdminRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isHeadAdmin: boolean;
  createdAt: string;
};

function avatarUrl(name: string | null, email: string) {
  const seed = encodeURIComponent(name || email);
  return `https://api.dicebear.com/9.x/initials/svg?seed=${seed}&backgroundColor=1B3A6B&textColor=ffffff`;
}

export function AdminManager({
  currentUserId,
  admins,
}: {
  currentUserId: string;
  admins: AdminRow[];
}) {
  return (
    <>
      <PromoteForm />
      <AdminList currentUserId={currentUserId} admins={admins} />
    </>
  );
}

function PromoteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const value = email.trim().toLowerCase();
    if (!value) {
      setError("Enter the user's BYU-I email.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "promote", email: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Could not promote that user.");
        return;
      }
      setSuccess(`Promoted ${body.user?.email ?? value} to admin.`);
      setEmail("");
      router.refresh();
    });
  }

  return (
    <section className="card">
      <h2 className="font-display text-lg font-bold text-navy-800">
        Promote a new admin
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        The user must have signed in at least once. We&apos;ll mark their
        account as admin — they&apos;ll see admin tabs next time they pick
        Admin in the role switcher.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1">
          <label htmlFor="promote-email" className="label">
            BYU-I email
          </label>
          <input
            id="promote-email"
            type="email"
            className="input"
            placeholder="newadmin@byui.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Promoting…" : "Promote to admin"}
        </button>
      </form>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </p>
      )}
    </section>
  );
}

function AdminList({
  currentUserId,
  admins,
}: {
  currentUserId: string;
  admins: AdminRow[];
}) {
  return (
    <section className="card">
      <h2 className="font-display text-lg font-bold text-navy-800">
        Current admins ({admins.length})
      </h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {admins.map((a) => (
          <AdminRowItem key={a.id} admin={a} currentUserId={currentUserId} />
        ))}
      </ul>
    </section>
  );
}

function AdminRowItem({
  admin: a,
  currentUserId,
}: {
  admin: AdminRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSelf = a.id === currentUserId;

  function doAction(action: "demote" | "transfer_head") {
    if (action === "demote") {
      if (
        !confirm(
          `Remove admin access for ${a.name ?? a.email}? They'll keep their member/mentor role if they had one.`
        )
      ) {
        return;
      }
    }
    if (action === "transfer_head") {
      if (
        !confirm(
          `Hand over head-admin to ${a.name ?? a.email}? You'll lose head-admin powers immediately. (You'll keep regular admin.)`
        )
      ) {
        return;
      }
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, userId: a.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || "Action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={a.image || avatarUrl(a.name, a.email)}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-navy-800">
          {a.name || a.email}{" "}
          {a.isHeadAdmin && (
            <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
              Head Admin
            </span>
          )}
          {isSelf && (
            <span className="ml-1 text-[11px] font-medium text-slate-400">
              (you)
            </span>
          )}
        </p>
        <p className="truncate text-xs text-slate-500">
          {a.email} · admin since{" "}
          {new Date(a.createdAt).toLocaleDateString(undefined, {
            month: "short",
            year: "numeric",
          })}
        </p>
        {error && (
          <p className="mt-1 text-[11px] text-rose-600">{error}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Demote only available for non-head admins */}
        {!a.isHeadAdmin && (
          <button
            type="button"
            onClick={() => doAction("demote")}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 cursor-pointer"
          >
            Remove admin
          </button>
        )}
        {/* Transfer head-admin only on other admins, only callable when the
            current user is the head admin (route enforces this too). */}
        {!isSelf && !a.isHeadAdmin && (
          <button
            type="button"
            onClick={() => doAction("transfer_head")}
            disabled={pending}
            className="inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-40 cursor-pointer"
          >
            Make Head Admin
          </button>
        )}
      </div>
    </li>
  );
}
