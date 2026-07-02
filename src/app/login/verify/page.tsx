import Link from "next/link";
import { Logo } from "@/components/logo";

// Two-step magic-link confirmation. The email links to this page (not directly
// to /api/auth/callback/resend) so that Microsoft Defender / Outlook Safe
// Links / Gmail link-preview can prefetch this page without burning the
// one-time verification token. The actual sign-in only happens when the user
// clicks the button below, which submits a GET to the real callback.
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; callbackUrl?: string }>;
}) {
  const { token = "", email = "", callbackUrl = "/dashboard" } = await searchParams;

  // The email param is attacker-choosable (it's just a query string), and this
  // page renders it as "you're signing in as X" before any token validation.
  // Only sign-ins for @byui.edu addresses can succeed, so refuse to lend the
  // page's credibility to anything else.
  const displayEmail = /^[^\s@]+@byui\.edu$/i.test(email) ? email : "";

  if (!token || !email || !displayEmail) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-byui-blue-light/30 via-white to-white px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-soft">
          <h1 className="font-display text-2xl font-black text-rose-700">Link is incomplete.</h1>
          <p className="mt-2 text-sm text-slate-600">
            Open the original link from the email — some clients trim parts of the URL.
          </p>
          <Link href="/login" className="mt-5 inline-flex items-center justify-center rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white hover:bg-byui-blue-dark cursor-pointer">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-byui-blue-light/30 via-white to-white px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-byui-blue-light/40 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 flex items-center justify-center">
          <Logo size={44} />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-byui-blue">
          Confirm sign-in
        </p>
        <h1 className="mt-1 font-display text-2xl font-black text-byui-blue-dark">
          Almost there.
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;re signing in as <strong className="text-byui-blue-dark">{email}</strong>.
          Click the button below to finish.
        </p>

        <form action="/api/auth/callback/resend" method="GET" className="mt-6">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <button
            type="submit"
            className="w-full rounded-lg bg-byui-blue px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-byui-blue-dark active:scale-[0.98] cursor-pointer"
          >
            Sign in to Mentor Connect →
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          This extra click keeps your account safe from email scanners that
          pre-fetch links. The full magic link only redeems when you confirm here.
        </p>
      </div>
    </main>
  );
}
