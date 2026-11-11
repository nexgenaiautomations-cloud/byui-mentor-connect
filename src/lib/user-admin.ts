// Pure permission rules for admin user management (change role, remove,
// restore). Removing an account deactivates it (sign-in blocked, matches
// ended, hidden from lists); records are kept for accountability.

export const MANAGED_ROLES = ["member", "mentor", "executive_mentor"] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];

export const ROLE_NAMES: Record<ManagedRole, string> = {
  member: "Member",
  mentor: "Mentor",
  executive_mentor: "Executive mentor",
};

type Person = {
  id: string;
  isAdmin: boolean;
  isHeadAdmin: boolean;
  isMentor: boolean;
  isExecutiveMentor: boolean;
  deactivatedAt: Date | null;
};

export function currentRole(u: Pick<Person, "isMentor" | "isExecutiveMentor">): ManagedRole {
  if (u.isMentor && u.isExecutiveMentor) return "executive_mentor";
  if (u.isMentor) return "mentor";
  return "member";
}

function baseCheck(actor: Person, target: Person): string | null {
  if (!actor.isAdmin) return "Only admins can manage members.";
  if (target.isAdmin && !actor.isHeadAdmin) {
    return "Only the head admin can change another admin's account.";
  }
  return null;
}

export function checkRoleChange(actor: Person, target: Person, role: ManagedRole): string | null {
  if (!actor.isAdmin) return "Only admins can manage members.";
  if (actor.id === target.id) return "You can't change your own role here.";
  const base = baseCheck(actor, target);
  if (base) return base;
  if (target.deactivatedAt) return "This account was removed. Restore it first.";
  if (currentRole(target) === role) return `They are already a ${ROLE_NAMES[role].toLowerCase()}.`;
  return null;
}

export function checkRemoval(actor: Person, target: Person): string | null {
  if (!actor.isAdmin) return "Only admins can manage members.";
  if (actor.id === target.id) return "You can't remove yourself.";
  if (target.isHeadAdmin) return "The head admin can't be removed. Transfer head admin first.";
  const base = baseCheck(actor, target);
  if (base) return base;
  if (target.deactivatedAt) return "This account is already removed.";
  return null;
}

export function checkRestore(actor: Person, target: Person): string | null {
  if (!actor.isAdmin) return "Only admins can manage members.";
  if (!target.deactivatedAt) return "This account is not removed.";
  return null;
}
