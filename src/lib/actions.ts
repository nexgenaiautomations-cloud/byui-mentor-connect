"use server";

import { redirect } from "next/navigation";
import { signOut } from "../../auth";

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
