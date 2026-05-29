import Link from "next/link";
import { signOut } from "../../auth";
import type { User } from "@/db/schema";

function initials(name: string | null | undefined, fallback: string) {
  if (!name) return fallback;
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Nav({ user }: { user: User }) {
  return (
    <nav className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-100 bg-white/80 px-6 backdrop-blur">
      <Link href="/dashboard" className="flex items-center gap-3">
        <span className="font-display text-lg font-black tracking-tight text-navy-700">BYUI CAN</span>
        <span className="text-sm font-medium text-slate-500">Mentor Connect</span>
      </Link>
      <div className="flex items-center gap-5">
        <Link href="/mentors" className="text-sm font-medium text-slate-600 hover:text-navy-700">
          Find mentors
        </Link>
        <Link href="/requests" className="text-sm font-medium text-slate-600 hover:text-navy-700">
          Requests
        </Link>
        <Link href="/matches" className="text-sm font-medium text-slate-600 hover:text-navy-700">
          Matches
        </Link>
        {user.isAdmin && (
          <Link href="/admin" className="text-sm font-medium text-slate-600 hover:text-navy-700">
            Admin
          </Link>
        )}
        <Link
          href="/profile"
          className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-navy-700 text-sm font-semibold text-white"
          aria-label="Profile"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "Profile"}
              className="h-full w-full object-cover"
            />
          ) : (
            initials(user.name, "?")
          )}
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn-ghost">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
