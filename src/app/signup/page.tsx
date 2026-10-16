import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { Logo } from "@/components/logo";
import { IndependenceNotice } from "@/components/independence-notice";
import { SignupForm } from "./signup-form";

const AUTH_PHOTO = "/hero-students.jpg";

export default async function SignupPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AUTH_PHOTO}
          alt="Students studying together around a long table"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-ink/95 via-brand/80 to-brand-magenta/80" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={44} />
            <div className="leading-tight">
              <p className="font-display text-sm font-black tracking-tight">ICAN</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Mentor Connect
              </p>
            </div>
          </Link>
          <div>
            <p className="font-display text-3xl font-black leading-tight">
              Start your
              <br />
              <span className="text-brand-light">career action plan.</span>
            </p>
            <p className="mt-4 max-w-md text-sm text-white/80">
              Find a mentor, log weekly progress, and earn trophies for keeping the
              ICAN standard.
            </p>
          </div>
          <div>
            <IndependenceNotice tone="dark" className="max-w-md" />
            <p className="mt-3 text-[11px] text-white/60">© ICAN Career Advancement Network</p>
          </div>
        </div>
      </aside>

      <div className="grid place-items-center bg-[#F8F6FC] px-6 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-6 flex items-center justify-center gap-3 lg:hidden"
          >
            <Logo size={36} tile />
            <span className="font-display text-base font-black tracking-tight text-plum-800">
              ICAN
            </span>
          </Link>
          <div className="card">
            <h1 className="font-display text-2xl font-bold text-plum-800">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Takes about a minute. We&apos;ll ask you about your goals on the
              next screen.
            </p>

            <div className="mt-5">
              <SignupForm />
            </div>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-brand hover:underline"
              >
                Sign in →
              </Link>
            </p>
          </div>
          <IndependenceNotice className="mt-4 text-center lg:hidden" />
        </div>
      </div>
    </main>
  );
}
