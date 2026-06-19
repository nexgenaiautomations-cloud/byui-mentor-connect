"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setActiveRoleAction, signOutAction } from "@/lib/actions";
import type { User } from "@/db/schema";
import { ROLE_LABELS, type ActiveRole } from "@/lib/roles";
import { Logo } from "./logo";

type NavItem = { href: string; label: string };

function buildNav(
  activeRole: ActiveRole,
  isHeadAdmin: boolean
): { primary: NavItem[]; admin: NavItem[] } {
  const primary: NavItem[] = [];

  if (activeRole === "mentor") {
    primary.push(
      { href: "/dashboard", label: "Dashboard" },
      { href: "/matches", label: "My Mentees" },
      { href: "/log-meeting", label: "Log a Meeting" }
    );
  } else if (activeRole === "member") {
    primary.push(
      { href: "/dashboard", label: "Dashboard" },
      { href: "/mentors", label: "Find a Mentor" },
      { href: "/matches", label: "My Mentors" },
      { href: "/log-meeting", label: "Log an Activity" },
      { href: "/trophy-case", label: "Trophy Case" }
    );
  }
  if (activeRole !== "admin") {
    primary.push({ href: "/settings", label: "Settings" });
  }

  const admin: NavItem[] = [];
  if (activeRole === "admin") {
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
    if (isHeadAdmin) {
      admin.push({ href: "/admin/admins", label: "Manage admins" });
    }
    admin.push({ href: "/settings", label: "Settings" });
  }
  return { primary, admin };
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileMenu({
  user,
  activeRole,
  availableRoles,
}: {
  user: User;
  activeRole: ActiveRole;
  availableRoles: ActiveRole[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const pathname = usePathname() || "/";
  const { primary, admin } = buildNav(activeRole, user.isHeadAdmin);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25 cursor-pointer"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
             strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy-900/70 backdrop-blur-sm"
          />
          {/* Drawer — slides in from the right to match the trigger button */}
          <aside className="absolute right-0 top-0 flex h-full w-72 flex-col bg-navy-900 text-white shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-5">
              <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                <Logo size={36} />
                <div className="leading-tight">
                  <p className="font-display text-sm font-black tracking-tight text-white">BYUI CAN</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                    Mentor Connect
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                     strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M6 6 18 18M18 6 6 18" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-6">
              {availableRoles.length > 1 && (
                <div className="mb-4">
                  <label
                    htmlFor="mobile-role-switcher"
                    className="block text-[10px] font-bold uppercase tracking-wider text-white/60"
                  >
                    Active role
                  </label>
                  <select
                    id="mobile-role-switcher"
                    value={activeRole}
                    disabled={switching}
                    onChange={(e) => {
                      const next = e.target.value as ActiveRole;
                      startSwitch(async () => {
                        await setActiveRoleAction(next);
                        router.push("/dashboard");
                        setOpen(false);
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-2 py-1.5 text-sm font-semibold text-white outline-none disabled:opacity-50 cursor-pointer"
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r} className="text-slate-800">
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <ul className="space-y-1.5">
                {primary.map((item) => (
                  <DrawerLink key={item.href} item={item} active={isActive(pathname, item.href)} />
                ))}
              </ul>

              {admin.length > 0 && (
                <>
                  <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                    Admin
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {admin.map((item) => (
                      <DrawerLink key={item.href} item={item} active={isActive(pathname, item.href)} />
                    ))}
                  </ul>
                </>
              )}
            </nav>

            <div className="border-t border-white/15 px-6 py-5">
              <p className="truncate text-sm font-semibold text-white">{user.name || "Member"}</p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-byui-blue-light">
                {user.isHeadAdmin
                  ? `Head Admin · ${ROLE_LABELS[activeRole]}`
                  : `Viewing as ${ROLE_LABELS[activeRole]}`}
              </p>
              <form action={signOutAction} className="mt-3">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white hover:bg-byui-blue-dark cursor-pointer"
                >
                  Sign out →
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function DrawerLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={
          "block py-2 text-[15px] font-semibold tracking-tight transition cursor-pointer " +
          (active
            ? "text-byui-blue-light border-y border-byui-blue"
            : "text-white/85 hover:text-white")
        }
      >
        {item.label}
      </Link>
    </li>
  );
}
