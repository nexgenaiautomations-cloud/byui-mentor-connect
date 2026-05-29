import Link from "next/link";
import { signOut } from "../../auth";
import type { User } from "@/db/schema";
import { Logo } from "./logo";

function initials(name: string | null | undefined, fallback: string) {
  if (!name) return fallback;
  return name.split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);
}

type NavItem = { href: string; label: string; icon: React.ReactNode };

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  home: <><path d="M3 12 12 3l9 9" /><path d="M5 10v10h14V10" /></>,
  search: <><circle cx={11} cy={11} r={7} /><path d="m21 21-4.3-4.3" /></>,
  inbox: <><path d="M3 7h18" /><rect x={3} y={7} width={18} height={13} rx={2} /><path d="M3 13h5l2 3h4l2-3h5" /></>,
  link: <><path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5" /><path d="M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5" /></>,
  clipboard: <><rect x={5} y={4} width={14} height={17} rx={2} /><path d="M9 4h6v3H9z" /><path d="M9 12h6M9 16h4" /></>,
  star: <><path d="m12 3 2.7 5.7 6.3.9-4.5 4.4 1 6.3-5.5-3-5.5 3 1-6.3L3 9.6l6.3-.9z" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z" /></>,
  user: <><circle cx={12} cy={8} r={4} /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></>,
};

export function Sidebar({ user }: { user: User }) {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: <Icon>{ICONS.home}</Icon> },
    { href: "/mentors", label: "Find a mentor", icon: <Icon>{ICONS.search}</Icon> },
    { href: "/requests", label: "Requests", icon: <Icon>{ICONS.inbox}</Icon> },
    { href: "/matches", label: "Matches", icon: <Icon>{ICONS.link}</Icon> },
  ];
  if (user.isMentor) {
    items.push({ href: "/log-meeting", label: "Log a meeting", icon: <Icon>{ICONS.clipboard}</Icon> });
  }
  items.push({ href: "/check-in", label: "Monthly check-in", icon: <Icon>{ICONS.star}</Icon> });
  if (!user.isMentor) {
    items.push({ href: "/apply-mentor", label: "Apply to mentor", icon: <Icon>{ICONS.user}</Icon> });
  }
  if (user.isAdmin) {
    items.push({ href: "/admin", label: "Admin", icon: <Icon>{ICONS.shield}</Icon> });
  }

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <Logo size={40} />
        <div className="leading-tight">
          <p className="font-display text-sm font-black tracking-tight text-navy-800">BYUI CAN</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Mentor Connect
          </p>
        </div>
      </Link>

      <nav className="flex-1 px-3">
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-navy-50 hover:text-navy-800 cursor-pointer"
              >
                <span className="text-slate-400 group-hover:text-navy-700">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-100 px-3 py-4">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50 cursor-pointer"
        >
          <div className="h-9 w-9 overflow-hidden rounded-full bg-navy-700 text-white grid place-items-center text-xs font-semibold">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(user.name, "?")
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-navy-800">{user.name || "Member"}</p>
            <p className="truncate text-[11px] text-slate-500">
              {user.isAdmin ? "Admin" : user.isMentor ? "Mentor" : "Member"}
            </p>
          </div>
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          className="mt-2"
        >
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileBar({ user }: { user: User }) {
  const items = [
    { href: "/dashboard", label: "Home" },
    { href: "/mentors", label: "Mentors" },
    { href: "/requests", label: "Requests" },
    { href: "/matches", label: "Matches" },
    { href: "/profile", label: "Profile" },
  ];
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className="flex-1 px-2 py-2.5 text-center text-[11px] font-semibold text-slate-500 hover:text-navy-700 cursor-pointer"
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
