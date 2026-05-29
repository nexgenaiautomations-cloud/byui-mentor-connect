import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { Logo } from "@/components/logo";
import { CAN_CADENCE } from "@/lib/possible-actions";
import { InstallButton } from "@/components/install-button";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="relative min-h-screen bg-white text-navy-900">
      {/* HERO with full-bleed campus image */}
      <section className="relative isolate min-h-[640px] overflow-hidden bg-navy-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/byui-campus.jpg"
          alt="BYU-Idaho campus"
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-900/85 via-navy-800/70 to-navy-900/95" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_20%_30%,rgba(135,180,225,0.18),transparent_60%)]" />

        <nav className="relative flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div className="leading-tight">
              <p className="font-display text-sm font-black tracking-tight text-white">BYUI CAN</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Mentor Connect
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InstallButton label="Install" />
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 cursor-pointer"
            >
              Sign in
            </Link>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-8 md:grid-cols-[1.1fr_0.9fr] md:pb-32 md:pt-16">
          <div className="text-white">
            <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
              BYUI Career Advancement Network · Peer mentorship
            </span>
            <h1 className="mt-6 font-display text-5xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Mentor Connect.
              <br />
              <span className="text-sky-200">For every BYU·I student.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-white/85">
              Find your mentor. Skip the luck. Sign up as a member, browse upperclassmen
              in your major, and request a mentor in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-base font-semibold text-navy-800 shadow-lift hover:bg-sky-50 active:scale-[0.98] cursor-pointer"
              >
                Get Started
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/20 cursor-pointer"
              >
                How it works
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/60">Only @byui.edu addresses can register.</p>
          </div>

          <div className="relative">
            <div className="rounded-3xl bg-white p-6 shadow-lift ring-1 ring-white/40">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Welcome to</p>
              <p className="mt-1 font-display text-2xl font-black text-navy-800">BYUI CAN Mentor Connect</p>
              <p className="mt-2 text-sm text-slate-600">Three quick steps to your first mentor match.</p>
              <ul className="mt-5 space-y-3">
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
              <div className="mt-5 rounded-xl bg-navy-700 px-4 py-3 text-sm text-white">
                <p className="font-semibold">Want to mentor?</p>
                <p className="mt-0.5 text-xs text-white/80">
                  Every member can apply. Admin approves in days, not weeks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CAN cadence band */}
      <section id="how" className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h2 className="font-display text-3xl font-black text-navy-800">The BYUI CAN rhythm</h2>
          <p className="mt-2 text-sm text-slate-600">Three commitments that build a career-ready habit.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {CAN_CADENCE.map((c) => (
            <div
              key={c.n}
              className="rounded-2xl bg-navy-700 p-6 text-white shadow-soft ring-1 ring-navy-600"
            >
              <p className="font-display text-5xl font-black text-white/90">{c.n}</p>
              <p className="mt-3 font-display text-lg font-bold">{c.label}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-sky-200">{c.cadence}</p>
            </div>
          ))}
        </div>
      </section>

      {/* "What you get" + campus side image */}
      <section className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="relative h-72 overflow-hidden rounded-3xl bg-navy-900 lg:h-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/byui-campus.jpg"
              alt="BYU-Idaho students"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-900/95 to-transparent p-6">
              <p className="font-display text-lg font-bold text-white">~500 students each semester.</p>
              <p className="mt-1 text-sm text-white/80">
                Peer mentorship lifts retention and career outcomes.
              </p>
            </div>
          </div>
          <div>
            <h2 className="font-display text-3xl font-black text-navy-800">What you get</h2>
            <div className="mt-6 space-y-4">
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
                <div key={c.title} className="rounded-2xl bg-slate-50 p-5 shadow-soft ring-1 ring-slate-100">
                  <p className="font-display text-base font-bold text-navy-800">{c.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Wide campus banner */}
      <section className="relative h-64 overflow-hidden bg-navy-900 md:h-80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/byui-campus.jpg"
          alt="BYU-Idaho campus"
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-900/95 via-navy-900/70 to-navy-900/40" />
        <div className="relative mx-auto flex h-full max-w-6xl items-center px-6">
          <div className="max-w-xl text-white">
            <h3 className="font-display text-3xl font-black md:text-4xl">
              Built by students.<br />For students.
            </h3>
            <p className="mt-3 text-sm text-white/80">
              BYUI CAN Mentor Connect is the digital backbone for the Career Advancement Network — peer
              mentorship that scales.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-navy-800 shadow-lift hover:bg-sky-50 cursor-pointer"
            >
              Sign in with your BYU-I email →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white py-8 text-center text-xs text-slate-500">
        BYU-Idaho Career Advancement Network · Student-built peer mentorship
      </footer>
    </main>
  );
}
