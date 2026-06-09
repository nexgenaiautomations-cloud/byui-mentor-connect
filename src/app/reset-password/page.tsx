import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { Logo } from "@/components/logo";
import { ResetPasswordForm } from "./reset-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  const { token } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F8FB] px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-3"
        >
          <Logo size={36} />
          <span className="font-display text-base font-black tracking-tight text-navy-800">
            BYUI CAN
          </span>
        </Link>
        <div className="card">
          <h1 className="font-display text-2xl font-bold text-navy-800">
            Choose a new password
          </h1>
          {!token ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                This page needs a reset token. Request a new link to continue.
              </p>
              <Link
                href="/forgot-password"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-byui-blue-dark cursor-pointer"
              >
                Request a new reset link
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">
                Pick something you&apos;ll remember. You&apos;ll be signed in
                after the reset.
              </p>
              <div className="mt-5">
                <ResetPasswordForm token={token} />
              </div>
            </>
          )}
          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-sm">
            <Link
              href="/login"
              className="font-semibold text-byui-blue hover:underline"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
