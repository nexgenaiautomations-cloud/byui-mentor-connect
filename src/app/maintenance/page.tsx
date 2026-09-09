import type { Metadata } from "next";

// Branding-approval gate page: intentionally text-only. No shield, crest,
// handshake, or campus imagery may appear here until BYU-Idaho approves the
// branding (specs/maintenance-mode.md). Colors and fonts are the app's own.

export const metadata: Metadata = {
  title: "BYUI CAN — Down for maintenance",
  description:
    "BYUI CAN Mentor Connect is temporarily unavailable while we work behind the scenes.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-byui-blue-dark px-6 py-16">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-byui-blue-dark via-byui-blue-dark to-byui-blue/80"
      />

      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lift md:p-12">
        <span
          aria-hidden
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-byui-blue text-white shadow-soft"
        >
          {/* Lucide "wrench" */}
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </span>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-byui-blue">
          Scheduled maintenance
        </p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight text-byui-blue-dark md:text-4xl">
          BYUI CAN is temporarily down for maintenance
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Sorry for the inconvenience — we&rsquo;re doing some behind-the-scenes
          work on Mentor Connect. The site should be back up soon, so please
          check back shortly.
        </p>

        <p className="mt-6 text-sm leading-6 text-slate-600">
          Need to reach us in the meantime?{" "}
          <a
            href="mailto:GabrielD@nexgenaiintegrations.com"
            className="cursor-pointer font-semibold text-byui-blue underline decoration-byui-blue-light underline-offset-2 transition-colors hover:text-byui-blue-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-byui-blue"
          >
            Email the team
          </a>
        </p>

        <p className="mt-8 text-xs font-medium text-slate-500">
          Thank you for your patience — the BYUI CAN team
        </p>
      </div>
    </main>
  );
}
