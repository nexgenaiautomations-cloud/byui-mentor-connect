"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/actions";
import type { User } from "@/db/schema";
import { Logo } from "./logo";
import { InstallButton } from "./install-button";

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
      className="h-[18px] w-[18px]"
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
  users: <><circle cx={9} cy={8} r={3.5} /><path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx={17} cy={9} r={2.5} /><path d="M16 21c0-2.7 2-5 5-5" /></>,
  chart: <><path d="M4 20V4" /><path d="M20 20H4" /><path d="m7 16 4-5 3 3 6-7" /></>,
};

function buildNav(user: User): { primary: NavItem[]; admin: NavItem[] } {
  const isPureAdmin = user.isAdmin && !user.isMentor;
  const primary: NavItem[] = [{ href: "/dashboard", label: "Dashboard", icon: <Icon>{ICONS.home}</Icon> }];

  if (!isPureAdmin) {
    primary.push({ href: "/mentors", label: "Find a mentor", icon: <Icon>{ICONS.search}</Icon> });
  }
  primary.push(
    { href: "/requests", label: user.isMentor ? "Requests" : "My requests", icon: <Icon>{ICONS.inbox}</Icon> },
    { href: "/matches", label: user.isMentor ? "My mentees" : "My matches", icon: <Icon>{ICONS.link}</Icon> }
  );
  if (user.isMentor) {
    primary.push({ href: "/log-meeting", label: "Log a meeting", icon: <Icon>{ICONS.clipboard}</Icon> });
  }
  primary.push({ href: "/check-in", label: "Monthly check-in", icon: <Icon>{ICONS.star}</Icon> });
  if (!user.isMentor && !user.isAdmin) {
    primary.push({ href: "/apply-mentor", label: "Apply to mentor", icon: <Icon>{ICONS.user}</Icon> });
  }

  const admin: NavItem[] = [];
  if (user.isAdmin) {
    admin.push(
      { href: "/admin", label: "Overview", icon: <Icon>{ICONS.shield}</Icon> },
      { href: "/admin/members", label: "Members", icon: <Icon>{ICONS.users}</Icon> },
      { href: "/admin/mentors", label: "Mentors", icon: <Icon>{ICONS.star}</Icon> },
      { href: "/admin/applications", label: "Applications", icon: <Icon>{ICONS.inbox}</Icon> },
      { href: "/admin/activity", label: "Activity", icon: <Icon>{ICONS.chart}</Icon> }
    );
  }
  return { primary, admin };
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname() || "/";
  const { primary, admin } = buildNav(user);

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-navy-900 text-white">
      <Link href="/dashboard" className="flex items-center gap-3 px-5 pt-6 pb-7 cursor-pointer">
        <Logo size={40} />
        <div className="leading-tight">
          <p className="font-display text-sm font-black tracking-tight text-white">BYUI CAN</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-200">
            Mentor Connect
          </p>
        </div>
      </Link>

      <nav className="flex-1 px-3">
        <ul className="space-y-0.5">
          {primary.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </ul>

        {admin.length > 0 && (
          <>
            <p className="mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-navy-300">
              Admin
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {admin.map((item) => (
                <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5 cursor-pointer"
        >
          <div className="h-10 w-10 overflow-hidden rounded-full bg-white/10 grid place-items-center text-xs font-semibold ring-2 ring-white/20">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(user.name, "?")
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{user.name || "Member"}</p>
            <p className="truncate text-[11px] font-medium text-navy-200">
              {user.isAdmin ? "Admin" : user.isMentor ? "Mentor" : "Member"}
            </p>
          </div>
        </Link>
        <InstallButton variant="sidebar" />
        <form action={signOutAction} className="mt-1">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-navy-200 transition hover:bg-white/5 hover:text-white cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={
          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition cursor-pointer " +
          (active
            ? "bg-white text-navy-800 shadow-soft"
            : "text-navy-100 hover:bg-white/5 hover:text-white")
        }
      >
        <span className={active ? "text-navy-700" : "text-navy-300 group-hover:text-white"}>
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

export function MobileBar({ user }: { user: User }) {
  let items: { href: string; label: string }[];
  if (user.isAdmin && !user.isMentor) {
    items = [
      { href: "/admin", label: "Overview" },
      { href: "/admin/members", label: "Members" },
      { href: "/admin/applications", label: "Apps" },
      { href: "/profile", label: "Profile" },
    ];
  } else if (user.isMentor) {
    items = [
      { href: "/dashboard", label: "Home" },
      { href: "/requests", label: "Requests" },
      { href: "/matches", label: "Mentees" },
      { href: "/log-meeting", label: "Log" },
      { href: "/profile", label: "Me" },
    ];
  } else {
    items = [
      { href: "/dashboard", label: "Home" },
      { href: "/mentors", label: "Mentors" },
      { href: "/requests", label: "Requests" },
      { href: "/matches", label: "Matches" },
      { href: "/profile", label: "Me" },
    ];
  }
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
