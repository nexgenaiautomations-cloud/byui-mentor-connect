import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { Logo } from "@/components/logo";
import { CAN_CADENCE } from "@/lib/possible-actions";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="relative min-h-screen bg-[#F4E9D8]">
      <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-[#F4E9D8] via-[#F4E9D8]/90 to-transparent" />

      <nav className="relative flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <Logo size={48} />
          <div className="leading-tight">
            <p className="font-display text-sm font-black tracking-tight text-navy-800">BYUI CAN</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-700/70">
              Mentor Connect
            </p>
          </div>
        </div>
        <Link href="/login" className="btn-outline">
          Sign in
        </Link>
      </nav>

      <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-12 md:grid-cols-[1.05fr_0.95fr] md:pt-16">
        <div>
          <span className="inline-flex items-center rounded-full border border-navy-200/70 bg-white/60 px-3 py-1 text-xs font-semibold text-navy-700 backdrop-blur">
            BYUI Career Advancement Network · Peer mentorship
          </span>
          <h1 className="mt-6 font-display text-5xl font-black leading-[1.05] tracking-tight text-navy-900 md:text-6xl">
            Mentor Connect.<br />
            <span className="text-navy-700">For every BYU·I student.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-navy-900/80">
            Find your mentor. Skip the luck. Sign up as a member, browse upperclassmen
            in your major, and request a mentor in minutes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary text-base">
              Get Started
            </Link>
            <Link href="#how" className="btn-outline text-base">
              How it works
            </Link>
          </div>
          <p className="mt-4 text-xs text-navy-900/60">Only @byui.edu addresses can register.</p>
        </div>

        <div className="relative">
          <div className="rounded-3xl bg-white p-6 shadow-lift ring-1 ring-navy-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Welcome to</p>
            <p className="mt-1 font-display text-2xl font-black text-navy-800">BYU·I Mentor Connect</p>
            <p className="mt-2 text-sm text-slate-600">Three quick steps to your first mentor match.</p>
            <ul className="mt-6 space-y-3">
              {[
                { n: 1, title: "Register as a member", body: "Major, expected graduation, career interests." },
                { n: 2, title: "Browse and request", body: "Filter by major, semester, and career interest." },
                { n: 3, title: "Meet and grow", body: "Contact unlocks on accept. Log meetings, monthly check-in." },
              ].map((s) => (
                <li key={s.n} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-700 text-xs font-black text-white">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy-800">{s.title}</p>
                    <p className="text-xs text-slate-500">{s.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-navy-700 px-4 py-3 text-sm text-white">
              <p className="font-semibold">Want to mentor?</p>
              <p className="mt-0.5 text-white/80 text-xs">
                Every member can apply. Admin approves in days, not weeks.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="relative mx-auto max-w-6xl px-6 pb-12">
        <h2 className="font-display text-2xl font-black text-navy-800">The BYUI CAN rhythm</h2>
        <p className="mt-1 text-sm text-slate-600">Three commitments that build a career-ready habit.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {CAN_CADENCE.map((c) => (
            <div key={c.n} className="rounded-2xl bg-navy-700 p-6 text-white shadow-soft">
              <p className="font-display text-5xl font-black text-white/90">{c.n}</p>
              <p className="mt-3 font-display text-lg font-bold">{c.label}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-sky-200">{c.cadence}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display text-2xl font-black text-navy-800">What you get</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Pick the right person",
              body: "Filter mentors by major, semester level, and career interest.",
            },
            {
              title: "Track every step",
              body: "Pending, under review, accepted, declined — always know where each request stands.",
            },
            {
              title: "Stay accountable",
              body: "Mentors log meetings, both sides answer a short monthly check-in. Admin sees aggregate progress.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl bg-white/80 p-5 shadow-soft ring-1 ring-navy-100/60 backdrop-blur">
              <p className="font-display text-base font-bold text-navy-800">{c.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-navy-200/40 bg-[#F4E9D8] py-8 text-center text-xs text-navy-700/70">
        BYU-Idaho Career Action Network · Student-built peer mentorship
      </footer>
    </main>
  );
}
