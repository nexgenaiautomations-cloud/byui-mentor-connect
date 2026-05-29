import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { Logo } from "@/components/logo";
import { InstallButton } from "@/components/install-button";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="relative min-h-screen bg-white text-navy-900">
      {/* HERO with campus image */}
      <section className="relative isolate overflow-hidden bg-navy-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/byui-campus.jpg"
          alt="BYU-Idaho campus"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy-900/95 via-navy-900/85 to-navy-900/75" />

        <nav className="relative flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <Logo size={44} />
            <div className="leading-tight">
              <p className="font-display text-sm font-black tracking-tight text-white">BYUI CAN</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-200">
                Mentor Connect
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InstallButton label="Install" />
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25 cursor-pointer"
            >
              Sign in
            </Link>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-10 md:grid-cols-[1.1fr_0.9fr] md:pb-32 md:pt-20">
          <div className="text-white">
            <span className="inline-flex items-center rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
              BYUI Career Advancement Network · Peer mentorship
            </span>
            <h1 className="mt-6 font-display text-5xl font-black leading-[1.05] tracking-tight md:text-6xl">
              Mentor Connect.
              <br />
              <span className="text-sky-200">For every BYU·I student.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium text-white">
              Find your mentor. Skip the luck. Sign up as a member, browse upperclassmen
              in your major, and request a mentor in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-bold text-navy-800 shadow-lift hover:bg-sky-50 active:scale-[0.98] cursor-pointer"
              >
                Get Started →
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/50 bg-white/15 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/25 cursor-pointer"
              >
                How it works
              </Link>
            </div>
            <p className="mt-4 text-xs font-medium text-white/80">Only @byui.edu addresses can register.</p>
          </div>

          <div className="relative">
            <div className="rounded-3xl bg-white p-6 shadow-lift">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Welcome to</p>
              <p className="mt-1 font-display text-2xl font-black text-navy-800">BYUI CAN Mentor Connect</p>
              <p className="mt-2 text-sm text-slate-600">Three quick steps to your first mentor match.</p>
              <ul className="mt-5 space-y-3">
                {[
                  { n: 1, title: "Register as a member", body: "Major, expected graduation, career interests." },
                  { n: 2, title: "Browse and request", body: "Filter by major, semester, and career interest." },
                  { n: 3, title: "Meet and grow", body: "Contact unlocks on accept. Log meetings, monthly check-in." },
                ].map((s) => (
                  <li key={s.n} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-700 text-xs font-black text-white">
                      {s.n}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-navy-800">{s.title}</p>
                      <p className="text-xs text-slate-600">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl bg-navy-700 px-4 py-3 text-sm text-white">
                <p className="font-bold">Want to mentor?</p>
                <p className="mt-0.5 text-xs text-white">
                  Every member can apply. Admin approves in days, not weeks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CAN crest band — the crest itself contains the 1-2-3 columns, so we
          let it speak for itself at hero size. No duplicate bubbles below. */}
      <section id="how" className="relative bg-white px-6 py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
          <Logo size={380} variant="large" />
          <h2 className="mt-8 font-display text-3xl font-black text-navy-800 md:text-4xl">
            The BYUI CAN rhythm
          </h2>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            One Career Task each week, two industry experiences before senior year, three Career
            Chats every month. Mentor Connect is the digital backbone for this rhythm.
          </p>
        </div>
      </section>

      {/* What you get — photo of a student on the side */}
      <section className="bg-slate-50 px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div className="relative h-80 overflow-hidden rounded-3xl bg-navy-900 lg:h-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/campus-students.jpg"
              alt="BYU-Idaho student"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-900/95 to-transparent p-6">
              <p className="font-display text-lg font-bold text-white">~500 students each semester.</p>
              <p className="mt-1 text-sm text-white/90">
                Peer mentorship lifts retention and career outcomes.
              </p>
            </div>
          </div>
          <div>
            <h2 className="font-display text-3xl font-black text-navy-800 md:text-4xl">What you get</h2>
            <div className="mt-6 space-y-4">
              {[
                {
                  title: "Pick the right person",
                  body: "Filter mentors by major, semester level, and career interest. See slots-left so you don't waste a request on someone at capacity.",
                },
                {
                  title: "Track every step",
                  body: "Pending, accepted, declined — always know where each request stands. Mentor contact unlocks the moment they accept.",
                },
                {
                  title: "Stay accountable",
                  body: "Mentors log every meeting. Both sides answer a short monthly check-in. Admins see aggregate progress.",
                },
              ].map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-slate-100"
                >
                  <p className="font-display text-lg font-bold text-navy-800">{c.title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA banner — classroom shot */}
      <section className="relative isolate overflow-hidden bg-navy-900 px-6 py-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/campus-library.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-900 via-navy-900/85 to-navy-900/60" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h3 className="font-display text-3xl font-black text-white md:text-4xl">
            Built by students. For students.
          </h3>
          <p className="mt-3 text-base text-white">
            BYUI CAN Mentor Connect is the digital backbone for the Career Advancement Network — peer mentorship that scales.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-bold text-navy-800 shadow-lift hover:bg-sky-50 cursor-pointer"
          >
            Sign in with your BYU-I email →
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs font-medium text-slate-500">
        BYU-Idaho Career Advancement Network · Student-built peer mentorship
      </footer>
    </main>
  );
}
