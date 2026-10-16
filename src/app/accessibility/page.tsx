import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Accessibility — ICAN",
  description:
    "Accessibility statement for ICAN: our conformance target, known limitations, and how to report barriers.",
};

// Public accessibility statement (linked from HECVAT ITAC-05 and the site
// footer). Content mirrors docs/accessibility/ — keep the two in sync when
// the roadmap or reporting process changes.
export default function AccessibilityPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-light/30 via-white to-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
        <div className="flex items-center gap-3">
          <Logo size={40} tile />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
              ICAN
            </p>
            <h1 className="font-display text-3xl font-black text-brand-dark md:text-4xl">
              Accessibility statement
            </h1>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/40 md:p-8">
            <h2 className="font-display text-xl font-bold text-brand-dark">
              Our commitment
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              ICAN is built for every student who uses it. We
              have adopted the{" "}
              <a
                href="https://www.w3.org/TR/WCAG21/"
                className="font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer"
              >
                Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
              </a>{" "}
              as our conformance target, and accessibility barriers that block
              a core task — signing in, browsing mentors, requesting a mentor,
              or logging activity — are treated as defects and prioritized
              ahead of feature work.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/40 md:p-8">
            <h2 className="font-display text-xl font-bold text-brand-dark">
              Where we are today
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              The application is built with accessibility-conscious defaults:
              semantic HTML, labeled form controls, visible focus states,
              color-contrast targets of at least 4.5:1, and responsive layouts
              tested at phone, tablet, and desktop widths. A formal WCAG 2.1 AA
              audit has <strong className="text-slate-800">not yet</strong>{" "}
              been completed. Our published remediation roadmap includes
              automated accessibility checks in our test suite, a keyboard-only
              audit, a screen-reader pass, and a draft conformance report
              (VPAT/ACR) by the end of 2026.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/40 md:p-8">
            <h2 className="font-display text-xl font-bold text-brand-dark">
              Known limitations
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-600">
              <li>
                Keyboard-only operation has not yet been verified across every
                administrative screen (member-facing flows are the current
                priority).
              </li>
              <li>
                Some data-dense admin tables may be difficult to navigate with
                a screen reader until the screen-reader pass on our roadmap is
                complete.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/40 md:p-8">
            <h2 className="font-display text-xl font-bold text-brand-dark">
              Report an accessibility barrier
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
              If anything on this site is difficult or impossible for you to
              use, please tell us — reports go straight to the program team and
              are acknowledged within five business days.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-600">
              <li>
                Use the <strong className="text-slate-800">“Report an issue”</strong>{" "}
                button in the app sidebar (available on every page after
                sign-in), or
              </li>
              <li>
                Email the program owner:{" "}
                <a
                  href="mailto:GabrielD@nexgenaiintegrations.com"
                  className="font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer"
                >
                  GabrielD@nexgenaiintegrations.com
                </a>
                . If the barrier prevents you from using either channel, any
                ICAN program staff member can file the report for you.
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs font-medium text-slate-500">
            Statement adopted July 1, 2026 · reviewed with each roadmap update
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-soft transition-colors duration-200 hover:bg-brand-dark cursor-pointer"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
