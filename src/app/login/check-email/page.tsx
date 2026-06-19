import Link from "next/link";
import { Logo } from "@/components/logo";
import { ResendVerifyButton } from "./resend-button";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; purpose?: string }>;
}) {
  const params = await searchParams;
  const purpose = params.purpose === "verify" ? "verify" : "magic";
  const email = (params.email ?? "").trim();

  const heading =
    purpose === "verify" ? "Verify your email." : "Check your inbox.";
  const body =
    purpose === "verify"
      ? "We just emailed a verification link to your BYU-Idaho address. Click it to finish creating your account — then come back here and sign in."
      : "We just emailed a sign-in link to your BYU-Idaho address. Open it from the same device you started on. The link expires in 24 hours and can only be used once.";

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-byui-blue-light/30 via-white to-white px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-byui-blue-light/40 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 flex items-center justify-center">
          <Logo size={44} />
        </div>
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-byui-blue-light/30 text-2xl text-byui-blue-dark">
          ✉
        </div>
        <h1 className="font-display text-2xl font-black text-byui-blue-dark">
          {heading}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        {email && (
          <p className="mt-1 text-xs font-semibold text-byui-blue-dark">
            {email}
          </p>
        )}

        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-left text-xs text-slate-600">
          <p className="font-semibold text-byui-blue-dark">Not seeing it?</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Wait up to 3 minutes — university mail can lag.</li>
            <li>Check spam or Outlook&apos;s &ldquo;Other&rdquo; tab.</li>
            <li>Make sure you used your <strong>@byui.edu</strong> address.</li>
          </ul>
        </div>

        {purpose === "verify" && email && (
          <div className="mt-4">
            <ResendVerifyButton email={email} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-byui-blue-light bg-white px-4 py-2 text-sm font-semibold text-byui-blue-dark transition hover:bg-byui-blue-light/20 cursor-pointer"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark cursor-pointer"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
