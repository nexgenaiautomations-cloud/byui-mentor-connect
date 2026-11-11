import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { signOutAction } from "@/lib/actions";

export const metadata: Metadata = {
  title: "Account not active · ICAN",
};

// Landing page for a signed-in session whose account an admin removed.
// Lives outside the (app) group so the app layout's gate can't loop.
export default function AccountRemovedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-brand-light/30 via-white to-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Logo size={40} tile />
          <span className="font-brand text-2xl font-semibold tracking-[0.12em] text-plum-800">ICAN</span>
        </div>
        <div className="card text-center">
          <h1 className="font-display text-2xl font-bold text-plum-800">Your account isn&apos;t active</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            An ICAN admin has removed this account from the program, so you can&apos;t
            sign in right now. If you think this is a mistake, contact your
            program&apos;s ICAN admins.
          </p>
          <form action={signOutAction} className="mt-6">
            <button
              type="submit"
              className="min-h-11 w-full cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
