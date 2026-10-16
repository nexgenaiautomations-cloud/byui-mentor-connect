import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { FullCrest, Shield } from "@/components/logo";
import { IndependenceNotice } from "@/components/independence-notice";
import { EMPLOYEE_NOTICE, STUDENT_NOTICE } from "@/lib/disclaimers";
import { InstallButton } from "@/components/install-button";

const FEATURED_STATS = [
  {
    headline: "85%",
    title: "of jobs are filled through networking",
    body: "The biggest career advantage isn't the resume — it's the relationships.",
    tag: "Networking",
  },
  {
    headline: "96%",
    title: "job placement in peer-led, mentored career tracks",
    body: "When students have an upperclassman guiding them, outcomes change.",
    tag: "Peer mentorship",
  },
  {
    headline: "700%",
    title: "more juniors engaging in meaningful professional relationships",
    body: "Structured peer mentorship multiplies real-world connections.",
    tag: "Peer mentorship",
  },
] as const;

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="relative min-h-screen bg-white text-slate-900">
      {/* ────────────────────────────── HERO ────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-students.jpg"
          alt="Students studying together around a long table"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-ink/95 via-brand/85 to-brand-magenta/80" />


        <nav className="relative flex items-center justify-between px-6 py-5 md:px-10">
          <Link href="/" aria-label="ICAN home" className="flex items-center gap-2 cursor-pointer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ican-handshake-white.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 select-none"
            />
            <span className="font-brand text-xl font-semibold tracking-[0.14em] text-white">ICAN</span>
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#why" className="text-sm font-semibold text-white/85 hover:text-white">
              Why ICAN
            </a>
            <a href="#standards" className="text-sm font-semibold text-white/85 hover:text-white">
              Standards
            </a>
            <a href="#what" className="text-sm font-semibold text-white/85 hover:text-white">
              Inspiration
            </a>
            <Link href="/schools" className="text-sm font-semibold text-white/85 hover:text-white">
              For schools
            </Link>
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

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-24 pt-16 md:grid-cols-[1.1fr_0.9fr] md:pb-32 md:pt-28">
          <div className="flex flex-col items-center text-center text-white md:items-start md:text-left">
            <Shield size={240} className="h-auto w-48 drop-shadow-2xl md:w-60" />
            <h1 className="mt-6 font-brand text-6xl font-semibold leading-[1.05] tracking-[0.12em] md:text-8xl">
              ICAN
              <span className="mt-3 block font-brand text-sm font-medium uppercase tracking-[0.28em] text-brand-light md:text-base">
                Career Advancement Network
              </span>
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium text-white md:text-xl">
              Choose a mentor. Build your network. Launch your career. I can — and
              so can you.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-bold text-brand-dark shadow-lift transition-colors duration-200 hover:bg-plum-50 active:scale-[0.98] cursor-pointer"
              >
                Get started →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/50 bg-white/15 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/25 cursor-pointer"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-xs font-medium text-white/85">
              Free and optional. Sign up with your school email.
            </p>
          </div>

          <div className="relative">
            <div className="rounded-3xl bg-white p-6 shadow-lift">
              <p className="text-xs font-bold uppercase tracking-wider text-brand">Welcome to</p>
              <p className="mt-1 font-display text-2xl font-black text-brand-dark">ICAN Mentor Connect</p>
              <p className="mt-2 text-sm text-slate-600">Three quick steps to your first mentor match.</p>
              <ul className="mt-5 space-y-3">
                {[
                  {
                    title: "Register as a member",
                    body: "Major, expected graduation, career interests.",
                  },
                  {
                    title: "Browse and request",
                    body: "Search for mentors that align with your career.",
                  },
                  {
                    title: "Network and grow",
                    body: "Turn goals into results alongside your mentor.",
                  },
                ].map((s) => (
                  <li
                    key={s.title}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12.5 10 17.5 19 7.5" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-brand-dark">{s.title}</p>
                      <p className="text-xs text-slate-600">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────────────── WHY ICAN ───────────────────────── */}
      <section id="why" className="relative bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <header className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Why ICAN
            </p>
            <h2 className="mt-2 font-display text-3xl font-black text-brand-dark md:text-4xl">
              Why Peer-to-Peer Career Mentoring Matters
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              The biggest career advantage isn't the resume — it's the relationships behind it.
              ICAN makes those relationships intentional.
            </p>
          </header>

          <div className="mt-12 grid items-stretch gap-8 lg:grid-cols-[1.05fr_1fr]">
            {/* Mentoring image */}
            <div className="relative overflow-hidden rounded-3xl shadow-lift ring-1 ring-brand-light/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/students-mentoring.jpg"
                alt="Two students at a laptop talking through career plans"
                className="h-full min-h-[360px] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-dark/95 via-brand-dark/40 to-transparent p-6">
                <p className="font-display text-lg font-bold text-white">
                  Students helping students.
                </p>
                <p className="mt-1 text-sm text-white/90">
                  Peer mentorship turns a four-year degree into a four-year network.
                </p>
              </div>
            </div>

            {/* Stat cards */}
            <ul className="grid gap-4">
              {FEATURED_STATS.map((s) => (
                <li
                  key={s.headline}
                  className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/50 transition hover:ring-brand"
                >
                  <div className="flex items-baseline gap-3">
                    <p className="font-display text-4xl font-black leading-none text-brand md:text-5xl">
                      {s.headline}
                    </p>
                    <span className="rounded-full bg-brand-light/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                      {s.tag}
                    </span>
                  </div>
                  <p className="mt-2 font-display text-base font-bold text-brand-dark">
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{s.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-slate-600">
            At major universities, career peer mentoring achieved results like a 96% job
            placement rate and a 700% increase in meaningful professional relationships.
            ICAN brings that same student-to-student model to you.
          </p>
        </div>
      </section>

      {/* ───────────────────── THE ICAN STANDARDS ─────────────────── */}
      <section id="standards" className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <header className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              The Standards
            </p>
            <h2 className="mt-2 font-display text-3xl font-black text-brand-dark md:text-4xl">
              The ICAN Standards
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              One Career Task each week, two industry experiences before senior year, three Career
              Chats every month. Mentor Connect is the digital backbone for these standards.
            </p>
          </header>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                n: 1,
                title: "Career Task — weekly",
                body: "One focused action every week: resume edit, alumni outreach, internship app, mock interview.",
              },
              {
                n: 2,
                title: "Industry Experiences — before senior year",
                body: "Two real-world experiences (internships, shadowing, projects) before senior year so the resume tells a story.",
              },
              {
                n: 3,
                title: "Career Chats — monthly",
                body: "Three Career Chats a month with mentors, alumni, or peers. Networking that compounds.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/40"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-2xl font-black text-white shadow-soft">
                  {s.n}
                </span>
                <p className="mt-4 font-display text-lg font-bold text-brand-dark">{s.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── INSPIRATION ────────────────────────── */}
      <section id="what" className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <header className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Words worth keeping
            </p>
            <h2 className="mt-2 font-display text-3xl font-black text-brand-dark md:text-4xl">
              ICAN will grow your career
            </h2>
          </header>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              // Public-domain quotes with verifiable primary sources.
              {
                name: "Isaac Newton",
                source: "Letter to Robert Hooke, 1675",
                quote: "If I have seen further it is by standing on the shoulders of Giants.",
              },
              {
                name: "Seneca",
                source: "Letters to Lucilius, VII",
                quote: "Men learn while they teach.",
              },
              {
                name: "Theodore Roosevelt",
                source: "Labor Day address, 1903",
                quote:
                  "Far and away the best prize that life offers is the chance to work hard at work worth doing.",
              },
            ].map((c) => (
              <figure
                key={c.name}
                className="flex flex-col justify-between rounded-2xl bg-white p-6 shadow-soft ring-1 ring-slate-100"
              >
                <blockquote className="font-display text-lg font-semibold leading-7 text-brand-dark">
                  &ldquo;{c.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm text-slate-600">
                  <span className="font-semibold text-brand">{c.name}</span>
                  <span className="block text-xs text-slate-500">{c.source}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── CTA BAND ─────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-brand-ink px-6 py-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/library.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-ink via-brand-dark/90 to-brand-magenta/70" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h3 className="font-display text-3xl font-black text-white md:text-4xl">
            Built by students. For students.
          </h3>
          <p className="mt-3 text-base text-white/90">
            ICAN Mentor Connect is the digital backbone for the Career Advancement Network —
            peer mentorship that scales.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-bold text-brand-dark shadow-lift transition-colors duration-200 hover:bg-plum-50 cursor-pointer"
            >
              Create an account →
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/50 bg-white/15 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/25 cursor-pointer"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────── CLOSING CREST ──────────────────────── */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <FullCrest size={260} />
          <p className="mt-6 max-w-xl text-sm leading-6 text-slate-600">
            ICAN is the career rhythm: one Career Task weekly, two industry experiences
            before senior year, three Career Chats every month.
          </p>
        </div>
      </section>

      {/* ───────────────────────── NOTICES ───────────────────────── */}
      <section aria-labelledby="notices-heading" className="bg-plum-50 px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 id="notices-heading" className="sr-only">
            Important notices
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/50">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">For students</p>
              <p className="mt-2 font-display text-lg font-bold text-brand-dark">Optional, always.</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{STUDENT_NOTICE}</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/50">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">For faculty &amp; staff</p>
              <p className="mt-2 font-display text-lg font-bold text-brand-dark">Not a course requirement.</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{EMPLOYEE_NOTICE}</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-6 py-8 text-center">
        <p className="text-xs font-medium text-slate-600">
          ICAN (Career Advancement Network) — Student-built peer mentorship
          {" · "}
          <Link
            href="/schools"
            className="font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer"
          >
            For schools
          </Link>
          {" · "}
          <Link
            href="/terms"
            className="font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer"
          >
            Terms
          </Link>
          {" · "}
          <Link
            href="/privacy"
            className="font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer"
          >
            Privacy
          </Link>
          {" · "}
          <Link
            href="/accessibility"
            className="font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer"
          >
            Accessibility
          </Link>
        </p>
        <IndependenceNotice className="mx-auto mt-3 max-w-2xl" />
      </footer>
    </main>
  );
}
