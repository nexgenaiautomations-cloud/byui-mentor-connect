// What an admin may change on a member's profile, and who may change it.
// Email is deliberately not editable: it is the login and the school boundary.
import { z } from "zod";
import { SEMESTER_LEVELS } from "@/lib/careers";

const text = (max: number) => z.string().trim().max(max);

export const adminProfileEditSchema = z
  .object({
    firstName: text(60).min(1, "First name is required."),
    lastName: text(60).min(1, "Last name is required."),
    major: text(120),
    minor: text(120),
    semesterLevel: z.union([z.enum(SEMESTER_LEVELS as unknown as [string, ...string[]]), z.literal("")]),
    expectedGraduation: text(40),
    phone: text(40),
    preferredContactMethod: z.union([z.enum(["email", "phone", "teams"]), z.literal("")]),
    bio: text(2000),
  })
  .partial()
  .strict();

export type AdminProfileEdit = z.infer<typeof adminProfileEditSchema>;
export const ADMIN_EDITABLE_FIELDS = Object.keys(adminProfileEditSchema.shape) as (keyof AdminProfileEdit)[];

type Person = { id: string; isAdmin: boolean; isHeadAdmin: boolean };

export function checkProfileEdit(actor: Person, target: Person): string | null {
  if (!actor.isAdmin) return "Only admins can edit members.";
  if (actor.id === target.id) return "Edit your own profile in Settings.";
  if (target.isAdmin && !actor.isHeadAdmin) return "Only the head admin can edit another admin's profile.";
  return null;
}

type Current = Record<keyof AdminProfileEdit, string | null> & { name: string | null };

// Builds the column update and the list of fields that actually changed.
// Blank optional fields are stored as null. The audit log records field
// names only, never the old or new values.
export function buildProfileUpdate(current: Current, edit: AdminProfileEdit) {
  const set: Partial<Record<keyof AdminProfileEdit | "name", string | null>> = {};
  const changed: (keyof AdminProfileEdit)[] = [];
  for (const key of ADMIN_EDITABLE_FIELDS) {
    const incoming = edit[key];
    if (incoming === undefined) continue;
    const next = incoming === "" ? null : incoming;
    if ((current[key] ?? null) === next) continue;
    set[key] = next;
    changed.push(key);
  }
  if (changed.includes("firstName") || changed.includes("lastName")) {
    const first = set.firstName !== undefined ? set.firstName : current.firstName;
    const last = set.lastName !== undefined ? set.lastName : current.lastName;
    set.name = [first, last].filter((s) => s && s.trim()).join(" ").trim() || current.name;
  }
  return { set, changed };
}
