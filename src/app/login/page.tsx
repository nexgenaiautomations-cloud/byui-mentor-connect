import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "../../../auth";
import { DemoButtons } from "./demo-buttons";
import { Logo } from "@/components/logo";

const CAMPUS_LOGIN = "/byui-campus.jpg";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
  const { error, next } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* Campus photo column — visible on lg+ */}
      <aside className="relative hidden lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CAMPUS_LOGIN} alt="BYU-Idaho campus" className="absolute inset-0 h-full w-full object-cover" />
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
            Enter your BYU-I email and we&apos;ll send you a magic link.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error === "AccessDenied"
                ? "Only @byui.edu addresses are allowed."
                : "Sign-in failed. Please try again."}
            </div>
          )}

          <form
            action={async (formData) => {
              "use server";
              const email = String(formData.get("email") || "").trim().toLowerCase();
              if (!email.endsWith("@byui.edu")) {
                redirect("/login?error=AccessDenied");
              }
              // Only accept relative same-origin paths in `next` to prevent
              // open-redirects (e.g. /login?next=https://evil.com).
              const safe =
                next && next.startsWith("/") && !next.startsWith("//")
                  ? next
                  : "/dashboard";
              await signIn("resend", { email, redirectTo: safe });
            }}
            className="mt-5 space-y-4"
          >
            <div>
              <label htmlFor="email" className="label">BYU-I email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="yourname@byui.edu"
                className="input"
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Send magic link
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            By signing in you agree to receive a one-time login link by email.
          </p>

          {process.env.DEMO_ENABLED === "true" && <DemoButtons />}
          </div>
        </div>
      </div>
    </main>
  );
}
