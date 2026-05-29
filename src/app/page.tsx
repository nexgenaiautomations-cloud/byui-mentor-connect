import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-navy-50 via-white to-white">
      <nav className="flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl font-black tracking-tight text-navy-700">BYUI CAN</span>
          <span className="text-sm font-medium text-slate-500">Mentor Connect</span>
        </div>
        <Link href="/login" className="btn-outline">
          Sign in
        </Link>
      </nav>

      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-16 text-center md:pt-24">
        <span className="pill mb-6">A peer mentorship platform for BYU-Idaho students</span>
        <h1 className="font-display text-5xl font-black tracking-tight text-navy-900 md:text-7xl">
          Find your mentor.
          <br />
          <span className="text-navy-500">Skip the luck.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-slate-600 md:text-xl">
          Sign up as a member, browse upperclassmen in your major, and request a mentor in
          minutes. Anyone can apply to mentor — give back, build your portfolio, help someone
          who&apos;s right where you were.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="btn-primary">
            Get started with BYU-I email
          </Link>
          <Link href="#how-it-works" className="btn-outline">
            How it works
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Only @byui.edu addresses can sign up. No password required.
        </p>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-6 pb-32">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "1. Register as a member",
              body: "Anyone with a @byui.edu email can join. Tell us your major, expected graduation, and career interests.",
            },
            {
              title: "2. Browse and request",
              body: "Filter mentors by major, semester level, and career interest. Send a request — they accept or decline.",
            },
            {
              title: "3. Meet and grow",
              body: "When accepted, contact info unlocks. Log meetings and answer a short monthly check-in.",
            },
          ].map((step) => (
            <div key={step.title} className="card">
              <h3 className="font-display text-lg font-bold text-navy-800">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-2xl border border-navy-100 bg-navy-50/60 p-8 text-center">
          <h3 className="font-display text-2xl font-bold text-navy-800">Want to mentor?</h3>
          <p className="mx-auto mt-2 max-w-2xl text-slate-600">
            Every member can apply. After a quick admin review, you&apos;ll appear in the mentor
            directory with your topics and availability.
          </p>
          <Link href="/login" className="btn-primary mt-6">
            Sign in to apply
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        BYU-Idaho Career Action Network · Student-built peer mentorship
      </footer>
    </main>
  );
}
