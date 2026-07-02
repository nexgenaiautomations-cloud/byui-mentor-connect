import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy Notice — BYUI CAN Mentor Connect",
  description:
    "What BYUI CAN Mentor Connect collects, why, who processes it, how long it is kept, and the choices you have.",
};

// Public end-user privacy notice (linked from HECVAT PRGN-05/DRPV-02 and the
// site footer). Facts mirror docs/SECURITY-OVERVIEW.md §11 and
// docs/security/retention-policy.md — keep all three in sync.
const SECTIONS = [
  {
    heading: "What we collect, and why",
    body: (
      <>
        <p className="text-[15px] leading-relaxed text-slate-600">
          We collect only what the mentoring program needs to run: your name,
          your <strong className="text-slate-800">@byui.edu</strong> email, an
          optional phone number and profile photo, your major/minor and career
          interests, your mentor–mentee relationships, and the activity and
          meeting notes recorded in the app. Security telemetry (sign-in
          events, admin actions) is kept in an audit log; IP addresses in that
          log are one-way hashed and never stored raw.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          Everything is used for one purpose: operating the CAN mentoring
          program — matching, activity tracking, program administration, and
          keeping accounts secure. Nothing is used for advertising, sold, or
          shared with data brokers.
        </p>
      </>
    ),
  },
  {
    heading: "What we deliberately do not collect",
    body: (
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-600">
        <li>Social Security numbers, birth dates, or government IDs</li>
        <li>Payment or financial information (the app handles no money)</li>
        <li>Grades, transcripts, or FERPA-protected academic records</li>
        <li>Your Teams/email content or browsing history</li>
        <li>
          Plain-text passwords or tokens (only cryptographic hashes are ever
          stored)
        </li>
      </ul>
    ),
  },
  {
    heading: "Who processes your data",
    body: (
      <p className="text-[15px] leading-relaxed text-slate-600">
        The app runs on a small set of infrastructure providers that process
        data only as needed to host the service: Vercel (application hosting),
        Neon (database), Resend (transactional email), Upstash (abuse
        prevention, sees only hashed identifiers), and GitHub (source code —
        no student data). Each is reviewed for its security posture, and data
        stays in the United States.
      </p>
    ),
  },
  {
    heading: "How long we keep it",
    body: (
      <p className="text-[15px] leading-relaxed text-slate-600">
        Sign-in sessions last at most 14 days. Email verification links expire
        in 24 hours and password-reset links in 1 hour, and both are destroyed
        on use. Security audit records are kept 365 days, then archived under
        program control. Profile and mentoring records are kept for the life
        of your program participation and removed per the program&apos;s
        retention policy after extended inactivity.
      </p>
    ),
  },
  {
    heading: "Your choices and rights",
    body: (
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-600">
        <li>
          <strong className="text-slate-800">Access and correction:</strong>{" "}
          view and update your profile information anytime in the app&apos;s
          settings.
        </li>
        <li>
          <strong className="text-slate-800">Deletion:</strong> request full
          account deletion through the CAN head admin or the contact below;
          verified requests are completed and confirmed within 14 days.
          Anonymized security-audit history is retained as required for
          accountability.
        </li>
        <li>
          <strong className="text-slate-800">Consent:</strong> by creating an
          account you agree to this notice. If you don&apos;t agree, don&apos;t
          create an account — and an existing account can always be deleted on
          request.
        </li>
      </ul>
    ),
  },
  {
    heading: "Law enforcement and legal requests",
    body: (
      <p className="text-[15px] leading-relaxed text-slate-600">
        We do not share your data with law enforcement or other third parties
        except in response to valid legal process (a warrant, subpoena, or
        court order), and any such request is escalated to BYU-Idaho&apos;s
        institutional channels before a response is made.
      </p>
    ),
  },
  {
    heading: "Complaints and questions",
    body: (
      <p className="text-[15px] leading-relaxed text-slate-600">
        Privacy questions, complaints, or disputes go to the program owner at{" "}
        <a
          href="mailto:GabrielD@nexgenaiintegrations.com"
          className="font-semibold text-byui-blue underline decoration-byui-blue-light underline-offset-2 hover:text-byui-blue-dark cursor-pointer"
        >
          GabrielD@nexgenaiintegrations.com
        </a>{" "}
        and are acknowledged within 5 business days. Unresolved concerns can be
        escalated to CAN program leadership or BYU-Idaho IT Security. If this
        notice changes materially, the effective date below is updated and
        active users are informed in the app.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-byui-blue-light/30 via-white to-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-byui-blue">
              BYUI CAN Mentor Connect
            </p>
            <h1 className="font-display text-3xl font-black text-byui-blue-dark md:text-4xl">
              Privacy notice
            </h1>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {SECTIONS.map((s) => (
            <section
              key={s.heading}
              className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-byui-blue-light/40 md:p-8"
            >
              <h2 className="font-display text-xl font-bold text-byui-blue-dark">
                {s.heading}
              </h2>
              <div className="mt-3">{s.body}</div>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs font-medium text-slate-500">
            Effective July 1, 2026 · also see our{" "}
            <Link
              href="/accessibility"
              className="font-semibold text-byui-blue underline decoration-byui-blue-light underline-offset-2 hover:text-byui-blue-dark cursor-pointer"
            >
              accessibility statement
            </Link>
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-byui-blue px-4 py-2 text-sm font-bold text-white shadow-soft transition-colors duration-200 hover:bg-byui-blue-dark cursor-pointer"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
