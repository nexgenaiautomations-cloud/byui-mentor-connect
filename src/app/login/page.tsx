import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "../../../auth";
import { DemoButtons } from "./demo-buttons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
  const { error, next } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-navy-50 via-white to-white px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-3">
          <span className="font-display text-xl font-black tracking-tight text-navy-700">BYUI CAN</span>
          <span className="text-sm font-medium text-slate-500">Mentor Connect</span>
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
              await signIn("nodemailer", {
                email,
                redirectTo: next || "/dashboard",
              });
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
    </main>
  );
}
