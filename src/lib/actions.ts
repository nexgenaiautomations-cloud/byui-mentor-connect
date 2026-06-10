"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signOut } from "../../auth";
import { getCurrentUser } from "./session";
import {
  ACTIVE_ROLE_COOKIE,
  availableRoles,
  type ActiveRole,
} from "./roles";

export async function signOutAction() {
  // NextAuth v5 + Next 16: `signOut({ redirectTo })` sometimes swallows the
  // navigation when invoked from a client-component form action. Do the
  // cookie clearing without the built-in redirect, then trigger an explicit
  // `redirect()` so Next always navigates.
  try {
    await signOut({ redirect: false });
  } catch {
    // signOut can throw a NEXT_REDIRECT even when redirect:false — let it pass
  }
  redirect("/");
}

// Switch the user's active role. Validates against the actual roles they
// have flagged on their account so cookie tampering can't elevate privileges.
// Re-validates the layout so the sidebar and any role-aware page rerenders.
export async function setActiveRoleAction(role: ActiveRole) {
  const user = await getCurrentUser();
  if (!user) return;
  if (!(availableRoles(user) as string[]).includes(role)) return;

  const store = await cookies();
  store.set(ACTIVE_ROLE_COOKIE, role, {
    httpOnly: false, // intentional — read by the sidebar's client UI
    sameSite: "lax",
    path: "/",
    // ~30 days; matches the JWT session default so it doesn't outlive auth.
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
}
