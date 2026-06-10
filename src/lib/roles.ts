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
export function availableRoles(user: User): ActiveRole[] {
  const roles: ActiveRole[] = [];
  // Pure admins never operate as "member" — they got into the program as
  // staff. Including member here would let them see the mentee dashboard
  // which has nothing for them. Everyone else gets member by default.
  if (!user.isAdmin || user.isMentor) roles.push("member");
  if (user.isMentor) roles.push("mentor");
  if (user.isAdmin) roles.push("admin");
  // Pure-admin fallback so the array is never empty.
  if (roles.length === 0) roles.push("admin");
  return roles;
}

// The privilege-default — when the cookie isn't set, pick the most powerful
// role available. Mentors who are also members default to mentor; admins
// default to admin; pure members get member.
export function defaultRole(user: User): ActiveRole {
  if (user.isAdmin) return "admin";
  if (user.isMentor) return "mentor";
  return "member";
}

