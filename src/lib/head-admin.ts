// Head-admin operations. Only the user with users.isHeadAdmin === true can
// promote/demote other admins or transfer the head-admin flag to someone
// else. Demoting the current head admin requires transferring first — the
// system always has exactly one head admin.
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function getHeadAdmin() {
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.isHeadAdmin, true))
    .limit(1);
  return row ?? null;
}

// Promote a user (by id or email) to admin. No-op if already admin.
export async function promoteToAdmin(target: { id?: string; email?: string }) {
  const where = target.id
    ? eq(users.id, target.id)
    : target.email
      ? eq(users.email, target.email.toLowerCase())
      : null;
  if (!where) throw new Error("id or email required");
  const [updated] = await db
    .update(users)
    .set({ isAdmin: true })
    .where(where)
    .returning({ id: users.id, email: users.email });
  return updated ?? null;
}

// Demote an admin. Refuses to demote the head admin — call
// transferHeadAdminTo first.
export async function demoteFromAdmin(userId: string) {
  const [row] = await db
    .select({ isHeadAdmin: users.isHeadAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new Error("User not found");
  if (row.isHeadAdmin) {
    throw new Error(
      "Cannot demote the head admin. Transfer head-admin to someone else first."
    );
  }
  const [updated] = await db
    .update(users)
    .set({ isAdmin: false })
    .where(and(eq(users.id, userId), eq(users.isHeadAdmin, false)))
    .returning({ id: users.id, email: users.email });
  return updated ?? null;
}

// Transfer the head-admin flag. Target must already be an admin so promotion
// + transfer is always a two-step intentional move. Sets the new head admin
// first, then clears the previous one.
export async function transferHeadAdminTo(
  fromUserId: string,
  toUserId: string
) {
  if (fromUserId === toUserId) {
    throw new Error("Already head admin");
  }
  const [target] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, toUserId))
    .limit(1);
  if (!target) throw new Error("Target user not found");
  if (!target.isAdmin) {
    throw new Error("Target must already be an admin");
  }

  // Promote new head admin first, then clear the old one. If the second
  // statement fails we end up with TWO head admins briefly — that's safer
  // than going zero head admins (which would lock the role for everyone).
  await db
    .update(users)
    .set({ isHeadAdmin: true })
    .where(eq(users.id, toUserId));
  await db
    .update(users)
    .set({ isHeadAdmin: false })
    .where(eq(users.id, fromUserId));
}
