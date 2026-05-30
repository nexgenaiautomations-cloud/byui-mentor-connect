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

type NavItem = { href: string; label: string };

function buildNav(user: User): { primary: NavItem[]; admin: NavItem[] } {
  const isPureAdmin = user.isAdmin && !user.isMentor;
  const primary: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];
  if (!isPureAdmin) primary.push({ href: "/mentors", label: "Find a mentor" });
  primary.push(
    { href: "/requests", label: user.isMentor ? "Requests" : "My requests" },
    { href: "/matches", label: user.isMentor ? "My mentees" : "My matches" }
  );
  if (user.isMentor) primary.push({ href: "/log-meeting", label: "Log a meeting" });
  primary.push({ href: "/check-in", label: "Monthly check-in" });
  if (!user.isMentor && !user.isAdmin) primary.push({ href: "/apply-mentor", label: "Apply to mentor" });

  const admin: NavItem[] = [];
  if (user.isAdmin) {
    admin.push(
      { href: "/admin", label: "Overview" },
      { href: "/admin/members", label: "Members" },
      { href: "/admin/mentors", label: "Mentors" },
      { href: "/admin/applications", label: "Applications" },
      { href: "/admin/activity", label: "Activity" }
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
    <aside className="hidden lg:flex fixed left-0 top-0 z-10 h-screen w-64 flex-col text-white">
      <Link href="/dashboard" className="flex items-center gap-3 px-6 pt-7 pb-8 cursor-pointer">
        <Logo size={44} />
        <div className="leading-tight">
          <p className="font-display text-sm font-black tracking-tight text-white">BYUI CAN</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Mentor Connect
          </p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-6">
        <ul className="space-y-1.5">
          {primary.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </ul>

        {admin.length > 0 && (
          <>
            <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              Admin
            </p>
            <ul className="mt-2 space-y-1.5">
              {admin.map((item) => (
                <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-white/15 px-6 py-5">
        <Link
          href="/profile"
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="h-10 w-10 overflow-hidden rounded-full bg-white/10 grid place-items-center text-xs font-semibold ring-2 ring-white/30">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(user.name, "?")
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-white">{user.name || "Member"}</p>
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-gold-300">
              {user.isAdmin ? "Admin" : user.isMentor ? "Mentor" : "Member"}
            </p>
          </div>
        </Link>
        <InstallButton variant="sidebar" />
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-lg bg-gold-500 px-3 py-2 text-center text-xs font-bold text-navy-900 transition hover:bg-gold-400 cursor-pointer"
          >
            Sign out →
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
          "block py-1.5 text-[15px] font-semibold tracking-tight transition cursor-pointer " +
          (active
            ? "text-gold-300 border-y border-gold-400"
            : "text-white/85 hover:text-white")
        }
      >
        {item.label}
      </Link>
    </li>
  );
}

export function MobileBar({ user }: { user: User }) {
  const pathname = usePathname() || "/";
  // 4 destinations per role. "Profile" lives in the topbar avatar — duplicating
  // it here would crowd the bar. Sign out lives in the hamburger drawer and
  // on the profile page.
  let items: { href: string; label: string }[];
  if (user.isAdmin && !user.isMentor) {
    items = [
      { href: "/admin", label: "Overview" },
      { href: "/admin/members", label: "Members" },
      { href: "/admin/applications", label: "Review" },
      { href: "/admin/activity", label: "Activity" },
    ];
  } else if (user.isMentor) {
    items = [
      { href: "/dashboard", label: "Home" },
      { href: "/requests", label: "Requests" },
      { href: "/matches", label: "Mentees" },
      { href: "/log-meeting", label: "Meetings" },
    ];
  } else {
    items = [
      { href: "/dashboard", label: "Home" },
      { href: "/mentors", label: "Mentors" },
      { href: "/requests", label: "Requests" },
      { href: "/matches", label: "Matches" },
    ];
  }
  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex bg-navy-900/95 backdrop-blur border-t border-white/10">
      {items.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "flex-1 px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wider transition cursor-pointer " +
              (active
                ? "text-gold-300 border-y border-gold-400"
                : "text-white/80 hover:text-white")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
