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
  const primary: NavItem[] = [];

  // Mentors don't browse for a mentor — their nav is focused on managing
  // mentees. Members get the browse + apply flow.
  if (user.isMentor) {
    primary.push(
      { href: "/dashboard", label: "Dashboard" },
      { href: "/matches", label: "My Mentees" },
      { href: "/log-meeting", label: "Log an activity" }
    );
  } else if (!user.isAdmin) {
    primary.push(
      { href: "/dashboard", label: "Dashboard" },
      { href: "/mentors", label: "Find a mentor" },
      { href: "/matches", label: "My Mentors" },
      { href: "/apply-mentor", label: "Apply to mentor" }
    );
  }
  // Pure admins skip the member/mentor primary nav entirely.

  const admin: NavItem[] = [];
  if (user.isAdmin) {
    admin.push(
      { href: "/admin", label: "Overview" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/members", label: "Members" },
      { href: "/admin/mentors", label: "Mentors" },
      { href: "/admin/applications", label: "Applications" },
      { href: "/admin/matches", label: "Matches" },
      { href: "/admin/matchmaker", label: "Matchmaker" },
      { href: "/admin/meetings", label: "Meetings" }
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
    <aside className="hidden lg:flex fixed left-0 top-0 z-10 h-screen w-64 flex-col text-white bg-gradient-to-b from-byui-blue-dark/55 via-byui-blue-dark/45 to-byui-blue-dark/40 backdrop-blur-[2px] border-r border-white/10">
      {/* Logo block matches the topbar height (h-16) so the nav below lines
          up with the white content card on the right. */}
      <Link href="/dashboard" className="flex h-16 items-center gap-3 px-6 cursor-pointer">
        <Logo size={52} />
        <div className="leading-tight">
          <p className="font-display text-sm font-black tracking-tight text-white">BYUI CAN</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            Mentor Connect
          </p>
        </div>
      </Link>

      {/* pt-6 mirrors the main's lg:p-6 so the first nav tab sits at the
          same y as the top edge of the white content card on the right. */}
      <nav className="flex-1 min-h-0 overflow-hidden px-6 pt-6">
        {primary.length > 0 && (
          <ul className="space-y-1">
            {primary.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </ul>
        )}

        {admin.length > 0 && (
          <ul
            className={
              "space-y-1 " +
              (primary.length > 0
                ? "mt-4 border-t border-white/15 pt-4"
                : "")
            }
          >
            {admin.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-white/15 px-6 py-4">
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
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-byui-blue-light">
              {user.isAdmin ? "Admin" : user.isMentor ? "Mentor" : "Member"}
            </p>
          </div>
        </Link>
        <InstallButton variant="sidebar" />
        <form action={signOutAction} className="mt-2">
          <button
            type="submit"
            className="w-full rounded-lg bg-byui-blue px-3 py-1.5 text-center text-xs font-bold text-white transition hover:bg-byui-blue-dark cursor-pointer"
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
          "block rounded-lg px-3 py-1 text-[14px] font-semibold tracking-tight transition cursor-pointer " +
          (active
            ? "bg-white text-byui-blue-dark shadow-soft"
            : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20 hover:ring-white/40")
        }
      >
        {item.label}
      </Link>
    </li>
  );
}

type BarKey =
  | "home"
  | "users"
  | "review"
  | "matches"
  | "mentors"
  | "requests"
  | "mentees"
  | "meetings";

function BarIcon({ name }: { name: BarKey }) {
  // 22px outlined glyphs matching the proposal's mobile mock (p13/p14):
  // labeled tabs with a single line icon stacked above the text.
  const cls = "h-[22px] w-[22px]";
  const stroke = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <circle cx="9" cy="9" r="3.2" />
          <circle cx="17" cy="10" r="2.4" />
          <path d="M3.5 19c.6-3 3-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
          <path d="M14.5 19c.4-2 1.9-3.4 3.5-3.4s3.1 1.4 3.5 3.4" />
        </svg>
      );
    case "mentors":
    case "mentees":
      return (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
        </svg>
      );
    case "meetings":
      return (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <rect x="3.5" y="5.5" width="17" height="14" rx="2" />
          <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
        </svg>
      );
    case "requests":
    case "review":
      return (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <path d="M5 5.5h14v9H8.5L5 18z" />
          <path d="M9 9.5h6M9 12h4" />
        </svg>
      );
    case "matches":
      return (
        <svg viewBox="0 0 24 24" className={cls} {...stroke}>
          <path d="M12 20.5s-7-4.4-7-10A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 19 10.5c0 5.6-7 10-7 10z" />
        </svg>
      );
  }
}

export function MobileBar({ user }: { user: User }) {
  const pathname = usePathname() || "/";
  // 4 destinations per role. Profile lives in the topbar avatar (per spec),
  // and the hamburger surfaces secondary items + sign out.
  let items: { href: string; label: string; icon: BarKey }[];
  if (user.isAdmin && !user.isMentor) {
    items = [
      { href: "/admin", label: "Overview", icon: "home" },
      { href: "/admin/members", label: "Members", icon: "users" },
      { href: "/admin/applications", label: "Review", icon: "review" },
      { href: "/admin/matches", label: "Matches", icon: "matches" },
    ];
  } else if (user.isMentor) {
    items = [
      { href: "/dashboard", label: "Home", icon: "home" },
      { href: "/matches", label: "Mentees", icon: "mentees" },
      { href: "/log-meeting", label: "Activity", icon: "meetings" },
    ];
  } else {
    items = [
      { href: "/dashboard", label: "Home", icon: "home" },
      { href: "/mentors", label: "Find", icon: "mentors" },
      { href: "/matches", label: "My Mentors", icon: "mentees" },
      { href: "/apply-mentor", label: "Apply", icon: "review" },
    ];
  }
  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-navy-900/95 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={
              "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px] font-semibold tracking-wide transition cursor-pointer " +
              (active
                ? "text-byui-blue-light"
                : "text-white/80 hover:text-white")
            }
          >
            <BarIcon name={it.icon} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
