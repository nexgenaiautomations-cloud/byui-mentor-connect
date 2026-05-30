"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/lib/actions";
import type { User } from "@/db/schema";
import { Logo } from "./logo";

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
  primary.push({ href: "/profile", label: "Profile" });

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

export function MobileMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";
  const { primary, admin } = buildNav(user);

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
          {/* Drawer */}
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-navy-900 text-white shadow-2xl">
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
              <p className="text-[11px] font-medium uppercase tracking-wider text-gold-300">
                {user.isAdmin ? "Admin" : user.isMentor ? "Mentor" : "Member"}
              </p>
              <form action={signOutAction} className="mt-3">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-navy-900 hover:bg-gold-400 cursor-pointer"
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
            ? "text-gold-300 border-y border-gold-400"
            : "text-white/85 hover:text-white")
        }
      >
        {item.label}
      </Link>
    </li>
  );
}
