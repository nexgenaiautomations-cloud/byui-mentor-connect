import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { EMPLOYEE_NOTICE, STUDENT_NOTICE, THIRD_PARTY_NOTICE } from "@/lib/disclaimers";

export const metadata: Metadata = {
  title: "Terms of Use — ICAN Mentor Connect",
  description:
    "Terms of Use for ICAN Mentor Connect, an independent, student-run peer mentorship website that is not affiliated with BYU-Idaho.",
};

const P = "text-[15px] leading-relaxed text-slate-600";
const LI = "list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-600";
const LINK =
  "font-semibold text-brand underline decoration-brand-light underline-offset-2 hover:text-brand-dark cursor-pointer";

// Public Terms of Use. Agreement is captured at signup (checkbox) and the
// version is recorded on the USER_SIGNUP_CREATED audit event — bump
// TERMS_VERSION in src/lib/disclaimers.ts whenever this text changes
// materially.
const SECTIONS: { id: string; heading: string; body: React.ReactNode }[] = [
  {
    id: "independent",
    heading: "1. An independent, third-party website",
    body: (
      <>
        <p className={P}>{THIRD_PARTY_NOTICE}</p>
        <p className={`mt-3 ${P}`}>
          ICAN is not an official Brigham Young University–Idaho program, service,
          or website. BYU-Idaho&apos;s names, logos, and marks are not used here,
          and nothing on this site speaks for BYU-Idaho. Requiring a @byui.edu
          email address only confirms that members are students; it does not mean
          BYU-Idaho operates, reviews, or endorses ICAN.
        </p>
      </>
    ),
  },
  {
    id: "students",
    heading: "2. Using ICAN is optional",
    body: (
      <>
        <p className={P}>{STUDENT_NOTICE}</p>
        <ul className={`mt-3 ${LI}`}>
          <li>No class, instructor, department, or employer can require you to sign up.</li>
          <li>Using ICAN, or choosing not to, has no effect on your grades, credit, or standing.</li>
          <li>You can stop using ICAN and ask us to delete your account at any time.</li>
        </ul>
      </>
    ),
  },
  {
    id: "employees",
    heading: "3. Notice to BYU-Idaho faculty and employees",
    body: (
      <>
        <p className={P}>
          <strong className="text-slate-800">{EMPLOYEE_NOTICE}</strong>
        </p>
        <ul className={`mt-3 ${LI}`}>
          <li>Do not make ICAN an assignment, a course requirement, or a condition of any class activity.</li>
          <li>Do not award or deduct points, grades, credit, or extra credit based on ICAN use.</li>
          <li>Do not ask students to show their ICAN activity, logs, or trophies to you.</li>
          <li>
            You may mention ICAN as one optional resource among others, as long as
            students understand it is independent and voluntary.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "accounts",
    heading: "4. Your account",
    body: (
      <ul className={LI}>
        <li>You must be a current student with a @byui.edu email address to create an account.</li>
        <li>Keep your password private. You are responsible for activity on your account.</li>
        <li>Give accurate information about yourself. Don&apos;t impersonate anyone.</li>
      </ul>
    ),
  },
  {
    id: "mentoring",
    heading: "5. What mentoring on ICAN is — and isn't",
    body: (
      <>
        <p className={P}>
          Mentors on ICAN are fellow students sharing their own experience. They are
          not professional career counselors, academic advisors, or BYU-Idaho staff,
          and their advice is not official guidance from any school or employer.
          ICAN does not guarantee any internship, job, or other outcome.
        </p>
        <p className={`mt-3 ${P}`}>
          You decide whether, when, and where to meet a mentor or mentee. Meet in
          public places or online, use good judgment, and report anything that makes
          you uncomfortable through the in-app “Report an issue” button.
        </p>
      </>
    ),
  },
  {
    id: "conduct",
    heading: "6. Acceptable use",
    body: (
      <>
        <p className={P}>When you use ICAN, you agree not to:</p>
        <ul className={`mt-3 ${LI}`}>
          <li>harass, threaten, or discriminate against anyone;</li>
          <li>share another person&apos;s private information without their permission;</li>
          <li>sell, advertise, or recruit for anything unrelated to mentoring;</li>
          <li>post anything unlawful, misleading, or sexually explicit; or</li>
          <li>try to break, overload, or get around the security of the site.</li>
        </ul>
        <p className={`mt-3 ${P}`}>
          We may remove content or suspend accounts that break these rules.
        </p>
      </>
    ),
  },
  {
    id: "risk",
    heading: "7. Assumption of risk and disclaimers",
    body: (
      <>
        <p className={P}>
          You use ICAN at your own risk. The site is provided “as is” and “as
          available,” without warranties of any kind. We are not responsible for the
          conduct of other users, on or off the site, or for decisions you make based
          on advice you receive here.
        </p>
        <p className={`mt-3 ${P}`}>
          To the fullest extent allowed by law, ICAN and its operators are not liable
          for any indirect, incidental, or consequential damages arising from your use
          of the site. Brigham Young University–Idaho is not a party to these terms
          and has no responsibility for ICAN.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    heading: "8. Privacy",
    body: (
      <p className={P}>
        How we collect, use, and protect your information is explained in our{" "}
        <Link href="/privacy" className={LINK}>
          Privacy Notice
        </Link>
        .
      </p>
    ),
  },
  {
    id: "changes",
    heading: "9. Changes and contact",
    body: (
      <p className={P}>
        If these terms change materially, we will update the effective date below
        and let active users know in the app. Questions go to{" "}
        <a href="mailto:GabrielD@nexgenaiintegrations.com" className={LINK}>
          GabrielD@nexgenaiintegrations.com
        </a>
        .
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-light/30 via-white to-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 md:py-16">
        <div className="flex items-center gap-3">
          <Logo size={40} tile />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
              ICAN Mentor Connect
            </p>
            <h1 className="font-display text-3xl font-black text-brand-dark md:text-4xl">
              Terms of use
            </h1>
          </div>
        </div>

        <nav
          aria-label="On this page"
          className="mt-6 rounded-2xl border border-brand-light/60 bg-plum-50 p-4"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-plum-700">Key points</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>• ICAN is independent and not affiliated with BYU-Idaho.</li>
            <li>• It is optional — no class can require it, and it can&apos;t affect grades.</li>
            <li>• You use it at your own risk.</li>
          </ul>
        </nav>

        <div className="mt-8 space-y-6">
          {SECTIONS.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-6 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-brand-light/40 md:p-8"
            >
              <h2 className="font-display text-xl font-bold text-brand-dark">{s.heading}</h2>
              <div className="mt-3">{s.body}</div>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs font-medium text-slate-500">
            Effective October 16, 2026 · also see our{" "}
            <Link href="/privacy" className={LINK}>
              privacy notice
            </Link>
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
