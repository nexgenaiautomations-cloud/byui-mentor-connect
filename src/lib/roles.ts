// Multi-role support: a user can be any subset of {member, mentor, admin}.
// "Member" is the default identity that everyone has; mentor + admin layer
// on top via DB flags. The "active role" is what the sidebar + dashboards
// currently behave as — stored in a cookie so it persists across visits.
//
// Pure module: no `next/headers` import here, so it's safe for client
// components (sidebar, mobile-menu, topbar) to import the types/constants.
// The cookie-reader lives in `lib/roles-server.ts`.
//
// Head admin is a separate flag on top of admin (handled in lib/head-admin.ts).
import type { User } from "@/db/schema";

export type ActiveRole = "member" | "mentor" | "admin";

export const ROLE_LABELS: Record<ActiveRole, string> = {
  member: "Member",
  mentor: "Mentor",
  admin: "Admin",
};

export const ACTIVE_ROLE_COOKIE = "byui-can-role";

// Roles the user is allowed to switch into. Order matches the natural
// progression (member → mentor → admin) which is also the dropdown order.
//
// Everyone is a member — every user can log + track their own activities.
// Every admin is also a mentor (admins help students directly too), so the
// dropdown shows all three options for admins, mentor + member for plain
// mentors, and just member for plain members.
export function availableRoles(user: User): ActiveRole[] {
  const roles: ActiveRole[] = ["member"];
  if (user.isMentor || user.isAdmin) roles.push("mentor");
  if (user.isAdmin) roles.push("admin");
  return roles;
}

// The privilege-default — when the cookie isn't set, pick the most powerful
// role available. Admins default to admin; mentors default to mentor;
// everyone else gets member.
export function defaultRole(user: User): ActiveRole {
  if (user.isAdmin) return "admin";
  if (user.isMentor) return "mentor";
  return "member";
}

