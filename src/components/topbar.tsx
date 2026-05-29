import Link from "next/link";
import type { User } from "@/db/schema";
import { Logo } from "./logo";

function initials(name: string | null | undefined, fallback: string) {
  if (!name) return fallback;
  return name.split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);
}

export function TopBar({ user, title }: { user: User; title?: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="lg:hidden flex items-center gap-2">
          <Logo size={32} />
          <span className="font-display text-sm font-black tracking-tight text-navy-800">
            BYUI CAN
          </span>
        </Link>
        {title && (
          <h2 className="hidden lg:block font-display text-lg font-bold text-navy-800">{title}</h2>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`hidden sm:inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            user.isAdmin
              ? "bg-rose-50 text-rose-700"
              : user.isMentor
              ? "bg-emerald-50 text-emerald-700"
              : "bg-navy-50 text-navy-700"
          }`}
        >
          {user.isAdmin ? "Admin" : user.isMentor ? "Mentor" : "Member"}
        </span>
        <Link
          href="/profile"
          className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-navy-700 text-xs font-semibold text-white cursor-pointer ring-2 ring-white"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(user.name, "?")
          )}
        </Link>
      </div>
    </header>
  );
}
