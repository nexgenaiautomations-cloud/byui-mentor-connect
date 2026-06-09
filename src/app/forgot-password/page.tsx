import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { Logo } from "@/components/logo";
import { ForgotPasswordForm } from "./forgot-form";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

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
            Forgot your password?
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter your BYU-I email and we&apos;ll send you a reset link. It
            expires in one hour.
          </p>
          <div className="mt-5">
            <ForgotPasswordForm />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
            <Link
              href="/login"
              className="font-semibold text-byui-blue hover:underline"
            >
              ← Back to sign in
            </Link>
            <Link
              href="/signup"
              className="font-semibold text-byui-blue hover:underline"
            >
              Create account →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
