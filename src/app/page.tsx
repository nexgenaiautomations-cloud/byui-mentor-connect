import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { FullCrest } from "@/components/logo";
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
      <section className="relative isolate overflow-hidden bg-byui-blue-dark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/byui-campus.jpg"
          alt="BYU-Idaho campus"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-byui-blue-dark/95 via-byui-blue-dark/85 to-byui-blue/70" />

        <nav className="relative flex items-center justify-between px-6 py-5 md:px-10">
          <Link href="/" aria-label="BYUI CAN home" className="flex items-center gap-2 cursor-pointer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/byuican-handshake-white.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 select-none"
            />
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#why" className="text-sm font-semibold text-white/85 hover:text-white">
              Why BYUI CAN
            </a>
            <a href="#standards" className="text-sm font-semibold text-white/85 hover:text-white">
              Standards
            </a>
            <a href="#what" className="text-sm font-semibold text-white/85 hover:text-white">
              Prophets&rsquo; &ldquo;Why&rdquo;
            </a>
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/byuican-shield.png"
              alt="BYUI CAN Career Advancement Network shield"
              width={260}
              height={260}
              className="h-52 w-52 select-none md:h-64 md:w-64"
            />
            <h1 className="mt-6 font-display text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
              BYUI CAN
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium text-white md:text-xl">
              Choose a mentor. Build your network. Launch your Career. You CAN with
              {" "}
              <span className="whitespace-nowrap">&ldquo;BYUI CAN&rdquo;</span>
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-bold text-byui-blue-dark shadow-lift hover:bg-byui-blue-light/30 active:scale-[0.98] cursor-pointer"
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
            <p className="mt-4 text-xs font-medium text-white/80">Only @byui.edu addresses can register.</p>
          </div>

          <div className="relative">
            <div className="rounded-3xl bg-white p-6 shadow-lift">
              <p className="text-xs font-bold uppercase tracking-wider text-byui-gray">Welcome to</p>
              <p className="mt-1 font-display text-2xl font-black text-byui-blue-dark">BYUI CAN Mentor Connect</p>
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
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-byui-blue text-white"
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
                      <p className="text-sm font-bold text-byui-blue-dark">{s.title}</p>
                      <p className="text-xs text-slate-600">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── WHY BYUI CAN ──────────────────────── */}
      <section id="why" className="relative bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <header className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-byui-blue">
              Why BYUI CAN
            </p>
            <h2 className="mt-2 font-display text-3xl font-black text-byui-blue-dark md:text-4xl">
              Why Peer-to-Peer Career Mentoring Matters
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
              The biggest career advantage isn't the resume — it's the relationships behind it.
              BYUI CAN makes those relationships intentional.
            </p>
          </header>

          <div className="mt-12 grid items-stretch gap-8 lg:grid-cols-[1.05fr_1fr]">
            {/* Mentoring image */}
            <div className="relative overflow-hidden rounded-3xl shadow-lift ring-1 ring-byui-blue-light/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/students-mentoring.png"
                alt="Two BYU-Idaho students sitting at a study table talking through career and coursework"
                className="h-full min-h-[360px] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-byui-blue-dark/95 via-byui-blue-dark/40 to-transparent p-6">
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
                  className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-byui-blue-light/50 transition hover:ring-byui-blue"
                >
                  <div className="flex items-baseline gap-3">
                    <p className="font-display text-4xl font-black leading-none text-byui-blue md:text-5xl">
                      {s.headline}
                    </p>
                    <span className="rounded-full bg-byui-blue-light/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-byui-blue-dark">
                      {s.tag}
                    </span>
                  </div>
                  <p className="mt-2 font-display text-base font-bold text-byui-blue-dark">
                    {s.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{s.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-byui-gray">
            At major universities, career peer mentoring achieved results like a 96% job
            placement rate and a 700% increase in meaningful professional relationships.
            BYUI CAN brings the same model to BYU-Idaho.
          </p>
        </div>
      </section>

      {/* ───────────────────── THE BYUI CAN STANDARDS ─────────────────── */}
      <section id="standards" className="bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <header className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-byui-blue">
              The Standards
            </p>
            <h2 className="mt-2 font-display text-3xl font-black text-byui-blue-dark md:text-4xl">
              The BYUI CAN Standards
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
                className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-byui-blue-light/40"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-byui-blue text-2xl font-black text-white shadow-soft">
                  {s.n}
                </span>
                <p className="mt-4 font-display text-lg font-bold text-byui-blue-dark">{s.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────── PROPHETS' "WHY" ──────────────────────── */}
      <section id="what" className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <header className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-byui-blue">
              Prophets&rsquo; &ldquo;Why&rdquo;
            </p>
            <h2 className="mt-2 font-display text-3xl font-black text-byui-blue-dark md:text-4xl">
              BYUI CAN will grow your career
            </h2>
          </header>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                name: "President Dallin H. Oaks",
                quote:
                  "Do not limit yourself to a grudging compliance with minimum requirements of attendance, assignments, and degrees.",
              },
              {
                name: "President Henry B. Eyring",
                quote:
                  "All people are happier and feel more self-respect when they can provide for themselves and their family and then reach out to take care of others.",
              },
              {
                name: "Elder David A. Bednar",
                quote:
                  "As learners, you and I are to act and be doers of the word and not simply hearers who are only acted upon. Are you and I agents who act... or are we waiting to be taught?",
              },
            ].map((c) => (
              <figure
                key={c.name}
                className="flex flex-col rounded-2xl bg-white p-6 shadow-soft ring-1 ring-slate-100"
              >
                <figcaption className="font-display text-lg font-bold text-byui-blue">
                  {c.name}
                </figcaption>
                <blockquote className="mt-3 text-sm leading-6 text-slate-700">
                  &ldquo;{c.quote}&rdquo;
                </blockquote>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────── CTA BAND ─────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-byui-blue-dark px-6 py-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/campus-library.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-byui-blue-dark via-byui-blue-dark/90 to-byui-blue/70" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h3 className="font-display text-3xl font-black text-white md:text-4xl">
            Built by students. For students.
          </h3>
          <p className="mt-3 text-base text-white/90">
            BYUI CAN Mentor Connect is the digital backbone for the Career Advancement Network —
            peer mentorship that scales.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-bold text-byui-blue-dark shadow-lift hover:bg-byui-blue-light/30 cursor-pointer"
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
            BYUI CAN is the career rhythm: one Career Task weekly, two industry experiences
            before senior year, three Career Chats every month.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs font-medium text-byui-gray">
        BYUI CAN (Career Advancement Network) — Student-built peer mentorship
        {" · "}
        <Link
          href="/accessibility"
          className="font-semibold text-byui-blue underline decoration-byui-blue-light underline-offset-2 hover:text-byui-blue-dark cursor-pointer"
        >
          Accessibility
        </Link>
      </footer>
    </main>
  );
}
