import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

const CAMPUS_LOGIN = "/byui-campus.jpg";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
    email?: string;
    verify?: string;
    reset?: string;
  }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
  const { error, next, email, verify, reset } = await searchParams;

  // Verification result banner — landing here from /api/auth/verify-email.
  // Success unlocks signin; expired/invalid prompts the user to request a
  // fresh link via the existing resend flow.
  //
  // Reset banner: after a successful password reset we deliberately do NOT
  // auto-sign-in (a stolen reset link would otherwise be equivalent to a
  // stolen session). The user is bounced here with reset=ok so the banner
  // explains why they need to sign in.
  const verifyBanner: { tone: "success" | "error"; message: string } | undefined =
    reset === "ok"
      ? {
          tone: "success",
          message: "Password updated — sign in with your new password.",
        }
      : verify === "ok"
        ? {
            tone: "success",
            message: "Email verified — you can sign in now.",
          }
        : verify === "expired"
          ? {
              tone: "error",
              message:
                "That verification link expired. Sign in below to trigger a resend, or use the resend button.",
            }
          : verify === "invalid"
            ? {
                tone: "error",
                message:
                  "That verification link isn't valid. Try signing in to get a fresh one.",
              }
            : undefined;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* Campus photo column — visible on lg+ */}
      <aside className="relative hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CAMPUS_LOGIN}
          alt="BYU-Idaho campus"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900/85 via-navy-800/70 to-navy-900/90" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={44} />
            <div className="leading-tight">
              <p className="font-display text-sm font-black tracking-tight">BYUI CAN</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Mentor Connect
              </p>
            </div>
          </Link>
          <div>
            <p className="font-display text-3xl font-black leading-tight">
              Find your mentor.
              <br />
              <span className="text-sky-200">Skip the luck.</span>
            </p>
            <p className="mt-4 max-w-md text-sm text-white/80">
              Peer mentorship that actually scales — built for BYU-Idaho students by BYU-Idaho students.
            </p>
          </div>
          <p className="text-[11px] text-white/50">© BYU-Idaho Career Advancement Network</p>
        </div>
      </aside>

      <div className="grid place-items-center bg-[#F7F8FB] px-6 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <Logo size={36} />
            <span className="font-display text-base font-black tracking-tight text-navy-800">BYUI CAN</span>
          </Link>
          <div className="card">
            <h1 className="font-display text-2xl font-bold text-navy-800">Sign in</h1>
            <p className="mt-1 text-sm text-slate-600">
              Welcome back. Use your password or get a magic link.
            </p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error === "AccessDenied"
                  ? "Only @byui.edu addresses are allowed."
                  : error === "RateLimited"
                    ? "Too many sign-in attempts. Please wait an hour and try again."
                    : error === "CredentialsSignin"
                      ? "That email and password don't match."
                      : "Sign-in failed. Please try again."}
              </div>
            )}

            <div className="mt-5">
              <LoginForm
                initialEmail={email ?? ""}
                next={next}
                initialBanner={verifyBanner}
              />
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              By signing in you agree to receive a one-time login link by email when you request one.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
